"""FastAPI hazard routes: seismic events, hotspots, wind, crews, status."""

import logging
import time
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from backend.ai.damage_model import run_damage_pipeline
from backend.ai.seismic_cnn import run_inference
from backend.services.firms_poller import process_hotspots
from backend.services.usgs_poller import process_seismic_event

logger = logging.getLogger(__name__)

router = APIRouter(tags=["hazards"])

# In-memory pipeline sync timestamps (updated on each successful ingest)
_sync_timestamps: dict[str, str] = {}


# ─── Request / Response models ────────────────────────────────────────────────

class SeismicEventRequest(BaseModel):
    magnitude: float = Field(..., ge=0.0, le=10.0)
    depth: float = Field(..., ge=0.0, description="Hypocentral depth in km")
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)


class DamageCell(BaseModel):
    cell_id: str
    lat: float
    lon: float
    probability: float


class SeismicEventResponse(BaseModel):
    damage_grid: list[DamageCell]
    inference_time_ms: float


class HotspotItem(BaseModel):
    lat: float
    lng: float
    frp: float = 0.0
    confidence: float = 100.0


class HotspotsRequest(BaseModel):
    hotspots: list[HotspotItem]


class WindRequest(BaseModel):
    lat: float
    lon: float
    wind_speed: float = Field(..., ge=0.0, description="Wind speed in m/s")
    wind_direction: float = Field(..., ge=0.0, le=360.0, description="Wind direction in degrees")


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/seismic-event", response_model=SeismicEventResponse)
async def post_seismic_event(
    body: SeismicEventRequest,
    background_tasks: BackgroundTasks,
) -> SeismicEventResponse:
    """Receive USGS seismic data, run CNN inference + GMPE damage pipeline.

    Returns damage grid synchronously (<3 s total).
    AIP agent loop, Ontology writes, DB persist, and WS broadcast run in background.
    """
    t0 = time.perf_counter()

    # CNN inference on synthetic waveform — benchmarks AMD MI300X latency
    waveform = np.random.randn(3, 500).astype(np.float32)
    run_inference(waveform)

    # GMPE damage pipeline (1° × 1° grid at 0.01° resolution)
    event_dict = {
        "id": f"API_{int(t0 * 1000)}",
        "magnitude": body.magnitude,
        "depth": body.depth,
        "lat": body.lat,
        "lng": body.lon,
    }
    damage_cells = run_damage_pipeline(event_dict)

    inference_time_ms = round((time.perf_counter() - t0) * 1000, 2)

    # Background: AIP loop, DB persist, Ontology write, WS broadcast
    background_tasks.add_task(process_seismic_event, event_dict)

    _sync_timestamps["seismic"] = datetime.now(timezone.utc).isoformat()

    return SeismicEventResponse(
        damage_grid=[
            DamageCell(
                cell_id=cell["grid_cell_id"],
                lat=cell["lat"],
                lon=cell["lng"],
                probability=cell["damage_probability"],
            )
            for cell in damage_cells
        ],
        inference_time_ms=inference_time_ms,
    )


@router.post("/hotspots")
async def post_hotspots(
    body: HotspotsRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """Receive FIRMS hotspot data and trigger ember particle simulation."""
    hotspot_dicts = [h.model_dump() for h in body.hotspots]
    background_tasks.add_task(process_hotspots, hotspot_dicts)
    _sync_timestamps["hotspots"] = datetime.now(timezone.utc).isoformat()
    return {"accepted": len(hotspot_dicts)}


@router.post("/wind")
async def post_wind(body: WindRequest) -> dict:
    """Receive Open-Meteo wind data for ember simulation context."""
    logger.info(
        "Wind update: %.1f m/s @ %.0f° for (%.4f, %.4f)",
        body.wind_speed, body.wind_direction, body.lat, body.lon,
    )
    _sync_timestamps["wind"] = datetime.now(timezone.utc).isoformat()
    return {
        "accepted": True,
        "lat": body.lat,
        "lon": body.lon,
        "wind_speed": body.wind_speed,
        "wind_direction": body.wind_direction,
    }



# Note: GET /crews and GET /status are handled by crews.py and status.py respectively.

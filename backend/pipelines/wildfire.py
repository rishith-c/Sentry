"""Wildfire processing pipeline.

Orchestrates: FIRMS hotspot ingestion -> wind fetch -> ember simulation -> AIP actions -> broadcast.
"""

import logging
from datetime import datetime, timezone

from backend.db import get_connection
from backend.services.benchmark_logger import log_benchmark

logger = logging.getLogger(__name__)


async def process_fire_hotspot(hotspot_data: dict) -> dict:
    """Full wildfire pipeline: ingest hotspot, simulate embers, generate actions.

    Args:
        hotspot_data: dict with lat, lng, frp, confidence

    Returns:
        Summary dict with hotspot_id, ember_zones count.
    """
    import time
    t0 = time.perf_counter()

    lat = hotspot_data.get("lat", 0)
    lng = hotspot_data.get("lng", 0)
    frp = hotspot_data.get("frp", 0)
    confidence = hotspot_data.get("confidence", "nominal")

    conn = get_connection()
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    cur.execute(
        "INSERT INTO hotspots (lat, lng, frp, confidence, detected_at) VALUES (?, ?, ?, ?, ?)",
        (lat, lng, frp, confidence, now),
    )
    conn.commit()
    hotspot_id = cur.lastrowid

    # Fetch wind conditions
    wind = {"speed_ms": 5.0, "direction_deg": 270}
    try:
        from backend.services.weather_service import get_wind
        result = await get_wind(lat, lng)
        if result:
            wind = result
    except Exception as e:
        logger.warning("[SENTRY] Weather fetch failed, using defaults: %s", e)

    # Ember simulation
    ember_zones = []
    try:
        from backend.ai.ember_simulation import run_ember_simulation
        ember_result = run_ember_simulation(
            lat, lng, frp,
            wind_speed=wind["speed_ms"],
            wind_direction=wind["direction_deg"],
        )
        ember_zones = ember_result.get("features", []) if isinstance(ember_result, dict) else []
        for zone in ember_zones:
            props = zone.get("properties", {})
            coords = zone.get("geometry", {}).get("coordinates", [0, 0])
            cur.execute(
                """INSERT INTO ember_risk_zones (hotspot_id, lat, lng, probability, forecast_ts)
                VALUES (?, ?, ?, ?, ?)""",
                (hotspot_id, coords[1] if len(coords) > 1 else 0,
                 coords[0] if coords else 0,
                 props.get("probability", 0), now),
            )
        conn.commit()
    except Exception as e:
        logger.error("[SENTRY] Ember simulation failed: %s", e)

    conn.close()

    elapsed_ms = (time.perf_counter() - t0) * 1000
    log_benchmark({"pipeline": "wildfire_pipeline", "latency_ms": elapsed_ms, "frp": frp})

    summary = {
        "hotspot_id": hotspot_id,
        "frp": frp,
        "wind": wind,
        "ember_zones": len(ember_zones),
        "latency_ms": round(elapsed_ms, 1),
    }
    logger.info("[SENTRY] Wildfire pipeline complete: %s", summary)
    return summary

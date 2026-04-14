# Read DESIGN.md and CLAUDE.md before modifying.
"""Pydantic models matching the SQLite schema in db.py."""

from pydantic import BaseModel
from typing import Optional


class Hotspot(BaseModel):
    id: Optional[int] = None
    lat: float
    lng: float
    frp: float
    confidence: str
    detected_at: str
    source: str = "FIRMS"


class EmberRiskZone(BaseModel):
    id: Optional[int] = None
    hotspot_id: Optional[int] = None
    lat: float
    lng: float
    probability: float
    forecast_ts: str
    geojson_cell: Optional[str] = None


class SeismicEvent(BaseModel):
    id: Optional[int] = None
    usgs_event_id: str
    magnitude: float
    depth: float
    lat: float
    lng: float
    detected_at: str
    usgs_id: Optional[str] = None


class DamageZone(BaseModel):
    id: Optional[int] = None
    event_id: Optional[int] = None
    grid_cell_id: str
    lat: float
    lng: float
    damage_probability: float
    soil_type: Optional[str] = None
    liquefaction_class: Optional[str] = None
    computed_at: str


class SuppressionCrew(BaseModel):
    id: Optional[int] = None
    crew_identifier: str
    lat: float
    lng: float
    status: str = "standby"
    capacity: int = 20
    assigned_zone_id: Optional[int] = None


class Shelter(BaseModel):
    id: Optional[int] = None
    name: str
    lat: float
    lng: float
    occupancy: int = 0
    capacity: int = 500
    damage_zone_id: Optional[int] = None


class Hospital(BaseModel):
    id: Optional[int] = None
    name: str
    lat: float
    lng: float
    current_capacity: int = 200
    alert_level: str = "normal"
    damage_zone_id: Optional[int] = None


class EvacuationRoute(BaseModel):
    id: Optional[int] = None
    status: str = "open"
    origin_zone_id: Optional[int] = None
    destination_zone_id: Optional[int] = None


class AipAction(BaseModel):
    id: Optional[int] = None
    action_type: str
    resource_id: Optional[int] = None
    zone_id: Optional[int] = None
    confidence: float
    time_sensitivity: str
    rationale: str
    status: str = "pending"
    created_at: str
    approved_at: Optional[str] = None


class Session(BaseModel):
    id: int = 1
    mute_state: bool = False


class SyncLogEntry(BaseModel):
    id: Optional[int] = None
    pipeline: str
    last_success_at: Optional[str] = None
    status: str = "unknown"


class EventLogEntry(BaseModel):
    id: Optional[int] = None
    source: str
    message: str
    created_at: str

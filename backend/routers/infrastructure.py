from fastapi import APIRouter

from backend.db import get_connection

router = APIRouter()


@router.get("/damage-zones")
async def get_damage_zones():
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, event_id, grid_cell_id, lat, lng,
               damage_probability, soil_type, liquefaction_class, computed_at
        FROM damage_zones
        ORDER BY damage_probability DESC
        LIMIT 200
        """
    ).fetchall()
    # Determine the event_id (use the first row's event_id, or None)
    zones = [dict(r) for r in rows]
    event_id = zones[0]["event_id"] if zones else None
    conn.close()
    return {"zones": zones, "event_id": event_id}


@router.get("/shelters")
async def get_shelters():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, lat, lng, occupancy, capacity, damage_zone_id FROM shelters"
    ).fetchall()
    conn.close()
    return {"shelters": [dict(r) for r in rows]}


@router.get("/hospitals")
async def get_hospitals():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, lat, lng, current_capacity, alert_level, damage_zone_id FROM hospitals"
    ).fetchall()
    conn.close()
    return {"hospitals": [dict(r) for r in rows]}


@router.get("/evacuation-routes")
async def get_evacuation_routes():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, status, origin_zone_id, destination_zone_id FROM evacuation_routes"
    ).fetchall()
    conn.close()
    return {"routes": [dict(r) for r in rows]}

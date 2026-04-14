from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db import get_connection
import backend.services.ws_broadcaster as ws_broadcaster

router = APIRouter()


class CrewUpdate(BaseModel):
    status: Optional[str] = None
    assigned_zone_id: Optional[int] = None


@router.get("/crews")
async def get_crews():
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, crew_identifier, lat, lng, status, capacity, assigned_zone_id
        FROM suppression_crews
        ORDER BY id
        """
    ).fetchall()
    conn.close()
    return {"crews": [dict(r) for r in rows]}


@router.patch("/crews/{crew_id}")
async def patch_crew(crew_id: int, body: CrewUpdate):
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM suppression_crews WHERE id = ?", (crew_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Crew not found")

    if body.status is not None:
        conn.execute(
            "UPDATE suppression_crews SET status = ? WHERE id = ?",
            (body.status, crew_id),
        )
    if body.assigned_zone_id is not None:
        conn.execute(
            "UPDATE suppression_crews SET assigned_zone_id = ? WHERE id = ?",
            (body.assigned_zone_id, crew_id),
        )

    conn.commit()

    updated = conn.execute(
        "SELECT id, crew_identifier, lat, lng, status, capacity, assigned_zone_id FROM suppression_crews WHERE id = ?",
        (crew_id,),
    ).fetchone()
    conn.close()

    payload = dict(updated)
    await ws_broadcaster.broadcast_crew_update(payload)

    return {"status": "updated"}

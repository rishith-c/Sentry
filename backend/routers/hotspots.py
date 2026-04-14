from fastapi import APIRouter

from backend.db import get_connection

router = APIRouter()


@router.get("/hotspots")
async def get_hotspots():
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, lat, lng, frp, confidence, detected_at, source
        FROM hotspots
        ORDER BY detected_at DESC
        LIMIT 100
        """
    ).fetchall()
    conn.close()

    hotspots = [dict(r) for r in rows]
    return {"hotspots": hotspots, "count": len(hotspots)}

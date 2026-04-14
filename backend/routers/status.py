from fastapi import APIRouter
from datetime import datetime, timezone
from backend.db import get_db

router = APIRouter(tags=['status'])


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _safe_count(db, sql: str) -> int:
    try:
        cursor = await db.execute(sql)
        row = await cursor.fetchone()
        return row[0] if row else 0
    except Exception:
        return 0


@router.get('/counters')
async def get_counters():
    """Return real-time counters derived from SQLite tables."""
    db = await get_db()
    try:
        active_hotspots = await _safe_count(db, 'SELECT COUNT(*) FROM hotspots')
        crews_deployed = await _safe_count(
            db, "SELECT COUNT(*) FROM suppression_crews WHERE status = 'deployed'"
        )
        crews_total = await _safe_count(db, 'SELECT COUNT(*) FROM suppression_crews')
        damage_zones_above_threshold = await _safe_count(
            db, 'SELECT COUNT(*) FROM damage_zones WHERE damage_probability > 0.70'
        )
        shelters_at_capacity = await _safe_count(
            db, 'SELECT COUNT(*) FROM shelters WHERE occupancy >= capacity AND capacity > 0'
        )
        hospitals_on_alert = await _safe_count(
            db, "SELECT COUNT(*) FROM hospitals WHERE alert_level != 'normal'"
        )
        return {
            'active_hotspots': active_hotspots,
            'crews_deployed': crews_deployed,
            'crews_total': crews_total,
            'damage_zones_above_threshold': damage_zones_above_threshold,
            'shelters_at_capacity': shelters_at_capacity,
            'hospitals_on_alert': hospitals_on_alert,
        }
    finally:
        await db.close()


@router.get('/sync-status')
async def get_sync_status():
    """Return per-pipeline sync status from sync_log table."""
    db = await get_db()
    try:
        pipelines_map: dict = {}
        try:
            cursor = await db.execute(
                '''SELECT pipeline, last_success_at, status FROM sync_log
                   WHERE id IN (SELECT MIN(id) FROM sync_log GROUP BY pipeline)
                   ORDER BY pipeline'''
            )
            rows = await cursor.fetchall()
            for r in rows:
                pipelines_map[r[0]] = {
                    'last_success_at': r[1],
                    'status': r[2],
                }
        except Exception:
            pass

        # Ensure the three required keys always exist
        for key in ('firms', 'usgs', 'weather'):
            if key not in pipelines_map:
                pipelines_map[key] = {'last_success_at': None, 'status': 'unknown'}

        return {
            'firms': pipelines_map.get('firms', {'last_success_at': None, 'status': 'unknown'}),
            'usgs': pipelines_map.get('usgs', {'last_success_at': None, 'status': 'unknown'}),
            'weather': pipelines_map.get('weather', {'last_success_at': None, 'status': 'unknown'}),
        }
    finally:
        await db.close()

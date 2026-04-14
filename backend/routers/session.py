from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timezone
from backend.db import get_db

router = APIRouter(tags=['session'])

def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()

class SessionPatch(BaseModel):
    mute_state: bool

async def _ensure_session(db) -> None:
    """Create the singleton session row if it does not exist."""
    cursor = await db.execute(
        'SELECT id FROM sessions WHERE id = 1'
    )
    row = await cursor.fetchone()
    if row is None:
        now = utcnow()
        await db.execute(
            'INSERT INTO sessions (id, mute_state, created_at, last_active_at) VALUES (1, 0, ?, ?)',
            (now, now)
        )
        await db.commit()

@router.get('/session')
async def get_session():
    db = await get_db()
    try:
        await _ensure_session(db)
        cursor = await db.execute(
            'SELECT id, mute_state FROM sessions WHERE id = 1'
        )
        row = await cursor.fetchone()
        return {'id': row[0], 'mute_state': bool(row[1])}
    finally:
        await db.close()

@router.patch('/session')
async def patch_session(body: SessionPatch):
    db = await get_db()
    try:
        await _ensure_session(db)
        now = utcnow()
        await db.execute(
            'UPDATE sessions SET mute_state = ?, last_active_at = ? WHERE id = 1',
            (1 if body.mute_state else 0, now)
        )
        await db.commit()
        cursor = await db.execute(
            'SELECT id, mute_state FROM sessions WHERE id = 1'
        )
        row = await cursor.fetchone()
        return {'id': row[0], 'mute_state': bool(row[1])}
    finally:
        await db.close()

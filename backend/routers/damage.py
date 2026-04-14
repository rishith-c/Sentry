from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import asyncio
import json

from backend.db import get_db
from backend.services.ws_broadcaster import broadcast_damage_grid, broadcast_action_created

router = APIRouter(prefix='/api/simulate', tags=['simulate'])


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post('', status_code=200)
async def simulate_crisis():
    """Fire the full Northridge 1994 pre-computed pipeline."""
    try:
        from backend.ai.northridge_data import NORTHRIDGE_GRID
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f'northridge_data not available: {e}')

    try:
        from backend.ai.aip_agent import run_aip_loop
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f'aip_agent not available: {e}')

    try:
        from backend.ai.elevenlabs_client import synthesize_speech
        elevenlabs_available = True
    except ImportError:
        elevenlabs_available = False
        synthesize_speech = None

    db = await get_db()
    try:
        now = utcnow()

        # ── 1. Upsert seismic event (P2 schema + usgs_id P1 compat alias) ──
        await db.execute(
            'DELETE FROM seismic_events WHERE usgs_event_id = ?',
            ('northridge-1994-replay',)
        )
        cursor = await db.execute(
            '''INSERT INTO seismic_events
               (usgs_event_id, usgs_id, magnitude, depth, lat, lng, detected_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            ('northridge-1994-replay', 'northridge-1994-replay', 6.7, 17.0, 34.213, -118.537, now),
        )
        await db.commit()
        seismic_event_id = cursor.lastrowid

        # ── 2. Bulk insert damage zones (P2 schema) ──
        cells = []
        for cell in NORTHRIDGE_GRID:
            cells.append((
                seismic_event_id,
                cell.get('grid_cell_id', 'CELL_?'),
                cell.get('lat', 0.0),
                cell.get('lng', 0.0),
                cell.get('damage_probability', 0.0),
                'unknown',                          # soil_type — not in NORTHRIDGE_GRID
                cell.get('liquefaction_class', 'low'),
                now,
            ))

        await db.executemany(
            '''INSERT INTO damage_zones
               (event_id, grid_cell_id, lat, lng, damage_probability, soil_type, liquefaction_class, computed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            cells,
        )
        await db.commit()
        damage_zones_created = len(cells)

        # ── 3. Broadcast damage grid (first 100 cells to stay under WS frame limit) ──
        broadcast_cells = [
            {'lat': c[2], 'lng': c[3], 'damage_probability': c[4], 'liquefaction_class': c[6]}
            for c in cells[:100]
        ]
        await broadcast_damage_grid(broadcast_cells)

        # ── 4. Run AIP loop (sync) → action cards ──
        actions = []
        try:
            raw_actions = await asyncio.to_thread(
                run_aip_loop,
                [], list(NORTHRIDGE_GRID), [], [], [], [],
            )
            for raw in (raw_actions or []):
                actions.append(raw if isinstance(raw, dict) else raw.__dict__)
            if not actions:
                raise ValueError('empty_result')
        except Exception as e:
            print(f'[simulate] run_aip_loop empty/error: {e} — stub actions')
            actions = [
                {'action_type': 'dispatch', 'resource_id': None, 'zone_id': None,
                 'confidence': 0.9, 'time_sensitivity': 'immediate',
                 'rationale': 'Deploy Engine 42 to Zone A'},
                {'action_type': 'alert', 'resource_id': None, 'zone_id': None,
                 'confidence': 0.8, 'time_sensitivity': 'high',
                 'rationale': 'Evacuate residential blocks 14-18'},
                {'action_type': 'reposition', 'resource_id': None, 'zone_id': None,
                 'confidence': 0.75, 'time_sensitivity': 'medium',
                 'rationale': 'Alert USAR Team Bravo for collapsed structures'},
            ]

        actions = actions[:3]

        # ── 5. Insert into aip_actions (P2 schema), broadcast, synthesize ──
        action_ids = []
        for action in actions:
            rec_cursor = await db.execute(
                '''INSERT INTO aip_actions
                   (action_type, resource_id, zone_id, confidence, time_sensitivity, rationale, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (
                    action.get('action_type', 'dispatch'),
                    action.get('resource_id'),
                    action.get('zone_id'),
                    action.get('confidence', 0.9),
                    action.get('time_sensitivity', 'immediate'),
                    action.get('rationale', str(action)),
                    'pending',
                    now,
                ),
            )
            await db.commit()
            action_db_id = rec_cursor.lastrowid
            action_ids.append(action_db_id)

            await broadcast_action_created({**action, 'db_id': action_db_id, 'event_id': seismic_event_id})

            if elevenlabs_available and synthesize_speech:
                try:
                    audio = await asyncio.to_thread(synthesize_speech, action.get('rationale', ''))
                    print(f'[simulate] ElevenLabs audio bytes: {len(audio) if audio else 0}')
                except Exception as e:
                    print(f'[simulate] ElevenLabs error (non-fatal): {e}')

        # ── 6. Update sync_log + write event_log ──
        try:
            await db.execute(
                '''UPDATE sync_log SET last_success_at = ?, status = ?
                   WHERE pipeline = ?''',
                (now, 'ok', 'simulate'),
            )
            await db.execute(
                'INSERT INTO event_log (source, message, created_at) VALUES (?, ?, ?)',
                ('simulate', f'Northridge 1994 replay — {len(actions)} actions, {damage_zones_created} zones', now),
            )
            await db.commit()
        except Exception:
            pass

        return {
            'status': 'ok',
            'event_id': seismic_event_id,
            'damage_zones_created': damage_zones_created,
            'actions_created': len(actions),
            'action_ids': action_ids,
            'elevenlabs_active': elevenlabs_available,
        }

    finally:
        await db.close()


@router.delete('/reset', status_code=200)
async def reset_simulation():
    """Clear all simulation data: damage_zones, aip_actions, seismic_events (northridge replay only)."""
    db = await get_db()
    try:
        await db.execute(
            'DELETE FROM damage_zones WHERE event_id IN '
            '(SELECT id FROM seismic_events WHERE usgs_event_id = ?)',
            ('northridge-1994-replay',),
        )
        await db.execute(
            'DELETE FROM aip_actions WHERE zone_id IS NULL',
        )
        await db.execute(
            'DELETE FROM seismic_events WHERE usgs_event_id = ?',
            ('northridge-1994-replay',),
        )
        await db.commit()
        return {'status': 'ok', 'message': 'Simulation data cleared'}
    finally:
        await db.close()

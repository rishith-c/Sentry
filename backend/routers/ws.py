"""WebSocket routes for SENTRY real-time data feeds."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.ws_broadcaster import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/damage-grid")
async def ws_damage_grid(websocket: WebSocket) -> None:
    """Stream seismic damage grid cells to the frontend.

    Message format: {cell_id, lat, lon, damage_probability, soil_type}
    All cells for an event are delivered within 3 seconds of the seismic event POST.
    """
    await manager.connect(websocket)
    logger.info(
        "WS client connected: %s (total: %d)",
        websocket.client, manager.connection_count,
    )
    try:
        while True:
            # Keep alive; client may send pings or control messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(
            "WS client disconnected: %s (remaining: %d)",
            websocket.client, manager.connection_count,
        )
    except Exception as exc:
        logger.error("WS error for %s: %s", websocket.client, exc)
        manager.disconnect(websocket)

import json
from datetime import datetime, timezone
from typing import Set
from fastapi import WebSocket
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        payload = json.dumps(message)
        dead = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead.add(connection)
        for connection in dead:
            self.active_connections.discard(connection)

def _envelope(event_type: str, data) -> dict:
    return {
        'type': event_type,
        'data': data,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }

manager = ConnectionManager()

# ── Broadcast helpers — type strings aligned with P3 useWebSocket hook ──

async def broadcast_ember_update(zones: list):
    """Broadcast ember risk zones. P3 key: 'ember_risk'."""
    await manager.broadcast(_envelope('ember_risk', zones))

async def broadcast_damage_grid(cells: list):
    """Broadcast seismic damage grid. P3 key: 'seismic_grid'."""
    await manager.broadcast(_envelope('seismic_grid', cells))

async def broadcast_action_created(action: dict):
    """Broadcast a single action card. P3 key: 'action_card'."""
    await manager.broadcast(_envelope('action_card', action))

async def broadcast_crew_update(crew: dict):
    """Broadcast crew position/status update. P3 key: 'crew_update'."""
    await manager.broadcast(_envelope('crew_update', crew))

async def broadcast_event_log(description: str, category: str = "ai"):
    """Broadcast an event log entry. P3 key: 'event_log'."""
    await manager.broadcast({
        'type': 'event_log',
        'description': description,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    })

async def broadcast_fire_hotspots(hotspots: list):
    """Broadcast fire hotspot data. P3 key: 'fire_hotspots'."""
    await manager.broadcast(_envelope('fire_hotspots', hotspots))

async def broadcast_counter_update(counters: dict):
    """Broadcast table counters. P3 key: 'counter_update'."""
    await manager.broadcast(_envelope('counter_update', counters))

async def broadcast_infrastructure(shelters: list, hospitals: list):
    """Broadcast shelter + hospital data. P3 key: 'infrastructure'."""
    await manager.broadcast(_envelope('infrastructure', {
        'shelters': shelters,
        'hospitals': hospitals,
    }))

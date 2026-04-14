from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio

from backend.db import init_db
from backend.routers.session import router as session_router
from backend.routers.damage import router as damage_router
from backend.services.ws_broadcaster import manager
from backend.config import config

def _collect_routers():
    """Dynamically import all routers found in backend/routers/.
    This allows P2/P3/P4 routers to be picked up automatically."""
    import importlib, pkgutil, backend.routers as pkg
    routers = []
    for finder, name, ispkg in pkgutil.iter_modules(pkg.__path__):
        if name in ('session', 'damage'):
            continue  # already mounted explicitly
        try:
            mod = importlib.import_module(f'backend.routers.{name}')
            if hasattr(mod, 'router'):
                routers.append((name, mod.router))
        except Exception as e:
            print(f'[main] Warning: could not import router {name}: {e}')
    return routers

@asynccontextmanager
async def lifespan(app: FastAPI):
    print('[sentry] Starting up — initializing database...')
    init_db()
    print('[sentry] Database ready. Sentry online.')
    yield
    print('[sentry] Shutting down.')

app = FastAPI(
    title='Sentry',
    description='Real-time multi-hazard disaster intelligence dashboard',
    version='0.1.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_origin_regex=r'https://.*\.vercel\.app',
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── Static routers ──
app.include_router(session_router, prefix='/api')
app.include_router(damage_router)

# ── Dynamic router discovery (picks up all P2/P3/P4 stubs) ──
for name, router in _collect_routers():
    existing_prefix = getattr(router, 'prefix', None) or ''
    if existing_prefix.startswith('/api'):
        app.include_router(router)
        print(f'[main] Mounted router: {name} at {existing_prefix}')
    else:
        app.include_router(router, prefix='/api')
        print(f'[main] Mounted router: {name} at /api{existing_prefix}')

@app.get('/health')
async def health():
    return {
        'status': 'ok',
        'version': app.version,
        'env': config.env,
        'services': {
            'database': 'ok',
            'websocket': 'ok',
        },
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }


@app.post('/api/reset')
async def reset_all():
    """Clear all simulation data: damage_zones, aip_actions, seismic_events, ember_risk_zones."""
    from backend.db import get_db as _get_db
    db = await _get_db()
    try:
        await db.execute('DELETE FROM damage_zones')
        await db.execute('DELETE FROM aip_actions')
        await db.execute('DELETE FROM seismic_events')
        await db.execute('DELETE FROM ember_risk_zones')
        await db.execute('DELETE FROM event_log')
        await db.execute('DELETE FROM hotspots')
        await db.commit()
        return {'status': 'ok', 'message': 'All simulation data cleared'}
    finally:
        await db.close()

@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f'[ws] Client connected. Total: {len(manager.active_connections)}')
    try:
        await websocket.send_text(
            '{"type":"connected","data":"Sentry online","timestamp":"' +
            datetime.now(timezone.utc).isoformat() + '"}'
        )
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_text(
                    '{"type":"ping","data":null,"timestamp":"' +
                    datetime.now(timezone.utc).isoformat() + '"}'
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f'[ws] Client disconnected. Total: {len(manager.active_connections)}')
    except Exception as e:
        manager.disconnect(websocket)
        print(f'[ws] Client error, removed: {e}')

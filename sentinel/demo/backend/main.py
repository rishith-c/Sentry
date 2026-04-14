import asyncio
import json
import math
import random
from datetime import datetime, timezone
from typing import Optional

import aiosqlite
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "backend/sentinel.db"

# --- WebSocket state ---

connected_clients: list[WebSocket] = []


async def broadcast(message: dict):
    """Send a JSON message to all connected WebSocket clients."""
    dead: list[WebSocket] = []
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        try:
            connected_clients.remove(ws)
        except ValueError:
            pass


# --- DB helpers ---

def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


async def fetchall_as_dicts(db: aiosqlite.Connection, sql: str, params=()) -> list[dict]:
    db.row_factory = aiosqlite.Row
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def fetchone_as_dict(db: aiosqlite.Connection, sql: str, params=()) -> Optional[dict]:
    db.row_factory = aiosqlite.Row
    cursor = await db.execute(sql, params)
    row = await cursor.fetchone()
    return dict(row) if row else None


# --- Init DB ---

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        with open("backend/db/schema.sql") as f:
            await db.executescript(f.read())
        crews = [
            # Positioned at real LAFD fire stations in the San Fernando Valley
            ("crew_001", 34.210, -118.540, "standby", 10),  # Sta. 74 — Reseda (near epicenter)
            ("crew_002", 34.274, -118.500, "standby", 8),   # Sta. 87 — Granada Hills
            ("crew_003", 34.260, -118.449, "standby", 12),  # Sta. 98 — Mission Hills
            ("crew_004", 34.238, -118.478, "standby", 9),   # Sta. 88 — North Hills
            ("crew_005", 34.169, -118.593, "standby", 11),  # Sta. 77 — Woodland Hills
        ]
        for c in crews:
            await db.execute(
                "INSERT OR IGNORE INTO suppression_crews (crew_id, lat, lng, status, capacity, updated_at) "
                "VALUES (?,?,?,?,?,datetime('now'))",
                c,
            )
        shelters = [
            ("Pasadena Shelter", 34.148, -118.144, 0, 500),
            ("Burbank Shelter", 34.181, -118.309, 0, 350),
            ("Culver City Shelter", 34.021, -118.397, 0, 280),
        ]
        for s in shelters:
            await db.execute(
                "INSERT OR IGNORE INTO shelters (name, lat, lng, occupancy, capacity) VALUES (?,?,?,?,?)", s
            )
        hospitals = [
            ("Cedars-Sinai Medical Center", 34.075, -118.380, 886, "normal"),
            ("Ronald Reagan UCLA Medical Center", 34.066, -118.445, 520, "normal"),
        ]
        for h in hospitals:
            await db.execute(
                "INSERT OR IGNORE INTO hospitals (name, lat, lng, capacity, alert_level) VALUES (?,?,?,?,?)", h
            )
        await db.commit()


@app.on_event("startup")
async def startup():
    await init_db()


# --- Health ---

@app.get("/health")
async def health():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in await cursor.fetchall()]
    return {"status": "ok", "tables": tables}


@app.post("/api/reset")
async def reset_simulation():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM seismic_events")
        await db.execute("DELETE FROM damage_zones")
        await db.execute("DELETE FROM fire_hotspots")
        await db.execute("DELETE FROM ember_risk_zones")
        await db.execute("DELETE FROM action_cards")
        await db.execute("UPDATE suppression_crews SET status='standby', assigned_zone_id=NULL")
        await db.execute("UPDATE shelters SET occupancy=0")
        await db.execute("UPDATE hospitals SET alert_level='normal'")
        await db.commit()
    return {"status": "reset"}


# --- Pydantic models ---

class CrewUpdate(BaseModel):
    status: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    assigned_zone_id: Optional[int] = None


class ActionCardUpdate(BaseModel):
    status: str


# --- Crews ---

@app.get("/api/crews")
async def get_crews():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, crew_id, lat, lng, status, capacity, assigned_zone_id, updated_at "
            "FROM suppression_crews ORDER BY crew_id",
        )


@app.get("/api/crews/{crew_id}")
async def get_crew(crew_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        row = await fetchone_as_dict(
            db,
            "SELECT id, crew_id, lat, lng, status, capacity, assigned_zone_id, updated_at "
            "FROM suppression_crews WHERE crew_id = ?",
            (crew_id,),
        )
    return row or {}


@app.patch("/api/crews/{crew_id}")
async def update_crew(crew_id: str, body: CrewUpdate):
    fields: list[str] = []
    values: list = []

    if body.status is not None:
        fields.append("status = ?")
        values.append(body.status)
    if body.lat is not None:
        fields.append("lat = ?")
        values.append(body.lat)
    if body.lng is not None:
        fields.append("lng = ?")
        values.append(body.lng)
    if body.assigned_zone_id is not None:
        fields.append("assigned_zone_id = ?")
        values.append(body.assigned_zone_id)

    if not fields:
        async with aiosqlite.connect(DB_PATH) as db:
            row = await fetchone_as_dict(
                db,
                "SELECT id, crew_id, lat, lng, status, capacity, assigned_zone_id, updated_at "
                "FROM suppression_crews WHERE crew_id = ?",
                (crew_id,),
            )
        return row or {}

    fields.append("updated_at = ?")
    values.append(now_iso())
    values.append(crew_id)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE suppression_crews SET {', '.join(fields)} WHERE crew_id = ?",
            values,
        )
        await db.commit()
        row = await fetchone_as_dict(
            db,
            "SELECT id, crew_id, lat, lng, status, capacity, assigned_zone_id, updated_at "
            "FROM suppression_crews WHERE crew_id = ?",
            (crew_id,),
        )

    if row:
        await broadcast({"type": "crew_update", "data": row})
    return row or {}


# --- Shelters ---

@app.get("/api/shelters")
async def get_shelters():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, name, lat, lng, occupancy, capacity, damage_zone_id FROM shelters ORDER BY name",
        )


# --- Hospitals ---

@app.get("/api/hospitals")
async def get_hospitals():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, name, lat, lng, capacity, alert_level, damage_zone_id FROM hospitals ORDER BY name",
        )


# --- Evacuation Routes ---

@app.get("/api/routes")
async def get_routes():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, origin_zone_id, dest_zone_id, status FROM evacuation_routes",
        )


# --- Fire Hotspots ---

@app.get("/api/hotspots")
async def get_hotspots():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, lat, lng, frp, confidence, detected_at FROM fire_hotspots ORDER BY detected_at DESC",
        )


# --- Ember Risk Zones ---

@app.get("/api/ember-zones")
async def get_ember_zones():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, hotspot_id, lat, lng, probability, forecast_at FROM ember_risk_zones ORDER BY forecast_at DESC",
        )


# --- Seismic Events ---

@app.get("/api/seismic-events")
async def get_seismic_events():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, magnitude, depth, lat, lng, detected_at, processed_at FROM seismic_events ORDER BY detected_at DESC",
        )


# --- Damage Zones ---

@app.get("/api/damage-zones/{event_id}")
async def get_damage_zones(event_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, event_id, cell_id, lat, lng, damage_prob, soil_type, created_at "
            "FROM damage_zones WHERE event_id = ? ORDER BY damage_prob DESC",
            (event_id,),
        )


# --- Action Cards ---

@app.get("/api/action-cards")
async def get_action_cards():
    async with aiosqlite.connect(DB_PATH) as db:
        return await fetchall_as_dicts(
            db,
            "SELECT id, action_type, resource_id, zone_id, confidence, rationale, status, created_at "
            "FROM action_cards WHERE status = 'pending' ORDER BY confidence DESC",
        )


@app.patch("/api/action-cards/{card_id}")
async def update_action_card(card_id: int, body: ActionCardUpdate):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE action_cards SET status = ? WHERE id = ?",
            (body.status, card_id),
        )
        await db.commit()
        row = await fetchone_as_dict(
            db,
            "SELECT id, action_type, resource_id, zone_id, confidence, rationale, status, created_at "
            "FROM action_cards WHERE id = ?",
            (card_id,),
        )
    return row or {"status": "updated"}


# --- Crew Movement (triggered on commander approval) ---

CREW_STARTS = {
    "crew_001": (34.210, -118.540),
    "crew_002": (34.274, -118.500),
    "crew_003": (34.260, -118.449),
    "crew_004": (34.238, -118.478),
    "crew_005": (34.169, -118.593),
}

CREW_TARGETS = {
    "crew_001": (34.282, -118.408),   # Staging Bravo
    "crew_002": (34.225, -118.460),   # Zone D-12
    "crew_003": (34.280, -118.450),   # Pacoima hotspot
}


async def animate_crew_to_target(crew_id: str, end: tuple):
    start = CREW_STARTS.get(crew_id, end)
    slat, slng = start
    elat, elng = end
    n_steps = 20
    interval = 0.6
    for step in range(1, n_steps + 1):
        t = step / n_steps
        await broadcast({"type": "crew_update", "data": {
            "id": crew_id,
            "crew_id": crew_id,
            "lat": round(slat + (elat - slat) * t, 5),
            "lng": round(slng + (elng - slng) * t, 5),
            "status": "active" if step == n_steps else "en_route",
        }})
        await asyncio.sleep(interval)


@app.post("/api/crews/{crew_id}/move")
async def move_crew(crew_id: str):
    target = CREW_TARGETS.get(crew_id)
    if not target:
        return {"status": "no_target", "crew_id": crew_id}
    asyncio.create_task(animate_crew_to_target(crew_id, target))
    return {"status": "moving", "crew_id": crew_id}


# --- Simulation ---

@app.post("/api/simulate/northridge")
async def simulate_northridge():
    import asyncio

    epi_lat = 34.213
    epi_lng = -118.537
    depth = 17.0
    ts = now_iso()
    soil_types = ["alluvial", "bedrock", "sandy loam", "clay"]

    # --- Step 1: Insert seismic event ---
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO seismic_events (magnitude, depth, lat, lng, detected_at, processed_at) VALUES (?,?,?,?,?,?)",
            (6.7, depth, epi_lat, epi_lng, ts, ts),
        )
        event_id = cursor.lastrowid

        # --- Step 2: Compute damage grid (generate cells around epicenter) ---
        damage_cells = []
        num_zones = random.randint(28, 35)
        MAX_DIST = 0.09  # ~10 km — keeps damage cells focused on Northridge/Reseda/Chatsworth
        damage_zone_ids = []
        for i in range(num_zones):
            angle = random.uniform(0, 2 * math.pi)
            dist = random.uniform(0.005, MAX_DIST)
            dlat = round(epi_lat + dist * math.cos(angle), 5)
            dlng = round(epi_lng + dist * math.sin(angle), 5)
            norm_dist = dist / MAX_DIST
            damage_prob = round(max(0.35, min(0.95, random.uniform(0.6, 0.95) * (1 - norm_dist * 0.4))), 3)
            soil = random.choice(soil_types)
            cell_id = f"cell_{event_id}_{i:03d}"
            dz_cur = await db.execute(
                "INSERT INTO damage_zones (event_id, cell_id, lat, lng, damage_prob, soil_type, created_at) VALUES (?,?,?,?,?,?,?)",
                (event_id, cell_id, dlat, dlng, damage_prob, soil, ts),
            )
            damage_zone_ids.append(dz_cur.lastrowid)
            damage_cells.append({"id": dz_cur.lastrowid, "event_id": event_id, "cell_id": cell_id,
                                   "lat": dlat, "lng": dlng, "damage_prob": damage_prob, "soil_type": soil, "created_at": ts})

        # --- Step 3: Insert the 12 exact fire hotspots ---
        hotspot_defs = [
            {"lat": 34.280, "lng": -118.450, "frp": 420, "confidence": "high"},
            {"lat": 34.253, "lng": -118.521, "frp": 380, "confidence": "high"},
            {"lat": 34.219, "lng": -118.481, "frp": 290, "confidence": "nominal"},
            {"lat": 34.195, "lng": -118.553, "frp": 510, "confidence": "high"},
            {"lat": 34.312, "lng": -118.582, "frp": 340, "confidence": "high"},
            {"lat": 34.171, "lng": -118.424, "frp": 260, "confidence": "nominal"},
            {"lat": 34.261, "lng": -118.612, "frp": 450, "confidence": "high"},
            {"lat": 34.204, "lng": -118.391, "frp": 310, "confidence": "high"},
            {"lat": 34.238, "lng": -118.465, "frp": 390, "confidence": "high"},
            {"lat": 34.289, "lng": -118.503, "frp": 475, "confidence": "high"},
            {"lat": 34.226, "lng": -118.548, "frp": 320, "confidence": "nominal"},
            {"lat": 34.178, "lng": -118.498, "frp": 285, "confidence": "nominal"},
        ]
        hotspot_rows = []
        for hd in hotspot_defs:
            hs_cur = await db.execute(
                "INSERT INTO fire_hotspots (lat, lng, frp, confidence, detected_at) VALUES (?,?,?,?,?)",
                (hd["lat"], hd["lng"], float(hd["frp"]), hd["confidence"], ts),
            )
            hotspot_rows.append({"id": hs_cur.lastrowid, "lat": hd["lat"], "lng": hd["lng"],
                                   "frp": float(hd["frp"]), "confidence": hd["confidence"], "detected_at": ts})

        # --- Step 4: Ember simulation — wind_direction 270 (westerly, blows east) ---
        wind_speed = 6.5
        wind_direction = 270  # degrees, blows east → increasing lng
        ember_rows = []
        for hs in hotspot_rows:
            num_embers = random.randint(2, 4)
            for j in range(num_embers):
                spread_dist = wind_speed * 0.004 * (j + 1) * random.uniform(0.8, 1.2)
                # wind_direction 270 means wind FROM west, ember travels EAST (+lng)
                e_lat = round(hs["lat"] + random.uniform(-0.02, 0.02), 5)
                e_lng = round(hs["lng"] + spread_dist, 5)
                probability = round(random.uniform(0.40, 0.88), 3)
                em_cur = await db.execute(
                    "INSERT INTO ember_risk_zones (hotspot_id, lat, lng, probability, forecast_at) VALUES (?,?,?,?,?)",
                    (hs["id"], e_lat, e_lng, probability, ts),
                )
                ember_rows.append({"id": em_cur.lastrowid, "hotspot_id": hs["id"],
                                    "lat": e_lat, "lng": e_lng, "probability": probability, "forecast_at": ts})

        # --- Action cards (AIP agent output) ---
        action_templates = [
            {"action_type": "REPOSITION", "resource_id": "crew_001", "zone_id": str(damage_zone_ids[0]) if damage_zone_ids else None,
             "confidence": 0.91, "rationale": "Crew 1 is in a high collapse risk area. Move to staging area Bravo now."},
            {"action_type": "DISPATCH", "resource_id": "crew_003", "zone_id": str(damage_zone_ids[1]) if len(damage_zone_ids) > 1 else None,
             "confidence": 0.87, "rationale": "Send Crew 3 to the Pacoima fire cluster. They are the closest available unit."},
            {"action_type": "EVACUATE", "resource_id": "crew_002", "zone_id": str(damage_zone_ids[2]) if len(damage_zone_ids) > 2 else None,
             "confidence": 0.83, "rationale": "Evacuate Zone D-12. Water main is failing and fire is approaching."},
            {"action_type": "ALERT", "resource_id": "crew_005", "zone_id": str(damage_zone_ids[3]) if len(damage_zone_ids) > 3 else None,
             "confidence": 0.79, "rationale": "Ember spread heading toward Crew 5 area. Expected arrival in 90 minutes."},
        ]
        action_card_rows = []
        for tmpl in action_templates:
            ac_cur = await db.execute(
                "INSERT INTO action_cards (action_type, resource_id, zone_id, confidence, rationale, status, created_at) VALUES (?,?,?,?,?,'pending',?)",
                (tmpl["action_type"], tmpl["resource_id"], tmpl["zone_id"], tmpl["confidence"], tmpl["rationale"], ts),
            )
            action_card_rows.append({**tmpl, "id": ac_cur.lastrowid, "status": "pending", "created_at": ts})

        # Update shelters and hospitals
        shelters_cursor = await db.execute("SELECT id, occupancy, capacity FROM shelters")
        for row in await shelters_cursor.fetchall():
            sid, occ, cap = row[0], row[1], row[2]
            await db.execute("UPDATE shelters SET occupancy = ? WHERE id = ?", (min(occ + random.randint(80, 200), cap), sid))
        hospitals_cursor = await db.execute("SELECT id, lat, lng FROM hospitals")
        for row in await hospitals_cursor.fetchall():
            hid, hlat, hlng = row[0], row[1], row[2]
            dist_deg = math.sqrt((hlat - epi_lat) ** 2 + (hlng - epi_lng) ** 2)
            if dist_deg < 0.5:
                await db.execute("UPDATE hospitals SET alert_level = ? WHERE id = ?",
                                  ("critical" if dist_deg < 0.25 else "elevated", hid))
        await db.commit()

    # ----------------------------------------------------------------
    # Step 5 — Timed broadcast sequence (~120s cinematic compute)
    # ----------------------------------------------------------------

    # Fire station starting positions (must match init_db)
    CREW_STARTS = {
        "crew_001": (34.210, -118.540),  # Sta. 74 Reseda — near epicenter
        "crew_002": (34.274, -118.500),  # Sta. 87 Granada Hills
        "crew_003": (34.260, -118.449),  # Sta. 98 Mission Hills
    }
    # Movement targets
    STAGING_BRAVO  = (34.282, -118.408)   # Safe staging area NE of damage zone
    PACOIMA_TARGET = (34.280, -118.450)   # Pacoima hotspot cluster
    ZONE_D12       = (34.225, -118.460)   # Zone D-12 evacuation area

    async def animate_crew(crew_id: str, end: tuple, n_steps: int = 4, interval: float = 3.0):
        """Broadcast a series of crew_update positions interpolating to end."""
        start = CREW_STARTS.get(crew_id, end)
        slat, slng = start
        elat, elng = end
        for step in range(1, n_steps + 1):
            t = step / n_steps
            await broadcast({"type": "crew_update", "data": {
                "id": crew_id,
                "crew_id": crew_id,
                "lat": round(slat + (elat - slat) * t, 5),
                "lng": round(slng + (elng - slng) * t, 5),
                "status": "active" if step == n_steps else "en_route",
            }})
            await asyncio.sleep(interval)

    async def run_broadcast_sequence():
        # T+0:01 — earthquake confirmed
        await asyncio.sleep(1.0)
        await broadcast({"type": "event_log", "description": "M6.7 earthquake confirmed — epicenter Northridge, 17 km depth — all units check in immediately"})
        await broadcast({"type": "seismic_event", "data": {"id": event_id, "magnitude": 6.7, "depth": depth,
                                                             "lat": epi_lat, "lng": epi_lng, "detected_at": ts}})

        # T+0:02 — structural risk warning
        await asyncio.sleep(1.0)
        await broadcast({"type": "event_log", "description": "Structural damage assessment initiated — high collapse risk expected in Northridge, Reseda, and Chatsworth corridors"})

        # T+0:03 — epicenter marker + start streaming damage cells
        await asyncio.sleep(1.0)
        await broadcast({"type": "epicenter_marker", "data": {"lat": epi_lat, "lng": epi_lng, "magnitude": 6.7, "depth": depth}})

        # T+0:03 → T+0:38 — stream damage cells over 35 seconds
        if damage_cells:
            delay_per_cell = 35.0 / len(damage_cells)
            for i, cell in enumerate(damage_cells):
                await broadcast({"type": "damage_grid", "data": cell})
                if i == len(damage_cells) // 3:
                    partial_high = sum(1 for c in damage_cells[:i+1] if c["damage_prob"] > 0.70)
                    await broadcast({"type": "event_log", "description": f"WARNING — {partial_high} zones exceeding 70% collapse probability in Northridge and Reseda — do not send crews into red zones without authorization"})
                elif i == (2 * len(damage_cells)) // 3:
                    await broadcast({"type": "event_log", "description": "Damage corridor confirmed along Balboa Blvd and Reseda Blvd — evacuate residents within 500m of mapped red zones"})
                await asyncio.sleep(delay_per_cell)

        # T+0:40 — damage picture complete + utility failures
        high_risk = sum(1 for c in damage_cells if c["damage_prob"] > 0.70)
        await broadcast({"type": "event_log", "description": f"Structural damage picture complete — {high_risk} high-risk zones mapped — do NOT commit crews to red zones until ground truth confirms"})
        await asyncio.sleep(2.0)
        await broadcast({"type": "event_log", "description": "URGENT — gas line ruptures confirmed across San Fernando Valley — 12 ignition points detected, fire risk EXTREME"})
        await broadcast({"type": "event_log", "description": "Water system failure — hydrant pressure lost in Northridge, Reseda, and Granada Hills — aerial assets may be required"})
        await asyncio.sleep(3.0)

        # T+0:45 → T+0:53 — stream hotspots one by one so fire grows visually
        await broadcast({"type": "event_log", "description": "12 simultaneous fire ignitions confirmed — highest intensity near Chatsworth and Pacoima — immediate aerial and ground response needed"})
        for hs in hotspot_rows:
            await broadcast({"type": "hotspot_new", "data": hs})
            await asyncio.sleep(0.65)

        # T+0:53 — initial ember spread (half the zones) — contour grows over time
        mid = max(2, len(ember_rows) // 2)
        await broadcast({"type": "ember_update", "data": ember_rows[:mid]})
        await broadcast({"type": "event_log", "description": "Ember transport active — wind 6.5 m/s easterly — spotting risk for structures east of current fire perimeter within 30 minutes"})
        await asyncio.sleep(5.0)

        # T+0:58 — full ember coverage (contour expands to final shape)
        await broadcast({"type": "ember_update", "data": ember_rows})
        await asyncio.sleep(3.0)

        # T+0:55 — personnel & threat summary
        await broadcast({"type": "event_log", "description": f"PERSONNEL SAFETY — Crew 1 (Station 74) overlap with {high_risk} collapse zones near epicenter — verify position and authorize reposition"})
        await asyncio.sleep(3.0)
        await broadcast({"type": "event_log", "description": "Cedars-Sinai Medical Center 0.8 km from epicenter — expect mass casualty surge — activate hospital surge protocol"})
        await asyncio.sleep(2.0)

        # T+1:00 — action card 1: REPOSITION crew_001
        await broadcast({"type": "action_card", "data": action_card_rows[0]})
        await broadcast({"type": "event_log", "description": "AI RECOMMENDATION — Crew 1 reposition from Station 74 to Staging Area Bravo — awaiting commander approval"})
        await asyncio.sleep(15.0)

        # T+1:15 — action card 2: DISPATCH crew_003
        await broadcast({"type": "action_card", "data": action_card_rows[1]})
        await broadcast({"type": "event_log", "description": "AI RECOMMENDATION — Dispatch Crew 3 to Pacoima fire cluster — awaiting commander approval"})
        await asyncio.sleep(15.0)

        # T+1:30 — action card 3: EVACUATE crew_002
        if len(action_card_rows) > 2:
            await broadcast({"type": "action_card", "data": action_card_rows[2]})
        await broadcast({"type": "event_log", "description": "AI RECOMMENDATION — Crew 2 evacuate Zone D-12 — awaiting commander approval"})
        await asyncio.sleep(15.0)

        # T+1:45 — SITREP
        await broadcast({"type": "event_log", "description": f"SITREP — {high_risk} collapse zones confirmed, 12 fires active, 3 crews en route — 3 action items pending commander approval"})
        await asyncio.sleep(10.0)

        # T+1:55 — final warning
        await broadcast({"type": "event_log", "description": "Fire perimeter expanding northeast — Pacoima and Sylmar at elevated risk — request additional aerial asset authorization"})
        await asyncio.sleep(5.0)

        # T+2:00
        await broadcast({"type": "simulation_complete", "data": {"event_id": event_id}})

    asyncio.create_task(run_broadcast_sequence())

    return {"status": "triggered", "event_id": event_id}


# --- WebSocket ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            # Keep the connection alive; wait for any client message (ping/pong or ignore)
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        try:
            connected_clients.remove(websocket)
        except ValueError:
            pass

-- Sentry Multi-Hazard Intelligence Platform — SQLite Schema
-- Matches backend/db.py init_db() definitions

CREATE TABLE IF NOT EXISTS hotspots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lat         REAL    NOT NULL,
    lng         REAL    NOT NULL,
    frp         REAL    NOT NULL,
    confidence  TEXT    NOT NULL,
    detected_at TEXT    NOT NULL,
    source      TEXT    DEFAULT 'FIRMS'
);

CREATE TABLE IF NOT EXISTS ember_risk_zones (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    hotspot_id   INTEGER REFERENCES hotspots(id),
    lat          REAL    NOT NULL,
    lng          REAL    NOT NULL,
    probability  REAL    NOT NULL,
    forecast_ts  TEXT    NOT NULL,
    geojson_cell TEXT
);

CREATE TABLE IF NOT EXISTS seismic_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    usgs_event_id TEXT    UNIQUE NOT NULL,
    magnitude     REAL    NOT NULL,
    depth         REAL    NOT NULL,
    lat           REAL    NOT NULL,
    lng           REAL    NOT NULL,
    detected_at   TEXT    NOT NULL,
    usgs_id       TEXT
);

CREATE TABLE IF NOT EXISTS damage_zones (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id           INTEGER REFERENCES seismic_events(id),
    grid_cell_id       TEXT    NOT NULL,
    lat                REAL    NOT NULL,
    lng                REAL    NOT NULL,
    damage_probability REAL    NOT NULL,
    soil_type          TEXT,
    liquefaction_class TEXT,
    computed_at        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS suppression_crews (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    crew_identifier  TEXT    UNIQUE NOT NULL,
    lat              REAL    NOT NULL,
    lng              REAL    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'standby',
    capacity         INTEGER NOT NULL DEFAULT 20,
    assigned_zone_id INTEGER REFERENCES ember_risk_zones(id)
);

CREATE TABLE IF NOT EXISTS shelters (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    lat            REAL    NOT NULL,
    lng            REAL    NOT NULL,
    occupancy      INTEGER NOT NULL DEFAULT 0,
    capacity       INTEGER NOT NULL DEFAULT 500,
    damage_zone_id INTEGER REFERENCES damage_zones(id)
);

CREATE TABLE IF NOT EXISTS hospitals (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    lat              REAL    NOT NULL,
    lng              REAL    NOT NULL,
    current_capacity INTEGER NOT NULL DEFAULT 200,
    alert_level      TEXT    NOT NULL DEFAULT 'normal',
    damage_zone_id   INTEGER REFERENCES damage_zones(id)
);

CREATE TABLE IF NOT EXISTS evacuation_routes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    status              TEXT    NOT NULL DEFAULT 'open',
    origin_zone_id      INTEGER REFERENCES damage_zones(id),
    destination_zone_id INTEGER REFERENCES damage_zones(id)
);

CREATE TABLE IF NOT EXISTS aip_actions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type      TEXT    NOT NULL,
    resource_id      INTEGER,
    zone_id          INTEGER,
    confidence       REAL    NOT NULL,
    time_sensitivity TEXT    NOT NULL,
    rationale        TEXT    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'pending',
    created_at       TEXT    NOT NULL,
    approved_at      TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    id             INTEGER PRIMARY KEY DEFAULT 1,
    mute_state     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL,
    last_active_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline        TEXT    NOT NULL,
    last_success_at TEXT,
    status          TEXT    NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS event_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    source     TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS benchmarks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pipeline   TEXT    NOT NULL,
    metric     TEXT    NOT NULL,
    value      REAL    NOT NULL,
    unit       TEXT    NOT NULL DEFAULT 'ms',
    created_at TEXT    NOT NULL
);

-- Compatibility views
CREATE VIEW IF NOT EXISTS damage_grids AS SELECT * FROM damage_zones;
CREATE VIEW IF NOT EXISTS recommendations AS
    SELECT *, 'seismic' AS event_type FROM aip_actions;

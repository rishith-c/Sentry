# Sentry

A real-time multi-hazard disaster intelligence dashboard that ingests earthquake and wildfire data from federal sensors, runs AI models for damage estimation and fire spread prediction, and presents an actionable command view with AI-generated response recommendations.

## What it does

Sentry monitors two hazard types simultaneously: wildfires and earthquakes. It pulls live data from NASA FIRMS (fire hotspots) and USGS (seismic events), processes each through a dedicated pipeline, and renders everything on a unified command dashboard with a map, action queue, and event feed.

**Wildfire pipeline.** When a FIRMS hotspot arrives, Sentry fetches current wind conditions, runs a particle-based ember advection simulation (200 particles per hotspot, advected under the wind field with stochastic perturbation), and writes the resulting ember risk zones as a GeoJSON grid to the database. Each grid cell carries an ignition probability.

**Seismic pipeline.** When a USGS earthquake event arrives, Sentry runs a 1D CNN on synthetic 3-component seismic waveforms to refine the magnitude estimate, then feeds the refined magnitude into a Ground Motion Prediction Equation (GMPE) damage model that computes per-grid-cell structural damage probabilities factoring in soil type and liquefaction susceptibility.

**Coordination pipeline.** A cross-hazard coordination cycle reads all active hotspots, earthquakes, damage zones, crew positions, shelter occupancy, and hospital alert levels to determine a unified threat level (nominal, elevated, critical, or compound when both hazards are active simultaneously).

**AI action planning.** An AI planner (AIP) agent generates recommended response actions like deploying suppression crews, opening shelters, adjusting hospital alert levels, and modifying evacuation routes. The planner tries a HuggingFace LLM first, falls back to a Palantir AIP Agent Studio endpoint if configured, and falls back again to a rule-based dispatcher if both APIs are unavailable. All recommended actions go into a pending queue and require human approval before execution.

**Voice narration.** ElevenLabs text-to-speech integration can narrate situation updates and agent communications aloud for hands-free operation.

## How the pieces fit together

The backend is a single FastAPI application with WebSocket support. Data pollers run on intervals to ingest from FIRMS and USGS. Processing pipelines chain ingestion, AI inference, and action generation. A WebSocket broadcaster pushes updates to connected frontends in real time. All state lives in a SQLite database (11 tables covering hotspots, ember risk zones, seismic events, damage zones, suppression crews, shelters, hospitals, evacuation routes, AI-planned actions, sessions, and sync logs).

The frontend is a Next.js 16 + React 19 command dashboard built on Leaflet for mapping. The layout is a full-screen dark-mode interface with a top bar, layer controls, a collapsible agent communications panel on the left, the map in the center, an action queue on the right, and an event feed. Real-time updates arrive over WebSocket. The design system uses a strict dark-only theme with threat-level color coding (green for nominal, amber for advisory, orange for warning, red for critical, purple for catastrophic).

The system is seed-loaded with real-world data: 8 suppression crews across LA County, 4 shelter sites, and 3 hospitals near Northridge. The Northridge earthquake scenario serves as the default demonstration case for the seismic pipeline.

## Quickstart

### Prerequisites

- Python 3.11 or newer
- Node 20 or newer
- Optional API keys (the system works without them using fallbacks):
  - NASA FIRMS API key for live fire data
  - HuggingFace token for AI action planning
  - ElevenLabs API key for voice narration
  - Palantir credentials for AIP integration

### 1. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys (all optional)

# Start the API server
uvicorn backend.main:app --reload --port 8000
```

The backend initializes the SQLite database, seeds crew, shelter, and hospital data, and starts polling FIRMS and USGS feeds. Check `http://localhost:8000/health` to verify.

### 2. Start the frontend

```bash
cd sentinel/demo/frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Trigger a simulation

```bash
# Trigger a seismic event (Northridge scenario)
curl -X POST http://localhost:8000/api/simulate

# Or inject a manual earthquake
curl -X POST http://localhost:8000/api/seismic/events \
  -H "Content-Type: application/json" \
  -d '{"magnitude": 6.7, "depth": 18.2, "lat": 34.213, "lng": -118.537, "usgs_event_id": "northridge-demo"}'
```

## Project structure

```
sentry/
  backend/
    main.py                 FastAPI app with WebSocket, CORS, dynamic router discovery
    config.py               Environment variable configuration
    db.py                   SQLite setup, schema init, seed data
    models.py               Pydantic models for all 11 tables
    routers/
      hotspots.py           GET /api/hotspots
      damage.py             GET /api/damage-zones, POST /api/simulate
      seismic.py            Seismic event ingestion and pipeline trigger
      crews.py              Crew roster and assignment management
      actions.py            AI action queue (create, approve, dismiss)
      infrastructure.py     Shelters, hospitals, evacuation routes
      status.py             Dashboard counters and pipeline sync status
      session.py            UI session state (mute toggle)
      ws.py                 WebSocket event broadcasting
      ai.py                 AI-specific endpoints
      media.py              Disaster media triage (HF inference)
      benchmarks.py         Performance benchmark logging
    pipelines/
      seismic.py            USGS ingest -> CNN -> GMPE damage -> AIP actions
      wildfire.py           FIRMS ingest -> wind fetch -> ember simulation
      coordination.py       Cross-hazard threat level assessment
    ai/
      seismic_cnn.py        1D CNN for magnitude estimation (~32k params)
      damage_model.py       GMPE-based structural damage grid
      ember_simulation.py   Particle advection under wind field
      aip_agent.py          AI planner: HF LLM -> Palantir -> rule-based fallback
      prompt.py             System prompts for the AIP agent
      elevenlabs_client.py  TTS integration for voice narration
      hf_inference.py       HuggingFace inference client
    pollers/
      firms.py              NASA FIRMS hotspot poller
      usgs.py               USGS earthquake feed poller
      wind.py               Weather/wind data fetcher
    services/
      ws_broadcaster.py     WebSocket connection manager
      benchmark_logger.py   Pipeline latency tracking
      weather_service.py    Wind condition API
      firms_poller.py       FIRMS polling service
      usgs_poller.py        USGS polling service
    tests/                  Pytest test suite
    requirements.txt        FastAPI, uvicorn, httpx, pydantic, pytest
    .env.example            Environment template (all keys optional)
  sentinel/demo/frontend/
    app/
      page.tsx              Commander dashboard: map + panels + feeds
      live/page.tsx          Live monitoring view
    components/
      MainMap.tsx           Leaflet map with hazard layers
      TopBar.tsx            Status bar with threat indicators
      LayerControls.tsx     Toggle map layers
      ActionQueue.tsx       AI action cards (approve/dismiss)
      EventFeed.tsx         Real-time event stream
      AgentComms.tsx        Agent communication panel
    hooks/
      useWebSocket.ts       WebSocket connection and reconnection
      useInitialData.ts     Initial data fetch on mount
    store/useStore.ts       Zustand state management
  data/
    liquefaction.shp        LA County liquefaction susceptibility shapefile
  feature-store/            Feast feature definitions and context assembler
  spark/                    Delta Lake tables, data lineage, quality checks
```

## Screenshots / Demo

<!-- Add screenshot: the full command dashboard showing the Leaflet map with fire hotspots, damage zones, and crew positions, alongside the action queue and event feed -->

<!-- Add screenshot: a seismic event triggering the pipeline with damage zone grid cells appearing on the map and AI-generated response actions in the queue -->

<!-- Add screenshot: the ember simulation visualization showing particle landing densities downwind of a fire hotspot -->

<!-- Add screenshot: the agent communications panel showing AIP rationale for a crew deployment recommendation -->

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | System health check |
| GET | /api/hotspots | Active fire hotspots |
| GET | /api/damage-zones | Seismic damage grid |
| POST | /api/simulate | Trigger simulation run |
| GET | /api/crews | Suppression crew roster |
| PATCH | /api/crews/{id} | Update crew status |
| GET | /api/actions | AI action queue |
| POST | /api/actions | Create action |
| PATCH | /api/actions/{id}/approve | Approve action |
| PATCH | /api/actions/{id}/dismiss | Dismiss action |
| GET | /api/shelters | Emergency shelters |
| GET | /api/hospitals | Hospital capacity |
| GET | /api/evacuation-routes | Route status |
| GET | /api/counters | Dashboard summary |
| GET | /api/sync-status | Pipeline health |
| WS | /ws | Real-time event stream |

Full route documentation is in `ROUTES.md`.

## Key technical details

- The seismic CNN is a 3-layer 1D convolution network (32 and 64 filters, kernel sizes 11 and 7, with BatchNorm, ReLU, AdaptiveAvgPool, and a two-layer classifier). It runs on CPU by default with optional GPU support. If inference exceeds 500ms, it falls back to a default magnitude of 4.0.
- The ember simulation models particles as physical objects with an initial loft height proportional to fire radiative power, advected by wind with a meteorological convention (wind direction is where it comes from, particles travel the opposite way), descending under gravity with a height-dependent descent rate. Landing positions are gridded into 0.01-degree cells with density-normalized ignition probabilities.
- All AI action recommendations require explicit human approval. The approve/dismiss lifecycle is tracked in the database with timestamps.
- The WebSocket keeps a 30-second ping interval. Disconnected clients see a banner in the UI.

## License

See project files for license details.

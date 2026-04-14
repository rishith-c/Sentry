# SENTRY — AGENTS.md

## What This App Does
SENTRY is a real-time multi-hazard disaster intelligence platform for incident commanders.
Three live pipelines — wildfire ember transport prediction, seismic damage mapping,
and AI-powered resource coordination — fused into a single Palantir Foundry Ontology.
AIP agent reasons over all three simultaneously and speaks ranked recommendations via ElevenLabs.

## Stack
- Frontend: React + Vite + Leaflet.js + WebSocket client → deployed Vercel
- Backend: Python FastAPI → WebSocket server + pipeline HTTP endpoints
- Database: SQLite (crew/shelter/hospital state, event log, session)
- Agent: Palantir Foundry Ontology + AIP Agent Studio + AIP Automate
- GPU: AMD Instinct MI300X, PyTorch ROCm (seismic CNN)
- Voice: ElevenLabs Turbo v2.5 streaming TTS
- APIs: NASA FIRMS (fire), Open-Meteo (wind, no key), USGS GeoJSON (seismic, no key)
- Design: Google Stitch → DESIGN.md → Claude Code (P3 owns this file)

## File Structure
sentinel/
├── DESIGN.md                         ← P3 generates from Google Stitch, lives at root
├── CLAUDE.md                         ← P3 creates, wires DESIGN.md into every CC session
├── AGENTS.md
├── PROGRESS.md / DECISIONS.md / BLOCKERS.md / ENV.md / GITHUB.md
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── MapPanel.jsx          ← Leaflet map + 5 layer toggles
│   │   │   ├── ActionQueue.jsx       ← AIP recommendation cards + ElevenLabs trigger
│   │   │   ├── EventFeed.jsx         ← Chronological event log
│   │   │   ├── TopBar.jsx            ← 6 live counters + 3 sync dots
│   │   │   └── LayerControls.jsx     ← Toggle pills + mute + SIMULATE button
│   │   ├── hooks/useWebSocket.js     ← WS connection to backend
│   │   └── constants/northridge.js  ← Pre-computed Northridge 1994 damage grid
│   └── vite.config.js
├── backend/
│   ├── main.py                       ← FastAPI app + WebSocket server
│   ├── pipelines/
│   │   ├── wildfire.py               ← FIRMS poll + ember particle sim (NumPy)
│   │   ├── seismic.py                ← USGS poll + CNN + GMPE + liquefaction
│   │   └── coordination.py          ← Foundry Ontology writes
│   ├── models/seismic_cnn.py         ← PyTorch CNN (MI300X/ROCm)
│   ├── ai/
│   │   ├── prompt.py                 ← AIP agent prompt templates
│   │   └── elevenlabs.py            ← TTS synthesis + streaming
│   └── db/schema.sql
└── data/liquefaction.shp             ← USGS CA liquefaction susceptibility

## SQLite Tables
- seismic_events (id, magnitude, depth, lat, lng, detected_at, processed_at)
- damage_zones (id, event_id, cell_id, lat, lng, damage_prob, soil_type, created_at)
- fire_hotspots (id, lat, lng, frp, confidence, detected_at)
- ember_risk_zones (id, hotspot_id, lat, lng, probability, forecast_at)
- suppression_crews (id, crew_id, lat, lng, status, capacity, assigned_zone_id, updated_at)
- shelters (id, name, lat, lng, occupancy, capacity, damage_zone_id)
- hospitals (id, name, lat, lng, capacity, alert_level, damage_zone_id)
- evacuation_routes (id, origin_zone_id, dest_zone_id, status)
- action_cards (id, action_type, resource_id, zone_id, confidence, rationale, status, created_at)
- sessions (id, started_at, mute_state)

## API Base URL
- Dev: http://localhost:8000
- Prod: Vercel (frontend) + Railway (backend)

## Auth
None. Single-session commander interface.

## Branch Conventions
- main → P1 only, never push directly
- p1/scaffold → P1 (infra + merges)
- p2/backend → P2 (FastAPI + SQLite)
- p3/ui → P3 (React UI + design system)
- p4/ai → P4 (pipelines + AIP + ElevenLabs)

## Agent Rules
- All Claude Code sessions read this file automatically
- Claude Code handles ALL branching, committing, pushing
- Commit format: [P1|P2|P3|P4] phase-N: description
- Agent teams: 2-5 agents max, each owns specific files, no teams after 4pm
- P3: every Claude Code prompt must begin "Read DESIGN.md and CLAUDE.md first."

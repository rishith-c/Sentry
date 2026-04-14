# SENTRY — DECISIONS.md

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend | React + Vite | Fast dev, Leaflet ecosystem |
| Backend | FastAPI (Python) | GPU/ML native, async WebSocket |
| Database | SQLite | Zero-config, single-session demo |
| Map | Leaflet.js + CartoDB dark tiles | Free, no key |
| Fire data | NASA FIRMS GOES-West | Free MAP_KEY, real satellite |
| Wind data | Open-Meteo | No key, no rate limits |
| Seismic data | USGS real-time GeoJSON | Free, no key, sub-30s |
| GPU | AMD MI300X, PyTorch ROCm | Free $100 credits, prize target |
| Agent | Palantir Foundry + AIP | Free dev tier, prize target |
| Voice | ElevenLabs Turbo v2.5 | Low latency, free tier ok |
| Design system | Google Stitch → DESIGN.md | Consistent tokens across all components |
| UI components | 21st.dev Magic MCP + shadcn/ui | Production-quality, DESIGN.md-compliant |
| Coder (all persons) | Claude Code (claude --dangerously-skip-permissions) | Unified toolchain |
| Simulate | Pre-computed Northridge 1994 JSON | Reliable demo, no live seismic needed |
| Deploy | Vercel (frontend) + Railway (backend) | Free tiers, Vercel prize credits |
| CORS | Env-var driven (`CORS_ORIGINS`) | Avoids hardcoded URLs; Railway var updated post-deploy |
| Vercel config dir | `--global-config ~/.vercel-cli-config` | macOS sandbox blocks writes to `~/Library/Application Support` |
| npm peer-deps | `.npmrc` `legacy-peer-deps=true` | eslint-plugin-react@7 needs eslint@^9, project uses eslint@10 |

## Production URLs
- Frontend: https://frontend-alpha-wheat-58.vercel.app
- Backend:  https://sentinel-production-639a.up.railway.app
- Health:   https://sentinel-production-639a.up.railway.app/health

## Design Tokens (from DESIGN.md — P3 owns)
- bg: #0a0e1a | surface: #111827 | border: #1f2937
- Threat: green #10b981 | amber #f59e0b | orange #f97316 | red #ef4444 | purple #8b5cf6
- Font: Inter (UI) | JetBrains Mono (counters/data)
- Card badges: deep red=reposition | purple=seismic alert | teal=ember dispatch | amber=evac

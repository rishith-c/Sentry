# SENTRY — GITHUB.md

## Branch → Role Map
| Branch | Owner | Purpose |
|--------|-------|---------|
| main | P1 | Stable, deployable. Never push directly. |
| p1/scaffold | P1 | Vite scaffold, routing, infra, northridge.js |
| p2/backend | P2 | FastAPI, SQLite, all Python routes |
| p3/ui | P3 | React UI, Leaflet, DESIGN.md, CLAUDE.md |
| p4/ai | P4 | Wildfire/seismic pipelines, AIP, ElevenLabs |

## Agent Rules
1. Claude Code handles ALL git operations — branch before any file touch
2. Commit format: [P1|P2|P3|P4] phase-N: short description
3. Push to your branch after every phase. Never push to main.
4. P1 merges all branches at Merge 1 (noon) and Merge 2 (3pm)
5. P1 checks PROGRESS.md — upstream phases must be ✅ DONE before merge
6. Resolve conflicts in feature branch before opening PR to main
7. After merge: post "Merge N complete. main is green." in group chat

## PR Template
Title: [Merge N] p{N}/{branch} → main
- Phases merged:
- Conflicts resolved: none / describe
- PROGRESS.md updated: yes

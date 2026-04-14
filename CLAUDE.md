# Project Context — SENTRY

## Design System
Always read DESIGN.md before generating or modifying any UI component.
Use only colors, fonts, and spacing values defined in DESIGN.md.
Never hardcode hex values — reference the design tokens by name.
All components must match the visual style defined in DESIGN.md.

## Stack
React + Tailwind CSS. shadcn/ui for base components. 21st.dev Magic MCP for premium UI (/ui command).

## Component Rules
- Dark theme throughout. No light mode.
- All text must be readable against dark backgrounds.
- Use JetBrains Mono (font-data) for all numeric counters and data values.
- Use Inter (font-ui) for all labels, headings, body text.
- No hardcoded hex color values anywhere in component files.
- Threat severity colors: green=nominal, amber=advisory, orange=warning, red=critical, purple=extreme.

## Action Card Schema
{ id, action_type, resource_id, zone_id, confidence, rationale, time_sensitivity, created_at }

## File Conventions
- Components: frontend/src/components/
- Tokens wired via Tailwind config referencing DESIGN.md values
- Every new component file starts with comment: // Read DESIGN.md and CLAUDE.md before modifying.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

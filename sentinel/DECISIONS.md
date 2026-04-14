# Architectural Decisions
_Log decisions here as they are made._

P4-1 AIP PROMPT DESIGN DECISIONS:
- JSON-only enforced as first line of system prompt
- All zones pre-filtered before agent call; agent does not re-evaluate thresholds
- Greedy dispatch: nearest standby crew by Euclidean distance, one crew per zone, tie-break on capacity
- Rationale: active voice, crew_identifier + zone id + probability %, 2 sentences, <50 words
- Output sorted: time_sensitivity (immediate→high→medium), then confidence descending
- Evacuation triggered by DamageZone + matching EvacRoute; blocked routes force immediate sensitivity

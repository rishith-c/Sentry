"""AIP agent loop: HuggingFace LLM → Palantir AIP fallback → rule-based fallback."""

import json
import logging
import math
import os
import re
import time

import requests

from backend.ai.prompt import AIP_SYSTEM_PROMPT, format_agent_input

logger = logging.getLogger(__name__)

_REQUIRED_ACTION_FIELDS = frozenset(
    ["action_type", "resource_id", "zone_id", "confidence", "time_sensitivity", "rationale"]
)

_AIP_RATE_LIMIT_S = 5.0
_last_aip_call: float = 0.0


def run_aip_loop(
    ember_zones: list[dict],
    damage_zones: list[dict],
    crews: list[dict],
    shelters: list[dict],
    hospitals: list[dict],
    routes: list[dict],
) -> list[dict]:
    """Run full AIP reasoning loop with rule-based fallback.

    Tries the Palantir AIP Agent Studio endpoint first. Falls back to a local
    rule-based dispatcher when env vars are not set or the API call fails.

    Returns:
        List of action dicts: action_type, resource_id, zone_id, confidence,
        time_sensitivity, rationale.
    """
    formatted_input = format_agent_input(
        ember_zones, damage_zones, crews, shelters, hospitals, routes
    )

    # 1. Try HuggingFace LLM (primary — always available with HF_TOKEN)
    try:
        actions = _call_hf_llm(formatted_input)
        if actions:
            logger.info("HF LLM returned %d actions", len(actions))
            return actions
    except Exception as exc:
        logger.warning("HF LLM failed: %s — trying Palantir AIP", exc)

    # 2. Try Palantir AIP Agent Studio (secondary)
    try:
        actions = _call_aip_api(formatted_input)
        if actions:
            logger.info("AIP API returned %d actions", len(actions))
            return actions
    except Exception as exc:
        logger.warning("AIP API failed: %s — falling back to rule-based dispatch", exc)

    # 3. Rule-based fallback (always works)
    actions = _fallback_rule_based_dispatch(ember_zones, damage_zones, crews, shelters, hospitals, routes)
    logger.info("Fallback dispatch generated %d actions", len(actions))
    return actions


def _call_hf_llm(formatted_input: str) -> list[dict]:
    """Generate action plan using HuggingFace text generation models."""
    global _last_aip_call  # noqa: PLW0603
    now = time.time()
    since_last = now - _last_aip_call
    if since_last < _AIP_RATE_LIMIT_S:
        remaining = _AIP_RATE_LIMIT_S - since_last
        raise ValueError(f"Rate limit: {remaining:.1f}s remaining")
    _last_aip_call = now

    from backend.ai.hf_inference import generate_aip_actions
    actions = generate_aip_actions(AIP_SYSTEM_PROMPT, formatted_input)
    return _parse_and_validate_actions(json.dumps(actions)) if actions else []


def _call_aip_api(formatted_input: str) -> list[dict]:
    """Call Palantir AIP Agent Studio and return validated actions."""
    global _last_aip_call  # noqa: PLW0603
    now = time.time()
    since_last = now - _last_aip_call
    if since_last < _AIP_RATE_LIMIT_S:
        remaining = _AIP_RATE_LIMIT_S - since_last
        raise ValueError(f"AIP rate limit: {remaining:.1f}s remaining")
    _last_aip_call = now

    palantir_url = os.getenv("PALANTIR_FOUNDRY_URL", "")
    agent_id = os.getenv("PALANTIR_AIP_AGENT_ID", "")
    api_token = os.getenv("PALANTIR_API_TOKEN", "")

    if not palantir_url or not agent_id or not api_token:
        raise ValueError("PALANTIR_FOUNDRY_URL, PALANTIR_AIP_AGENT_ID, or PALANTIR_API_TOKEN not set")

    endpoint = f"{palantir_url}/api/v2/agents/{agent_id}/query"
    payload = {
        "system": AIP_SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": formatted_input}],
    }
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }

    response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
    response.raise_for_status()

    response_text = response.json().get("content", "")
    return _parse_and_validate_actions(response_text)


def _parse_and_validate_actions(response_text: str) -> list[dict]:
    """Extract a JSON array from the response text and validate each action."""
    text = response_text.strip()
    if not text.startswith("["):
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            raise ValueError("No JSON array found in AIP response")
        text = match.group(0)

    try:
        actions = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse AIP response as JSON: %s", exc)
        raise

    validated = []
    for action in actions:
        if _REQUIRED_ACTION_FIELDS.issubset(action.keys()):
            validated.append(action)
        else:
            missing = _REQUIRED_ACTION_FIELDS - action.keys()
            logger.warning("Dropped action missing fields %s: %s", missing, action)

    return validated


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute great-circle distance in km between two WGS84 points."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return r * 2 * math.asin(math.sqrt(a))


def _fallback_rule_based_dispatch(
    ember_zones: list[dict],
    damage_zones: list[dict],
    crews: list[dict],
    shelters: list[dict],
    hospitals: list[dict],
    routes: list[dict],
) -> list[dict]:
    """Local rule-based action plan when Palantir API is unavailable.

    Mirrors the AIP system prompt logic:
    - DISPATCH: ember zones (probability > 0.65) → closest standby crew
    - ALERT: damage zones (damage_probability > 0.70) → matching shelters + hospitals
    - ALERT: damage zones (damage_probability > 0.70) → matching routes
    - REPOSITION: crews inside a high-damage zone
    """
    actions: list[dict] = []
    assigned_crews: set[str] = set()

    # --- DISPATCH (ember) ---
    for zone in ember_zones:
        prob = zone.get("probability", 0.0)
        if prob <= 0.65:
            continue

        zone_lat, zone_lng = zone.get("lat", 0.0), zone.get("lng", 0.0)
        zone_id = zone.get("id", "?")

        # Skip if a crew is already assigned to this zone
        already_covered = any(
            c.get("assigned_zone_id") == zone_id for c in crews
        )
        if already_covered:
            continue

        best_crew, best_dist = None, float("inf")
        for crew in crews:
            if crew.get("status") != "standby":
                continue
            if crew["id"] in assigned_crews:
                continue
            dist = _haversine_km(zone_lat, zone_lng, crew["lat"], crew["lng"])
            if dist < best_dist:
                best_dist, best_crew = dist, crew

        if best_crew:
            assigned_crews.add(best_crew["id"])
            actions.append({
                "action_type": "dispatch",
                "resource_id": best_crew["id"],
                "zone_id": zone_id,
                "confidence": round(prob, 3),
                "time_sensitivity": "immediate",
                "rationale": (
                    f"Ember zone {zone_id} at {prob*100:.0f}% probability. "
                    f"Crew {best_crew.get('crew_identifier', best_crew['id'])} "
                    f"nearest at {best_dist:.1f} km; no crew assigned."
                ),
            })

    # --- ALERT shelters + hospitals (damage) ---
    high_damage = [z for z in damage_zones if z.get("damage_probability", 0) > 0.70]

    for zone in high_damage:
        zone_id = zone.get("id", "?")
        damage_prob = zone.get("damage_probability", 0.0)

        for shelter in shelters:
            if shelter.get("damage_zone_id") == zone_id:
                actions.append({
                    "action_type": "alert",
                    "resource_id": shelter["id"],
                    "zone_id": zone_id,
                    "confidence": round(damage_prob, 3),
                    "time_sensitivity": "high",
                    "rationale": (
                        f"Damage zone {zone_id} at {damage_prob*100:.0f}% probability. "
                        f"Alert shelter {shelter.get('name', shelter['id'])}."
                    ),
                })

        for hospital in hospitals:
            if hospital.get("damage_zone_id") == zone_id:
                actions.append({
                    "action_type": "alert",
                    "resource_id": hospital["id"],
                    "zone_id": zone_id,
                    "confidence": round(damage_prob, 3),
                    "time_sensitivity": "high",
                    "rationale": (
                        f"Damage zone {zone_id} at {damage_prob*100:.0f}% probability. "
                        f"Alert hospital {hospital.get('name', hospital['id'])}."
                    ),
                })

        # --- ALERT evacuation routes ---
        for route in routes:
            if route.get("origin_zone_id") == zone_id or route.get("destination_zone_id") == zone_id:
                actions.append({
                    "action_type": "alert",
                    "resource_id": route["id"],
                    "zone_id": zone_id,
                    "confidence": round(damage_prob, 3),
                    "time_sensitivity": "high",
                    "rationale": (
                        f"Damage zone {zone_id} at {damage_prob*100:.0f}%. "
                        f"Route {route['id']} intersects zone."
                    ),
                })

    # --- REPOSITION crews in high-damage zones ---
    for crew in crews:
        crew_lat, crew_lng = crew.get("lat", 0.0), crew.get("lng", 0.0)
        for zone in high_damage:
            zone_lat, zone_lng = zone.get("lat", 0.0), zone.get("lng", 0.0)
            dist = _haversine_km(crew_lat, crew_lng, zone_lat, zone_lng)
            if dist < 2.0:  # within 2 km = inside zone
                actions.append({
                    "action_type": "reposition",
                    "resource_id": crew["id"],
                    "zone_id": zone.get("id", "?"),
                    "confidence": 0.6,
                    "time_sensitivity": "medium",
                    "rationale": (
                        f"Crew {crew.get('crew_identifier', crew['id'])} inside "
                        f"damage zone {zone.get('id', '?')} "
                        f"({zone.get('damage_probability', 0)*100:.0f}% damage). Reposition."
                    ),
                })
                break  # one reposition action per crew

    # Sort: immediate → high → medium, then confidence descending
    _order = {"immediate": 0, "high": 1, "medium": 2}
    actions.sort(key=lambda a: (_order.get(a["time_sensitivity"], 9), -a["confidence"]))

    return actions

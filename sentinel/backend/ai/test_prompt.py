"""Self-contained smoke tests for prompt builder functions."""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from prompt import (
    build_threat_assessment_prompt,
    build_resource_matching_prompt,
    build_action_generation_prompt,
    build_closest_unit_prompt,
)


EMBER_ZONES = [
    {"zone_id": "E1", "probability": 0.72, "last_updated_iso": "2026-04-11T10:00:00Z"},
    {"zone_id": "E2", "probability": 0.61, "last_updated_iso": "2026-04-11T10:05:00Z"},
]

DAMAGE_ZONES = [
    {"zone_id": "D1", "probability": 0.85, "has_civilians": True, "last_updated_iso": "2026-04-11T10:00:00Z"},
    {"zone_id": "D2", "probability": 0.66, "has_civilians": False, "last_updated_iso": "2026-04-11T10:02:00Z"},
]

FLAGGED_ZONES = [
    {"zone_id": "E1", "zone_type": "ember", "probability": 0.72, "has_civilians": False, "approaching": False, "last_updated_iso": "2026-04-11T10:00:00Z"},
    {"zone_id": "D1", "zone_type": "damage", "probability": 0.85, "has_civilians": True, "approaching": False, "last_updated_iso": "2026-04-11T10:00:00Z"},
]

CREWS = [
    {
        "crew_id": "C1", "status": "standby", "current_zone_id": "Z0",
        "capacity_remaining": 10, "lat": 34.0, "lon": -118.0,
        "travel_times": {"E1": 300, "D1": 600},
    },
    {
        "crew_id": "C2", "status": "active", "current_zone_id": "D1",
        "capacity_remaining": 5, "lat": 34.1, "lon": -118.1,
        "travel_times": {"E1": 900, "D1": 100},
    },
]

SHELTERS = [{"shelter_id": "S1", "zone_id": "Z0", "capacity_remaining": 50}]
HOSPITALS = [{"hospital_id": "H1", "zone_id": "Z0", "capacity_remaining": 20}]

ZONE = {"zone_id": "D1", "zone_type": "damage", "probability": 0.85, "has_civilians": True, "approaching": False}
ASSIGNMENT = {"zone_id": "D1", "assigned_crew_id": "C2", "travel_time_seconds": 100, "reposition_candidate": False, "nearest_standby_id": None}

ASSIGNED_CREW = {
    "crew_id": "C2", "status": "active", "current_zone_id": "D1",
    "capacity_remaining": 5, "lat": 34.1, "lon": -118.1,
    "travel_times": {"E1": 900, "D1": 800},
}
STANDBY_CREWS = [
    {
        "crew_id": "C1", "status": "standby", "current_zone_id": "Z0",
        "capacity_remaining": 10, "lat": 34.0, "lon": -118.0,
        "travel_times": {"E1": 300, "D1": 200},
    },
]


def run_test(name: str, fn, *args) -> bool:
    try:
        result = fn(*args)
        assert isinstance(result, str) and len(result) > 0, "Output must be a non-empty string"
        assert "JSON" in result, "Output must contain the word 'JSON'"
        print(f"PASS  {name}")
        print(f"  (length={len(result)})\n")
        return True
    except Exception as exc:
        print(f"FAIL  {name}: {exc}\n")
        return False


if __name__ == "__main__":
    results = [
        run_test("build_threat_assessment_prompt", build_threat_assessment_prompt, EMBER_ZONES, DAMAGE_ZONES),
        run_test("build_resource_matching_prompt", build_resource_matching_prompt, FLAGGED_ZONES, CREWS, SHELTERS, HOSPITALS),
        run_test("build_action_generation_prompt", build_action_generation_prompt, ZONE, ASSIGNMENT, 0.90, 3.5),
        run_test("build_closest_unit_prompt", build_closest_unit_prompt, "D1", ASSIGNED_CREW, STANDBY_CREWS),
    ]

    passed = sum(results)
    total = len(results)
    print(f"\n{'='*40}")
    print(f"Results: {passed}/{total} passed")

    if passed < total:
        sys.exit(1)

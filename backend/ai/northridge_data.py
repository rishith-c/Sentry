"""Precomputed Northridge 1994 damage grid for demo and frontend use.

Generated via: run_damage_pipeline({'lat':34.213,'lng':-118.537,'magnitude':6.7,'depth':17.0})
"""

import logging

from backend.ai.damage_model import run_damage_pipeline

logger = logging.getLogger(__name__)

_NORTHRIDGE_EVENT = {
    "magnitude": 6.7,
    "depth": 17.0,
    "lat": 34.213,
    "lng": -118.537,
}


def generate_northridge_grid() -> list[dict]:
    """Compute and return the Northridge 1994 damage grid."""
    return run_damage_pipeline(_NORTHRIDGE_EVENT)


# Precomputed at module load time for fast access
NORTHRIDGE_GRID: list[dict] = generate_northridge_grid()


def verify_northridge_grid() -> dict:
    """Verify the Northridge grid has expected characteristics.

    Returns:
        Dict with 'passed' bool, 'cell_count', 'cells_above_70', and 'details'.
    """
    cell_count = len(NORTHRIDGE_GRID)
    cells_above_70 = sum(1 for c in NORTHRIDGE_GRID if c.get("damage_probability", 0) > 0.70)
    cells_above_50 = sum(1 for c in NORTHRIDGE_GRID if c.get("damage_probability", 0) > 0.50)

    # M6.7 at 17km depth should produce 1000+ cells above 0.05 threshold
    # and at least 10 cells above 0.70
    passed = cell_count >= 1000 and cells_above_70 >= 10

    details = (
        f"Northridge grid: {cell_count} total cells, "
        f"{cells_above_70} above 0.70, {cells_above_50} above 0.50"
    )
    logger.info("[NORTHRIDGE] %s (verified=%s)", details, passed)
    return {
        "passed": passed,
        "cell_count": cell_count,
        "cells_above_70": cells_above_70,
        "cells_above_50": cells_above_50,
        "details": details,
    }


# Verify at module load
_NORTHRIDGE_VERIFICATION: dict = verify_northridge_grid()


if __name__ == "__main__":
    import json
    import os

    grid_json = json.dumps(NORTHRIDGE_GRID, indent=2)

    print(f"Generated {len(NORTHRIDGE_GRID)} cells")

    output_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "frontend", "src", "constants", "northridgeGrid.js"
    )
    output_path = os.path.normpath(output_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w") as f:
        f.write(f"export const NORTHRIDGE_GRID = {grid_json};\n")

    print(f"Saved to {output_path}")

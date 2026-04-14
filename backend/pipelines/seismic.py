"""Seismic event processing pipeline.

Orchestrates: USGS ingestion -> CNN inference -> GMPE damage model -> AIP actions -> broadcast.
"""

import logging
from datetime import datetime, timezone

from backend.db import get_connection
from backend.services.benchmark_logger import log_benchmark

logger = logging.getLogger(__name__)


async def process_seismic_event(event_data: dict) -> dict:
    """Full seismic pipeline: ingest event, compute damage, generate actions.

    Args:
        event_data: dict with magnitude, depth, lat, lng, usgs_event_id

    Returns:
        Summary dict with event_id, damage_zones count, actions count.
    """
    import time
    t0 = time.perf_counter()

    magnitude = event_data.get("magnitude", 0)
    depth = event_data.get("depth", 10)
    lat = event_data.get("lat", 0)
    lng = event_data.get("lng", 0)
    usgs_event_id = event_data.get("usgs_event_id", "manual")

    conn = get_connection()
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    cur.execute(
        """INSERT OR IGNORE INTO seismic_events
        (usgs_event_id, magnitude, depth, lat, lng, detected_at)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (usgs_event_id, magnitude, depth, lat, lng, now),
    )
    conn.commit()
    event_id = cur.lastrowid

    # CNN magnitude refinement
    refined_magnitude = magnitude
    try:
        from backend.ai.seismic_cnn import predict_magnitude
        refined_magnitude = predict_magnitude(lat, lng, depth)
        logger.info("[SENTRY] CNN refined magnitude: %.2f -> %.2f", magnitude, refined_magnitude)
    except Exception as e:
        logger.warning("[SENTRY] CNN unavailable, using raw magnitude: %s", e)

    # GMPE damage model
    damage_zones = []
    try:
        from backend.ai.damage_model import compute_damage_grid
        damage_zones = compute_damage_grid(refined_magnitude, depth, lat, lng)
        for zone in damage_zones:
            cur.execute(
                """INSERT INTO damage_zones
                (event_id, grid_cell_id, lat, lng, damage_probability, soil_type, liquefaction_class, computed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (event_id, zone["cell_id"], zone["lat"], zone["lng"],
                 zone["damage_prob"], zone.get("soil_type", "unknown"),
                 zone.get("liquefaction_class", "none"), now),
            )
        conn.commit()
    except Exception as e:
        logger.error("[SENTRY] Damage model failed: %s", e)

    # AIP action generation
    action_count = 0
    try:
        from backend.ai.aip_agent import run_aip_loop
        actions = await run_aip_loop()
        action_count = len(actions) if actions else 0
    except Exception as e:
        logger.warning("[SENTRY] AIP agent failed: %s", e)

    conn.close()

    elapsed_ms = (time.perf_counter() - t0) * 1000
    log_benchmark({"pipeline": "seismic_pipeline", "latency_ms": elapsed_ms, "magnitude": refined_magnitude})

    summary = {
        "event_id": event_id,
        "magnitude": refined_magnitude,
        "damage_zones": len(damage_zones),
        "actions_generated": action_count,
        "latency_ms": round(elapsed_ms, 1),
    }
    logger.info("[SENTRY] Seismic pipeline complete: %s", summary)
    return summary

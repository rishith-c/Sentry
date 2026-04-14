"""Multi-hazard coordination pipeline.

Orchestrates cross-pipeline decisions: seismic + wildfire + weather -> unified action plan.
"""

import logging
from datetime import datetime, timezone

from backend.db import get_connection
from backend.services.benchmark_logger import log_benchmark

logger = logging.getLogger(__name__)


async def run_coordination_cycle() -> dict:
    """Run a coordination cycle across all active hazards.

    Reads current state of seismic events, fire hotspots, ember zones,
    and resource positions to generate unified action cards.

    Returns:
        Summary dict with counts of each resource type and threat level.
    """
    import time
    t0 = time.perf_counter()

    conn = get_connection()

    active_hotspots = conn.execute(
        "SELECT COUNT(*) as c FROM hotspots WHERE detected_at > datetime('now', '-5 minutes')"
    ).fetchone()["c"]

    active_quakes = conn.execute(
        "SELECT COUNT(*) as c FROM seismic_events WHERE detected_at > datetime('now', '-1 hour')"
    ).fetchone()["c"]

    high_risk_zones = conn.execute(
        "SELECT COUNT(*) as c FROM damage_zones WHERE damage_probability > 0.7"
    ).fetchone()["c"]

    deployed_crews = conn.execute(
        "SELECT COUNT(*) as c FROM suppression_crews WHERE status = 'active'"
    ).fetchone()["c"]

    total_crews = conn.execute(
        "SELECT COUNT(*) as c FROM suppression_crews"
    ).fetchone()["c"]

    shelter_load = conn.execute(
        "SELECT COALESCE(SUM(occupancy), 0) as total_occ, COALESCE(SUM(capacity), 0) as total_cap FROM shelters"
    ).fetchone()

    hospital_alerts = conn.execute(
        "SELECT COUNT(*) as c FROM hospitals WHERE alert_level != 'normal'"
    ).fetchone()["c"]

    pending_actions = conn.execute(
        "SELECT COUNT(*) as c FROM aip_actions WHERE status = 'pending'"
    ).fetchone()["c"]

    conn.close()

    # Determine threat level
    if active_quakes > 0 and active_hotspots > 0:
        threat_level = "compound"
    elif high_risk_zones > 3:
        threat_level = "critical"
    elif active_hotspots > 5 or active_quakes > 2:
        threat_level = "elevated"
    else:
        threat_level = "nominal"

    elapsed_ms = (time.perf_counter() - t0) * 1000
    log_benchmark({"pipeline": "coordination", "latency_ms": elapsed_ms})

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "threat_level": threat_level,
        "active_hotspots": active_hotspots,
        "active_quakes": active_quakes,
        "high_risk_zones": high_risk_zones,
        "deployed_crews": deployed_crews,
        "total_crews": total_crews,
        "shelter_occupancy": shelter_load["total_occ"],
        "shelter_capacity": shelter_load["total_cap"],
        "hospital_alerts": hospital_alerts,
        "pending_actions": pending_actions,
        "latency_ms": round(elapsed_ms, 1),
    }
    logger.info("[SENTRY] Coordination cycle: threat=%s", threat_level)
    return summary

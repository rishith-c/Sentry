"""USGS seismic event poller: fetch → CNN → damage pipeline → HF risk assessment → AIP → DB → broadcast."""

import asyncio
import logging
import os

import aiosqlite
import numpy as np

from backend.ai.aip_agent import run_aip_loop
from backend.ai.damage_model import run_damage_pipeline
from backend.ai.seismic_cnn import run_inference
from backend.services.palantir_client import write_aip_action, write_damage_zone
from backend.services.ws_broadcaster import broadcast_action_created, broadcast_damage_grid, broadcast_event_log

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "sentry.db")


async def process_seismic_event(event_data: dict) -> dict:
    """Process USGS seismic event: CNN → damage → AIP → DB → Ontology → broadcast.

    Args:
        event_data: dict with id, magnitude, depth_km, lat, lng.

    Returns:
        Summary dict: {'damage_zones': int, 'actions': int}.
    """
    event = {
        "id": event_data["id"],
        "magnitude": event_data["magnitude"],
        "depth": event_data["depth_km"],
        "lat": event_data["lat"],
        "lng": event_data["lng"],
    }

    # 1. CNN inference benchmark
    synthetic_waveform = np.random.randn(3, 500).astype(np.float32)
    magnitude_estimated = run_inference(synthetic_waveform)
    logger.info("CNN inference: %.2f (benchmark logged)", magnitude_estimated)

    # 2. GMPE damage pipeline
    damage_cells = run_damage_pipeline(event)
    logger.info("Damage pipeline: %d cells above 0.05 threshold", len(damage_cells))

    damage_zones: list[dict] = []
    for i, cell in enumerate(damage_cells):
        zone = {
            "id": f"DAMAGE_{event['id']}_{i}",
            "lat": cell["lat"],
            "lng": cell["lng"],
            "damage_probability": cell["damage_probability"],
            "liquefaction_class": cell["liquefaction_class"],
            "event_id": event["id"],
        }
        damage_zones.append(zone)
        await write_damage_zone(zone)

    async with aiosqlite.connect(DB_PATH) as db:
        for zone in damage_zones:
            await db.execute(
                """INSERT OR REPLACE INTO damage_zones
                   (id, lat, lng, damage_probability, liquefaction_class, event_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (zone["id"], zone["lat"], zone["lng"],
                 zone["damage_probability"], zone["liquefaction_class"], zone["event_id"]),
            )
        await db.commit()

    await broadcast_damage_grid(damage_cells)

    # 2b. HuggingFace seismic risk assessment (non-blocking)
    asyncio.create_task(_hf_risk_assessment(event, damage_zones))

    # 3. Fetch supporting data from DB for AIP loop
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        crews = [dict(r) for r in await (await db.execute(
            "SELECT id, crew_identifier, lat, lng, status, capacity, assigned_zone_id FROM suppression_crews"
        )).fetchall()]
        shelters = [dict(r) for r in await (await db.execute(
            "SELECT id, name, lat, lng, occupancy, capacity, damage_zone_id FROM shelters"
        )).fetchall()]
        hospitals = [dict(r) for r in await (await db.execute(
            "SELECT id, name, lat, lng, current_capacity, alert_level, damage_zone_id FROM hospitals"
        )).fetchall()]
        routes = [dict(r) for r in await (await db.execute(
            "SELECT id, status, origin_zone_id, destination_zone_id FROM evacuation_routes"
        )).fetchall()]
        ember_zones = [dict(r) for r in await (await db.execute(
            "SELECT id, lat, lng, probability, hotspot_id FROM ember_risk_zones ORDER BY rowid DESC LIMIT 100"
        )).fetchall()]

    # 4. AIP loop
    actions = run_aip_loop(ember_zones, damage_zones, crews, shelters, hospitals, routes)
    logger.info("AIP loop: %d actions generated", len(actions))

    async with aiosqlite.connect(DB_PATH) as db:
        # Fetch recent actions (10-second dedup window)
        recent_cursor = await db.execute(
            """SELECT action_type, resource_id FROM aip_actions
               WHERE created_at > datetime('now', '-10 seconds')"""
        )
        recent_keys = {(r[0], r[1]) for r in await recent_cursor.fetchall()}

        for action in actions:
            dedup_key = (action["action_type"], action["resource_id"])
            if dedup_key in recent_keys:
                logger.info(
                    "Skipping duplicate action %s/%s (10s dedup window)",
                    action["action_type"], action["resource_id"],
                )
                continue

            cursor = await db.execute(
                """INSERT INTO aip_actions
                   (action_type, resource_id, zone_id, confidence, time_sensitivity, rationale)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (action["action_type"], action["resource_id"], action["zone_id"],
                 action["confidence"], action["time_sensitivity"], action["rationale"]),
            )
            await db.commit()
            row_id = cursor.lastrowid
            recent_keys.add(dedup_key)
            await write_aip_action({**action, "id": row_id})
            await broadcast_action_created({**action, "id": row_id})
            # Fire-and-forget audio synthesis (doesn't block action broadcast)
            asyncio.create_task(_synthesize_and_cache(row_id, action.get("rationale", "")))

    return {"damage_zones": len(damage_zones), "actions": len(actions)}


async def _hf_risk_assessment(event: dict, damage_zones: list[dict]) -> None:
    """Generate HF-powered seismic risk assessment and broadcast to frontend (fire-and-forget)."""
    try:
        from backend.ai.hf_inference import assess_seismic_risk
        assessment = assess_seismic_risk(event, damage_zones)
        if assessment:
            await broadcast_event_log(
                f"[SENTRY AI] Seismic risk assessment — M{event.get('magnitude', 0)}: {assessment}"
            )
            logger.info("HF seismic risk assessment generated for event %s", event.get("id"))
    except Exception as exc:
        logger.warning("HF risk assessment failed (non-critical): %s", exc)


async def _synthesize_and_cache(action_id: int, rationale: str) -> None:
    """Synthesize speech for action rationale and cache to DB (fire-and-forget)."""
    from backend.ai.elevenlabs_client import synthesize_speech

    try:
        audio_bytes = synthesize_speech(rationale)
        if not audio_bytes:
            return
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE aip_actions SET audio_cache = ? WHERE id = ?",
                (audio_bytes, action_id),
            )
            await db.commit()
        logger.info("Audio cached for action %d: %d bytes", action_id, len(audio_bytes))
    except Exception as exc:
        logger.error("Error synthesizing audio for action %d: %s", action_id, exc)

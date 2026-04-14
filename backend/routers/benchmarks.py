"""FastAPI router for pipeline benchmark metrics."""

import logging
from typing import Optional

from fastapi import APIRouter, Query

from backend.services.benchmark_logger import get_benchmarks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


@router.get("")
async def list_benchmarks(
    pipeline: Optional[str] = Query(default=None, description="Filter by pipeline name"),
    limit: int = Query(default=10, ge=1, le=100, description="Max entries to return"),
) -> list[dict]:
    """Return recent benchmark entries, optionally filtered by pipeline.

    Query params:
        pipeline: optional pipeline name (seismic_cnn, damage_model, ember_simulation, elevenlabs_tts)
        limit: max entries (1-100, default 10)
    """
    return get_benchmarks(pipeline=pipeline, limit=limit)

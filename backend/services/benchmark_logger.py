"""In-memory circular benchmark logger for AI pipeline performance tracking."""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

_MAX_ENTRIES_PER_PIPELINE = 50
_benchmarks: dict[str, list[dict[str, Any]]] = {}


def log_benchmark(entry: dict[str, Any]) -> None:
    """Append a benchmark entry to the in-memory buffer and log it.

    Args:
        entry: dict with at least 'pipeline' key plus timing/result fields.
    """
    pipeline = entry.get("pipeline", "unknown")
    entry = {**entry, "timestamp": datetime.now(timezone.utc).isoformat()}

    buf = _benchmarks.setdefault(pipeline, [])
    buf.append(entry)
    if len(buf) > _MAX_ENTRIES_PER_PIPELINE:
        _benchmarks[pipeline] = buf[-_MAX_ENTRIES_PER_PIPELINE:]

    logger.info("BENCHMARK: %s", json.dumps(entry))


def get_benchmarks(pipeline: Optional[str] = None, limit: int = 10) -> list[dict[str, Any]]:
    """Retrieve recent benchmark entries.

    Args:
        pipeline: optional filter by pipeline name.
        limit: maximum number of entries to return.

    Returns:
        List of benchmark dicts, most recent first.
    """
    if pipeline:
        entries = list(_benchmarks.get(pipeline, []))
    else:
        entries = [e for buf in _benchmarks.values() for e in buf]
        entries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return entries[-limit:]


def clear_benchmarks() -> None:
    """Clear all in-memory benchmark entries."""
    _benchmarks.clear()

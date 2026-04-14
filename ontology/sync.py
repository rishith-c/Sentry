"""
Palantir Foundry Ontology sync client for AMD ML platform.

Requires:
    foundry-platform-sdk>=1.70.0
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import time
from typing import Any

import foundry
from foundry import FoundryClient
from foundry.v2.ontologies import OntologiesClient  # noqa: F401 — imported for type completeness

logger = logging.getLogger(__name__)


class OptimisticLockError(Exception):
    """Raised when a write is rejected due to _version conflict (HTTP 409)."""

    def __init__(self, object_type: str, primary_key: str, expected_version: int) -> None:
        self.object_type = object_type
        self.primary_key = primary_key
        self.expected_version = expected_version
        super().__init__(
            f"Version conflict for {object_type}:{primary_key} "
            f"(expected _version={expected_version})"
        )


class OntologyClient:
    """Wraps the Foundry SDK for AMD ML platform ontology operations."""

    ONTOLOGY_RID = os.getenv("FOUNDRY_ONTOLOGY_RID", "ri.ontology.main.ontology.amd-ml")
    BATCH_SIZE = 500
    RETRY_BASE_DELAY = 1.0
    RETRY_MULTIPLIER = 2.0
    RETRY_MAX_DELAY = 60.0
    RETRY_JITTER = 0.20
    RETRY_MAX_ATTEMPTS = 10

    def __init__(self) -> None:
        base_url = os.environ["FOUNDRY_URL"]
        token = os.environ["FOUNDRY_TOKEN"]
        self._client = FoundryClient(
            auth=foundry.UserTokenAuth(token=token),
            hostname=base_url,
        )

    # ------------------------------------------------------------------ #
    # Generic CRUD
    # ------------------------------------------------------------------ #

    def get_object(self, object_type: str, primary_key: str) -> dict[str, Any]:
        """Fetch a single object by type and primary key.

        Returns the object as a plain dict. Raises KeyError if not found.
        """
        try:
            result = self._client.ontologies.objects.get(
                ontology_rid=self.ONTOLOGY_RID,
                object_type=object_type,
                primary_key=primary_key,
            )
            return result.as_dict()
        except Exception as exc:
            # Foundry SDK raises various exception types for 404; catch broadly
            # and re-raise as KeyError with a useful message.
            exc_str = str(exc).lower()
            if "not found" in exc_str or "404" in exc_str or "does not exist" in exc_str:
                raise KeyError(
                    f"Object not found in ontology: type={object_type!r}, "
                    f"primary_key={primary_key!r}"
                ) from exc
            raise

    def write_object(self, object_type: str, object_dict: dict[str, Any]) -> None:
        """Write (upsert) a single object to the ontology with optimistic locking.

        Fetches the current _version, increments it, embeds it in object_dict,
        then calls put(). Raises OptimisticLockError on HTTP 409 version conflict.
        """
        # Determine primary key field by inspecting the object dict for common PK patterns.
        # We rely on the caller having set it; we just need the value for logging.
        primary_key_value: str = (
            object_dict.get("node_id")
            or object_dict.get("device_id")
            or object_dict.get("cluster_id")
            or object_dict.get("namespace_id")
            or object_dict.get("pod_id")
            or object_dict.get("model_id")
            or object_dict.get("run_id")
            or object_dict.get("eval_id")
            or object_dict.get("alert_id")
            or object_dict.get("incident_id")
            or object_dict.get("pipeline_id")
            or object_dict.get("dataset_rid")
            or object_dict.get("report_id")
            or "<unknown>"
        )

        # Attempt to read current version for optimistic locking.
        current_version = 0
        try:
            existing = self.get_object(object_type, primary_key_value)
            current_version = int(existing.get("_version", 0))
        except KeyError:
            # Object does not yet exist; treat as version 0 → will become 1.
            current_version = 0

        new_version = current_version + 1
        object_dict["_version"] = new_version

        logger.debug(
            "Writing object: type=%s pk=%s _version=%s",
            object_type,
            primary_key_value,
            new_version,
        )

        try:
            self._client.ontologies.objects.put(
                ontology_rid=self.ONTOLOGY_RID,
                object_type=object_type,
                primary_key=primary_key_value,
                body=object_dict,
            )
        except Exception as exc:
            exc_str = str(exc)
            if "409" in exc_str or "conflict" in exc_str.lower() or "version" in exc_str.lower():
                raise OptimisticLockError(
                    object_type=object_type,
                    primary_key=primary_key_value,
                    expected_version=new_version,
                ) from exc
            raise

    def batch_write_objects(
        self, object_type: str, objects_list: list[dict[str, Any]]
    ) -> None:
        """Write a list of objects in batches, with retry logic for HTTP 429.

        Splits objects_list into chunks of BATCH_SIZE. For each chunk, attempts
        to call batch_put(). On HTTP 429 (rate limit), retries the entire chunk
        using exponential backoff with jitter up to RETRY_MAX_ATTEMPTS times.
        """
        total = len(objects_list)
        chunk_size = self.BATCH_SIZE

        # Divide into chunks.
        chunks: list[list[dict[str, Any]]] = []
        for start in range(0, total, chunk_size):
            chunks.append(objects_list[start : start + chunk_size])

        for chunk_index, chunk in enumerate(chunks):
            attempt = 0
            while True:
                try:
                    self._client.ontologies.objects.batch_put(
                        ontology_rid=self.ONTOLOGY_RID,
                        object_type=object_type,
                        objects=chunk,
                    )
                    logger.debug(
                        "batch_put succeeded: type=%s chunk=%d/%d size=%d",
                        object_type,
                        chunk_index + 1,
                        len(chunks),
                        len(chunk),
                    )
                    break  # Success — move to next chunk.

                except Exception as exc:
                    exc_str = str(exc)
                    is_rate_limit = (
                        "429" in exc_str
                        or "rate limit" in exc_str.lower()
                        or "too many requests" in exc_str.lower()
                    )

                    if not is_rate_limit:
                        # Non-retriable error — log and re-raise immediately.
                        logger.error(
                            "batch_put failed (non-retriable): type=%s chunk_size=%d attempt=%d error=%s",
                            object_type,
                            len(chunk),
                            attempt + 1,
                            exc_str,
                        )
                        raise

                    attempt += 1
                    if attempt >= self.RETRY_MAX_ATTEMPTS:
                        logger.error(
                            "batch_put exceeded max retries: type=%s chunk_size=%d attempts=%d error=%s",
                            object_type,
                            len(chunk),
                            attempt,
                            exc_str,
                        )
                        raise

                    # Exponential backoff with jitter.
                    base_delay = min(
                        self.RETRY_BASE_DELAY * (self.RETRY_MULTIPLIER ** (attempt - 1)),
                        self.RETRY_MAX_DELAY,
                    )
                    jitter_factor = random.uniform(
                        1.0 - self.RETRY_JITTER, 1.0 + self.RETRY_JITTER
                    )
                    delay = base_delay * jitter_factor

                    logger.warning(
                        "batch_put rate-limited (429): type=%s chunk_size=%d attempt=%d/%d "
                        "retrying in %.2fs error=%s",
                        object_type,
                        len(chunk),
                        attempt,
                        self.RETRY_MAX_ATTEMPTS,
                        delay,
                        exc_str,
                    )
                    time.sleep(delay)

    # ------------------------------------------------------------------ #
    # Domain-specific sync helpers
    # ------------------------------------------------------------------ #

    def sync_compute_nodes(self, nodes: list[dict[str, Any]]) -> None:
        """Sync a list of ComputeNode objects to the Foundry ontology."""
        self.batch_write_objects("ComputeNode", nodes)

    def sync_gpu_devices(self, devices: list[dict[str, Any]]) -> None:
        """Sync a list of GPUDevice objects to the Foundry ontology."""
        self.batch_write_objects("GPUDevice", devices)

    def sync_alerts(self, alerts: list[dict[str, Any]]) -> None:
        """Sync a list of Alert objects to the Foundry ontology."""
        self.batch_write_objects("Alert", alerts)

    def sync_model_versions(self, models: list[dict[str, Any]]) -> None:
        """Sync a list of ModelVersion objects to the Foundry ontology."""
        self.batch_write_objects("ModelVersion", models)


# --------------------------------------------------------------------------- #
# CLI entry point
# --------------------------------------------------------------------------- #

def _load_json_array(file_path: str) -> list[dict[str, Any]]:
    """Read a JSON file and return its contents, asserting it is a list."""
    with open(file_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError(
            f"Expected a JSON array in {file_path!r}, got {type(data).__name__}."
        )
    return data


def _cmd_sync_nodes(args: argparse.Namespace) -> None:
    data = _load_json_array(args.file)
    client = OntologyClient()
    client.sync_compute_nodes(data)
    print(f"Synced {len(data)} objects")


def _cmd_sync_gpus(args: argparse.Namespace) -> None:
    data = _load_json_array(args.file)
    client = OntologyClient()
    client.sync_gpu_devices(data)
    print(f"Synced {len(data)} objects")


def _cmd_sync_alerts(args: argparse.Namespace) -> None:
    data = _load_json_array(args.file)
    client = OntologyClient()
    client.sync_alerts(data)
    print(f"Synced {len(data)} objects")


def _cmd_sync_models(args: argparse.Namespace) -> None:
    data = _load_json_array(args.file)
    client = OntologyClient()
    client.sync_model_versions(data)
    print(f"Synced {len(data)} objects")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sync",
        description="Palantir Foundry Ontology sync client for AMD ML platform.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # sync-nodes
    p_nodes = subparsers.add_parser(
        "sync-nodes",
        help="Sync ComputeNode objects from a JSON file.",
    )
    p_nodes.add_argument(
        "--file",
        required=True,
        metavar="FILE",
        help="Path to a JSON file containing an array of ComputeNode objects.",
    )
    p_nodes.set_defaults(func=_cmd_sync_nodes)

    # sync-gpus
    p_gpus = subparsers.add_parser(
        "sync-gpus",
        help="Sync GPUDevice objects from a JSON file.",
    )
    p_gpus.add_argument(
        "--file",
        required=True,
        metavar="FILE",
        help="Path to a JSON file containing an array of GPUDevice objects.",
    )
    p_gpus.set_defaults(func=_cmd_sync_gpus)

    # sync-alerts
    p_alerts = subparsers.add_parser(
        "sync-alerts",
        help="Sync Alert objects from a JSON file.",
    )
    p_alerts.add_argument(
        "--file",
        required=True,
        metavar="FILE",
        help="Path to a JSON file containing an array of Alert objects.",
    )
    p_alerts.set_defaults(func=_cmd_sync_alerts)

    # sync-models
    p_models = subparsers.add_parser(
        "sync-models",
        help="Sync ModelVersion objects from a JSON file.",
    )
    p_models.add_argument(
        "--file",
        required=True,
        metavar="FILE",
        help="Path to a JSON file containing an array of ModelVersion objects.",
    )
    p_models.set_defaults(func=_cmd_sync_models)

    return parser


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = _build_parser()
    args = parser.parse_args()
    args.func(args)

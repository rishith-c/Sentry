"""HuggingFace Inference API client for Sentry multi-model AI pipeline.

Provides unified access to multiple HF models:
- Text generation (Mistral, Llama, Zephyr) — AIP reasoning, operator briefs
- Zero-shot classification (BART-MNLI) — event categorization
- Summarization (BART-CNN) — situation summaries
- Image classification (ViT) — satellite/drone imagery
- Audio transcription (Whisper) — citizen call processing
- Image captioning (BLIP) — scene description
- Text-to-text (FLAN-T5) — structured data extraction
- Sentiment/emotion (distilbert) — urgency detection from text
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import requests

from backend.services.benchmark_logger import log_benchmark

logger = logging.getLogger(__name__)

HF_API_BASE = "https://router.huggingface.co/hf-inference/models"

# ── Model registry ──────────────────────────────────────────────────────────
MODELS = {
    # Text generation — action planning and operator briefs
    "text_generation": os.getenv(
        "HF_TEXT_GEN_MODEL", "mistralai/Mistral-7B-Instruct-v0.3"
    ),
    "text_generation_alt": "HuggingFaceH4/zephyr-7b-beta",
    "text_generation_small": "microsoft/Phi-3-mini-4k-instruct",

    # Zero-shot classification — event/report categorization
    "zero_shot": os.getenv(
        "HF_ZERO_SHOT_MODEL", "facebook/bart-large-mnli"
    ),

    # Summarization — situation reports
    "summarization": os.getenv(
        "HF_SUMMARIZE_MODEL", "facebook/bart-large-cnn"
    ),

    # Image classification — disaster imagery
    "image_classification": os.getenv(
        "HF_IMAGE_CLASS_MODEL", "google/vit-base-patch16-224"
    ),

    # Audio transcription — citizen calls
    "asr": os.getenv("HF_ASR_MODEL", "openai/whisper-large-v3"),

    # Image captioning — scene description
    "image_caption": os.getenv(
        "HF_IMAGE_CAPTION_MODEL", "Salesforce/blip-image-captioning-large"
    ),

    # Text-to-text — structured extraction
    "text2text": os.getenv("HF_TEXT2TEXT_MODEL", "google/flan-t5-large"),

    # Sentiment / emotion — urgency detection
    "sentiment": "j-hartmann/emotion-english-distilroberta-base",

    # Feature extraction — embeddings for similarity
    "embeddings": "sentence-transformers/all-MiniLM-L6-v2",

    # Object detection — structural damage in images
    "object_detection": "facebook/detr-resnet-50",

    # Token classification — NER for location extraction
    "ner": "dslim/bert-base-NER",
}


def _get_token() -> str:
    token = os.getenv("HF_TOKEN", "")
    if not token:
        raise RuntimeError("HF_TOKEN not set — cannot call HuggingFace Inference API")
    return token


def _headers(content_type: str = "application/json") -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_get_token()}",
        "Content-Type": content_type,
    }


def _post_json(model_id: str, payload: dict[str, Any], timeout: int = 120) -> Any:
    """POST JSON payload to HF Inference API with retry on model loading."""
    url = f"{HF_API_BASE}/{model_id}"
    t0 = time.time()

    for attempt in range(3):
        resp = requests.post(url, headers=_headers(), json=payload, timeout=timeout)

        if resp.status_code == 503:
            # Model is loading — wait and retry
            wait = resp.json().get("estimated_time", 30)
            logger.info("Model %s loading, waiting %.0fs (attempt %d)", model_id, wait, attempt + 1)
            time.sleep(min(wait, 60))
            continue

        resp.raise_for_status()
        elapsed_ms = (time.time() - t0) * 1000
        log_benchmark({
            "pipeline": f"hf_{model_id.split('/')[-1]}",
            "elapsed_ms": round(elapsed_ms, 2),
            "model": model_id,
        })
        return resp.json()

    resp.raise_for_status()
    return resp.json()


def _post_binary(model_id: str, data: bytes, content_type: str, timeout: int = 120) -> Any:
    """POST binary data (image/audio) to HF Inference API."""
    url = f"{HF_API_BASE}/{model_id}"
    t0 = time.time()

    for attempt in range(3):
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {_get_token()}",
                "Content-Type": content_type,
            },
            data=data,
            timeout=timeout,
        )
        if resp.status_code == 503:
            wait = resp.json().get("estimated_time", 30)
            logger.info("Model %s loading, waiting %.0fs", model_id, wait)
            time.sleep(min(wait, 60))
            continue

        resp.raise_for_status()
        elapsed_ms = (time.time() - t0) * 1000
        log_benchmark({
            "pipeline": f"hf_{model_id.split('/')[-1]}",
            "elapsed_ms": round(elapsed_ms, 2),
            "model": model_id,
        })
        return resp.json()

    resp.raise_for_status()
    return resp.json()


# ── Text Generation ─────────────────────────────────────────────────────────

def generate_text(
    prompt: str,
    *,
    model: str | None = None,
    max_new_tokens: int = 1024,
    temperature: float = 0.3,
    return_full_text: bool = False,
) -> str:
    """Generate text using an instruction-tuned LLM via HF Inference API.

    Used for: AIP action planning, operator briefs, risk assessments.
    """
    model_id = model or MODELS["text_generation"]
    result = _post_json(model_id, {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature,
            "return_full_text": return_full_text,
            "do_sample": temperature > 0,
        },
    })

    if isinstance(result, list) and result:
        return result[0].get("generated_text", "")
    if isinstance(result, dict):
        return result.get("generated_text", "")
    return str(result)


def generate_text_with_fallback(prompt: str, **kwargs: Any) -> str:
    """Try primary model, fall back to alternatives on failure."""
    models_to_try = [
        MODELS["text_generation"],
        MODELS["text_generation_alt"],
        MODELS["text_generation_small"],
    ]
    for m in models_to_try:
        try:
            return generate_text(prompt, model=m, **kwargs)
        except Exception as exc:
            logger.warning("Text gen failed with %s: %s", m, exc)
            continue
    raise RuntimeError("All text generation models failed")


# ── Zero-Shot Classification ────────────────────────────────────────────────

def classify_zero_shot(
    text: str,
    candidate_labels: list[str],
    *,
    multi_label: bool = True,
) -> list[dict[str, Any]]:
    """Classify text against candidate labels without training.

    Used for: event categorization, report triage, threat classification.
    """
    result = _post_json(MODELS["zero_shot"], {
        "inputs": text,
        "parameters": {
            "candidate_labels": candidate_labels,
            "multi_label": multi_label,
        },
    })

    # Handle both old format {labels, scores} and new format [{label, score}]
    if isinstance(result, list):
        return [
            {"label": r.get("label", ""), "score": round(r.get("score", 0), 4)}
            for r in result
        ]
    labels = result.get("labels", [])
    scores = result.get("scores", [])
    return [
        {"label": label, "score": round(score, 4)}
        for label, score in zip(labels, scores)
    ]


# ── Summarization ───────────────────────────────────────────────────────────

def summarize(text: str, *, max_length: int = 150, min_length: int = 30) -> str:
    """Summarize text for situation reports.

    Used for: event summaries, operator briefings, status feed.
    """
    result = _post_json(MODELS["summarization"], {
        "inputs": text,
        "parameters": {
            "max_length": max_length,
            "min_length": min_length,
        },
    })

    if isinstance(result, list) and result:
        return result[0].get("summary_text", "")
    return ""


# ── Image Classification ────────────────────────────────────────────────────

def classify_image(image_bytes: bytes, content_type: str = "image/jpeg") -> list[dict[str, Any]]:
    """Classify an image (satellite, drone, citizen photo).

    Used for: damage assessment, fire detection, structural analysis.
    """
    result = _post_binary(MODELS["image_classification"], image_bytes, content_type)
    if isinstance(result, list):
        return [{"label": r.get("label", ""), "score": round(r.get("score", 0), 4)} for r in result[:5]]
    return []


# ── Audio Transcription ─────────────────────────────────────────────────────

def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/mpeg") -> str:
    """Transcribe audio using Whisper.

    Used for: citizen emergency calls, field reports.
    """
    result = _post_binary(MODELS["asr"], audio_bytes, content_type)
    if isinstance(result, dict):
        return result.get("text", "")
    return ""


# ── Image Captioning ────────────────────────────────────────────────────────

def caption_image(image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """Generate a caption describing an image.

    Used for: scene description from citizen uploads, satellite imagery.
    """
    result = _post_binary(MODELS["image_caption"], image_bytes, content_type)
    if isinstance(result, list) and result:
        return result[0].get("generated_text", "")
    return ""


# ── Text-to-Text (FLAN-T5) ─────────────────────────────────────────────────

def text2text(prompt: str, *, max_length: int = 256) -> str:
    """Structured text-to-text generation (extraction, reformatting).

    Used for: extracting structured data, reformatting reports.
    """
    result = _post_json(MODELS["text2text"], {
        "inputs": prompt,
        "parameters": {"max_length": max_length},
    })
    if isinstance(result, list) and result:
        return result[0].get("generated_text", "")
    return ""


# ── Sentiment / Emotion Detection ───────────────────────────────────────────

def detect_emotion(text: str) -> list[dict[str, Any]]:
    """Detect emotions in text for urgency assessment.

    Used for: citizen report urgency, operator stress detection.
    """
    result = _post_json(MODELS["sentiment"], {"inputs": text})
    if isinstance(result, list) and result:
        emotions = result[0] if isinstance(result[0], list) else result
        return [{"label": e.get("label", ""), "score": round(e.get("score", 0), 4)} for e in emotions[:5]]
    return []


# ── Named Entity Recognition ────────────────────────────────────────────────

def extract_entities(text: str) -> list[dict[str, Any]]:
    """Extract named entities (locations, organizations) from text.

    Used for: extracting location mentions from citizen reports.
    """
    result = _post_json(MODELS["ner"], {"inputs": text})
    if isinstance(result, list):
        return [
            {
                "entity": e.get("entity_group", e.get("entity", "")),
                "word": e.get("word", ""),
                "score": round(e.get("score", 0), 4),
            }
            for e in result
            if e.get("score", 0) > 0.5
        ]
    return []


# ── Object Detection ────────────────────────────────────────────────────────

def detect_objects(image_bytes: bytes, content_type: str = "image/jpeg") -> list[dict[str, Any]]:
    """Detect objects in imagery for structural damage assessment.

    Used for: identifying damaged structures, vehicles, debris.
    """
    result = _post_binary(MODELS["object_detection"], image_bytes, content_type)
    if isinstance(result, list):
        return [
            {
                "label": d.get("label", ""),
                "score": round(d.get("score", 0), 4),
                "box": d.get("box", {}),
            }
            for d in result
            if d.get("score", 0) > 0.5
        ]
    return []


# ── Feature Extraction (Embeddings) ─────────────────────────────────────────

def get_embeddings(text: str) -> list[float]:
    """Get sentence embeddings for semantic similarity.

    Used for: deduplicating similar reports, finding related events.
    """
    result = _post_json(MODELS["embeddings"], {"inputs": text})
    if isinstance(result, list) and result:
        return result[0] if isinstance(result[0], list) else result
    return []


# ── Composite: AIP Action Generation ────────────────────────────────────────

def generate_aip_actions(system_prompt: str, situation_data: str) -> list[dict]:
    """Generate AIP action recommendations using HF text generation.

    Sends the full AIP system prompt + situation data to the LLM and
    parses the returned JSON array of actions.
    """
    full_prompt = f"""<s>[INST] {system_prompt}

Here is the current situation data:
{situation_data}

Generate the action plan as a JSON array. Return ONLY the JSON array, no other text. [/INST]"""

    raw = generate_text_with_fallback(
        full_prompt,
        max_new_tokens=2048,
        temperature=0.2,
    )

    # Extract JSON array from response
    import re
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        logger.warning("No JSON array found in HF response, returning empty")
        return []

    try:
        actions = json.loads(match.group(0))
        if not isinstance(actions, list):
            return []
        return actions
    except json.JSONDecodeError as exc:
        logger.warning("Failed to parse HF JSON response: %s", exc)
        return []


# ── Composite: Seismic Risk Assessment ──────────────────────────────────────

def assess_seismic_risk(event_data: dict, damage_zones: list[dict]) -> str:
    """Generate a natural-language risk assessment for a seismic event.

    Uses text generation to produce an operator-readable summary combining
    seismic parameters with computed damage zones.
    """
    zone_summary = ", ".join(
        f"Zone {z.get('id', '?')} at {z.get('damage_probability', 0)*100:.0f}% damage probability"
        for z in damage_zones[:5]
    )

    prompt = f"""<s>[INST] You are Sentry, an AI disaster intelligence system. Generate a concise seismic risk assessment (3-4 sentences) for an emergency operations commander.

Event: M{event_data.get('magnitude', 0)} earthquake at depth {event_data.get('depth', 0)}km, location ({event_data.get('lat', 0)}, {event_data.get('lng', 0)}).
Damage zones computed: {len(damage_zones)} zones. Top zones: {zone_summary}.

Focus on: immediate risk, infrastructure impact, recommended response priority. Be specific with numbers. [/INST]"""

    return generate_text_with_fallback(prompt, max_new_tokens=256, temperature=0.3)


# ── Composite: Situation Summary ────────────────────────────────────────────

def generate_situation_summary(
    hotspot_count: int,
    seismic_count: int,
    active_crews: int,
    damage_zone_count: int,
    pending_actions: int,
) -> str:
    """Generate a natural-language situation summary for the commander."""
    prompt = f"""<s>[INST] You are Sentry, an AI disaster intelligence system. Generate a 2-sentence operational status summary.

Active hotspots: {hotspot_count}
Seismic events: {seismic_count}
Crews deployed: {active_crews}
Damage zones: {damage_zone_count}
Pending actions: {pending_actions}

Be concise, use military-style brevity. [/INST]"""

    return generate_text_with_fallback(prompt, max_new_tokens=128, temperature=0.2)


# ── Composite: Threat Classification ────────────────────────────────────────

def classify_threat(description: str) -> dict[str, Any]:
    """Classify a threat report into categories and urgency level."""
    threat_labels = [
        "wildfire - active",
        "wildfire - ember risk",
        "earthquake - structural damage",
        "earthquake - liquefaction",
        "flood - rising water",
        "infrastructure failure",
        "hazmat exposure",
        "mass casualty",
        "evacuation needed",
        "low severity - monitoring only",
    ]

    classifications = classify_zero_shot(description, threat_labels)
    emotions = detect_emotion(description)

    urgency_emotions = {"fear", "surprise", "anger", "disgust"}
    urgency_score = sum(
        e["score"] for e in emotions if e["label"] in urgency_emotions
    )

    top_threat = classifications[0] if classifications else {"label": "unknown", "score": 0}

    return {
        "threat_type": top_threat["label"],
        "threat_confidence": top_threat["score"],
        "all_classifications": classifications[:5],
        "urgency_score": round(min(urgency_score, 1.0), 3),
        "emotions": emotions[:3],
    }


# ── Model Health Check ──────────────────────────────────────────────────────

def check_model_health() -> dict[str, str]:
    """Check which HF models are available and responsive."""
    results: dict[str, str] = {}
    for name, model_id in MODELS.items():
        try:
            resp = requests.get(
                f"{HF_API_BASE}/{model_id}",
                headers={"Authorization": f"Bearer {_get_token()}"},
                timeout=10,
            )
            if resp.status_code == 200:
                results[name] = "ready"
            elif resp.status_code == 503:
                results[name] = "loading"
            else:
                results[name] = f"error_{resp.status_code}"
        except Exception as exc:
            results[name] = f"unreachable: {exc}"
    return results

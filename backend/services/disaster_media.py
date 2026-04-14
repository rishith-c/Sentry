"""Civilian media triage using local HF image classification plus HF inference APIs."""

from __future__ import annotations

import base64
import io
import os
from functools import lru_cache
from typing import Any

import requests
import torch
from huggingface_hub import hf_hub_download
from PIL import Image
from torchvision import models, transforms

from backend.ai.elevenlabs_client import synthesize_speech

IMAGE_MODEL_REPO = "DanielCruz09/disaster-image-classifier"
IMAGE_MODEL_FILE = "models/model_weights.pth"
IMAGE_LABELS = ["Non-Damage", "Earthquake", "Fire", "Flood"]

DEFAULT_ASR_MODEL = os.getenv("HF_ASR_MODEL", "openai/whisper-large-v3")
DEFAULT_ZERO_SHOT_MODEL = os.getenv("HF_ZERO_SHOT_MODEL", "facebook/bart-large-mnli")
DEFAULT_IMAGE_CAPTION_MODEL = os.getenv("HF_IMAGE_CAPTION_MODEL", "Salesforce/blip-image-captioning-base")
HF_API_BASE = "https://router.huggingface.co/hf-inference/models"

TRIAGE_LABELS = [
    "wildfire response needed",
    "flood response needed",
    "earthquake response needed",
    "evacuation assistance needed",
    "medical rescue needed",
    "infrastructure damage report",
    "low severity status update",
]


class MediaTriageError(RuntimeError):
    """Raised when media triage cannot proceed."""


def _hf_headers(content_type: str | None = None) -> dict[str, str]:
    token = os.getenv("HF_TOKEN", "").strip()
    if not token:
        raise MediaTriageError("HF_TOKEN is not configured.")

    headers = {"Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _call_hf_json(model_id: str, payload: dict[str, Any]) -> Any:
    response = requests.post(
        f"{HF_API_BASE}/{model_id}",
        headers=_hf_headers("application/json"),
        json=payload,
        timeout=90,
    )
    response.raise_for_status()
    return response.json()


def _call_hf_binary(model_id: str, payload: bytes, content_type: str) -> Any:
    response = requests.post(
        f"{HF_API_BASE}/{model_id}",
        headers=_hf_headers(content_type),
        data=payload,
        timeout=90,
    )
    response.raise_for_status()
    return response.json()


@lru_cache(maxsize=1)
def _image_transform():
    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )


@lru_cache(maxsize=1)
def _image_model():
    token = os.getenv("HF_TOKEN", "").strip() or None
    weights_path = hf_hub_download(repo_id=IMAGE_MODEL_REPO, filename=IMAGE_MODEL_FILE, token=token)
    model = models.resnet50(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, len(IMAGE_LABELS))

    checkpoint = torch.load(weights_path, map_location="cpu")
    state_dict = checkpoint["model_state_dict"] if "model_state_dict" in checkpoint else checkpoint
    model.load_state_dict(state_dict)
    model.eval()
    return model


def classify_image(image_bytes: bytes) -> dict[str, Any]:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    tensor = _image_transform()(image).unsqueeze(0)

    with torch.no_grad():
        logits = _image_model()(tensor)
        probabilities = torch.softmax(logits, dim=1)[0].tolist()

    ranked = sorted(
        [
            {
                "label": label,
                "score": round(score, 4),
            }
            for label, score in zip(IMAGE_LABELS, probabilities)
        ],
        key=lambda item: item["score"],
        reverse=True,
    )

    top = ranked[0]
    return {
        "top_label": top["label"],
        "confidence": top["score"],
        "scores": ranked,
    }


def caption_image(image_bytes: bytes, content_type: str) -> str | None:
    try:
        result = _call_hf_binary(DEFAULT_IMAGE_CAPTION_MODEL, image_bytes, content_type)
        if isinstance(result, list) and result:
            return result[0].get("generated_text")
    except Exception:
        return None
    return None


def transcribe_audio(audio_bytes: bytes, content_type: str) -> str | None:
    try:
        result = _call_hf_binary(DEFAULT_ASR_MODEL, audio_bytes, content_type)
        if isinstance(result, dict):
            return result.get("text")
    except Exception:
        return None
    return None


def classify_transcript(text: str) -> list[dict[str, Any]]:
    result = _call_hf_json(
        DEFAULT_ZERO_SHOT_MODEL,
        {
            "inputs": text,
            "parameters": {
                "candidate_labels": TRIAGE_LABELS,
                "multi_label": True,
            },
        },
    )

    labels = result.get("labels", [])
    scores = result.get("scores", [])
    return [
        {"label": label, "score": round(score, 4)}
        for label, score in zip(labels, scores)
    ]


def _normalize_image_label(label: str | None) -> str | None:
    if not label:
        return None
    mapping = {
        "Non-Damage": "low severity status update",
        "Earthquake": "earthquake response needed",
        "Fire": "wildfire response needed",
        "Flood": "flood response needed",
    }
    return mapping.get(label, label.lower())


def _priority_from_labels(labels: list[str]) -> str:
    if any("medical rescue" in label or "evacuation" in label for label in labels):
        return "critical"
    if any("wildfire" in label or "flood" in label or "earthquake" in label for label in labels):
        return "high"
    if any("infrastructure damage" in label for label in labels):
        return "medium"
    return "low"


def _operator_brief(
    incident_labels: list[str],
    image_result: dict[str, Any] | None,
    image_caption: str | None,
    transcript: str | None,
) -> str:
    parts: list[str] = []
    if incident_labels:
        parts.append(f"Likely incident classes: {', '.join(incident_labels[:3])}.")
    if image_result:
        parts.append(
            f"Image classifier flagged {image_result['top_label']} at {round(image_result['confidence'] * 100)}% confidence."
        )
    if image_caption:
        parts.append(f"Caption summary: {image_caption}.")
    if transcript:
        parts.append(f"Caller transcript: {transcript[:260]}")
    return " ".join(parts).strip()


def _civilian_response(priority: str, incident_labels: list[str]) -> str:
    primary = incident_labels[0] if incident_labels else "an emergency report"
    if priority == "critical":
        return (
            f"We received your report about {primary}. Stay on the line if you can, move to immediate safety, "
            "and follow local emergency instructions while an operator reviews your case now."
        )
    if priority == "high":
        return (
            f"We received your report about {primary}. Move to a safer location if conditions are unstable and keep your phone available for operator follow-up."
        )
    if priority == "medium":
        return (
            f"We received your report about {primary}. An operator will review the details shortly. If danger increases, contact emergency services immediately."
        )
    return (
        "We received your update. An operator will review it soon. If anyone is in immediate danger, contact emergency services now."
    )


def _speech_payload(text: str) -> dict[str, Any] | None:
    audio = synthesize_speech(text)
    if not audio:
        return None
    return {
        "mime_type": "audio/mpeg",
        "base64": base64.b64encode(audio).decode("utf-8"),
    }


def triage_media(
    *,
    image_bytes: bytes | None,
    image_content_type: str | None,
    audio_bytes: bytes | None,
    audio_content_type: str | None,
    note: str | None = None,
) -> dict[str, Any]:
    if not image_bytes and not audio_bytes and not note:
        raise MediaTriageError("Provide an image, call audio, or a text note.")

    image_result: dict[str, Any] | None = None
    image_caption: str | None = None
    transcript: str | None = note.strip() if note else None
    transcript_labels: list[dict[str, Any]] = []

    if image_bytes:
        image_result = classify_image(image_bytes)
        if image_content_type:
            image_caption = caption_image(image_bytes, image_content_type)

    if audio_bytes:
        transcript = transcribe_audio(audio_bytes, audio_content_type or "audio/mpeg") or transcript

    if transcript:
        transcript_labels = classify_transcript(transcript)

    incident_labels: list[str] = []
    image_label = _normalize_image_label(image_result["top_label"] if image_result else None)
    if image_label:
        incident_labels.append(image_label)
    incident_labels.extend(
        item["label"] for item in transcript_labels if item["score"] >= 0.25
    )
    incident_labels = list(dict.fromkeys(incident_labels))

    priority = _priority_from_labels(incident_labels)
    operator_brief = _operator_brief(incident_labels, image_result, image_caption, transcript)
    civilian_response = _civilian_response(priority, incident_labels)

    return {
        "incident_labels": incident_labels,
        "priority": priority,
        "requires_human_review": True,
        "image_classification": image_result,
        "image_caption": image_caption,
        "transcript": transcript,
        "transcript_labels": transcript_labels,
        "operator_brief": operator_brief,
        "civilian_response_text": civilian_response,
        "civilian_response_audio": _speech_payload(civilian_response),
        "models_used": {
            "image_classifier": IMAGE_MODEL_REPO if image_bytes else None,
            "image_caption": DEFAULT_IMAGE_CAPTION_MODEL if image_bytes else None,
            "speech_to_text": DEFAULT_ASR_MODEL if audio_bytes else None,
            "text_triage": DEFAULT_ZERO_SHOT_MODEL if transcript else None,
            "text_to_speech": "elevenlabs" if os.getenv("ELEVENLABS_API_KEY") else None,
        },
    }

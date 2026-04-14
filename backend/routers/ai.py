"""AI model endpoints — expose HuggingFace model health, summaries, and threat classification."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ThreatRequest(BaseModel):
    description: str


class SummaryRequest(BaseModel):
    hotspot_count: int = 0
    seismic_count: int = 0
    active_crews: int = 0
    damage_zone_count: int = 0
    pending_actions: int = 0


@router.get("/models")
async def model_health():
    """Check which HuggingFace models are available."""
    from backend.ai.hf_inference import check_model_health, MODELS
    try:
        health = check_model_health()
        return {
            "models": {name: {"model_id": model_id, "status": health.get(name, "unknown")}
                       for name, model_id in MODELS.items()},
            "total": len(MODELS),
            "ready": sum(1 for v in health.values() if v == "ready"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/classify-threat")
async def classify_threat(req: ThreatRequest):
    """Classify a threat report using zero-shot classification + emotion detection."""
    from backend.ai.hf_inference import classify_threat
    try:
        return classify_threat(req.description)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/summary")
async def generate_summary(req: SummaryRequest):
    """Generate an AI situation summary for the commander."""
    from backend.ai.hf_inference import generate_situation_summary
    try:
        summary = generate_situation_summary(
            hotspot_count=req.hotspot_count,
            seismic_count=req.seismic_count,
            active_crews=req.active_crews,
            damage_zone_count=req.damage_zone_count,
            pending_actions=req.pending_actions,
        )
        return {"summary": summary}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/extract-entities")
async def extract_entities(req: ThreatRequest):
    """Extract named entities (locations, organizations) from text."""
    from backend.ai.hf_inference import extract_entities
    try:
        entities = extract_entities(req.description)
        return {"entities": entities}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/detect-emotion")
async def detect_emotion(req: ThreatRequest):
    """Detect emotion/urgency in text."""
    from backend.ai.hf_inference import detect_emotion
    try:
        emotions = detect_emotion(req.description)
        return {"emotions": emotions}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

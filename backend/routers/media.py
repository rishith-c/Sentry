from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.services.disaster_media import MediaTriageError, triage_media

router = APIRouter(prefix="/api/media", tags=["media"])


@router.post("/triage")
async def triage_upload(
    image: UploadFile | None = File(default=None),
    audio: UploadFile | None = File(default=None),
    note: str | None = Form(default=None),
):
    try:
        image_bytes = await image.read() if image else None
        audio_bytes = await audio.read() if audio else None
        return triage_media(
            image_bytes=image_bytes,
            image_content_type=image.content_type if image else None,
            audio_bytes=audio_bytes,
            audio_content_type=audio.content_type if audio else None,
            note=note,
        )
    except MediaTriageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Media triage failed: {exc}") from exc

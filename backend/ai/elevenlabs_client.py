"""ElevenLabs speech synthesis client."""

import logging
import os
import time

import requests

from backend.services.benchmark_logger import log_benchmark

logger = logging.getLogger(__name__)

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")
_TTS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}/stream"


def synthesize_speech(text: str) -> bytes:
    """Synthesize speech from text via ElevenLabs API.

    Args:
        text: Text to synthesize.

    Returns:
        MP3 audio bytes, or b"" on error / missing API key (silent failure).
    """
    if not ELEVENLABS_API_KEY:
        logger.warning("ELEVENLABS_API_KEY not set, returning silent audio")
        return b""

    if not text or not text.strip():
        logger.warning("Empty text provided to synthesize_speech")
        return b""

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {
            "stability": 0.75,
            "similarity_boost": 0.75,
            "speaking_rate": 0.9,
        },
    }

    t0 = time.time()
    try:
        response = requests.post(
            _TTS_URL, json=body, headers=headers, timeout=30, stream=True
        )
        response.raise_for_status()

        audio_bytes = b"".join(
            chunk for chunk in response.iter_content(chunk_size=1024) if chunk
        )
        elapsed_ms = (time.time() - t0) * 1000
        logger.info(
            "Synthesized %d chars to %d bytes in %.0fms",
            len(text), len(audio_bytes), elapsed_ms,
        )
        log_benchmark({
            "pipeline": "elevenlabs_tts",
            "elapsed_ms": round(elapsed_ms, 2),
            "chars": len(text),
            "audio_bytes": len(audio_bytes),
        })
        return audio_bytes

    except requests.RequestException as exc:
        logger.error("ElevenLabs API error: %s", exc)
        return b""
    except Exception as exc:
        logger.error("Unexpected error in synthesize_speech: %s", exc)
        return b""

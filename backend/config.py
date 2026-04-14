from dataclasses import dataclass
from dotenv import load_dotenv
import os

load_dotenv()

@dataclass
class Config:
    firms_map_key: str
    usgs_feed_url: str
    palantir_host: str
    palantir_token: str
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    huggingface_api_key: str
    env: str
    db_path: str
    cors_origins: list

def get_config() -> Config:
    firms_map_key = os.getenv('FIRMS_MAP_KEY', '')
    if not firms_map_key:
        import warnings
        warnings.warn(
            'FIRMS_MAP_KEY not set — FIRMS poller will be disabled. '
            'Copy backend/.env.example to backend/.env to enable live fire data.',
            RuntimeWarning, stacklevel=2,
        )

    # CORS_ORIGINS: comma-separated list of allowed origins
    cors_raw = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173,http://localhost:4173')
    cors_origins = [o.strip() for o in cors_raw.split(',') if o.strip()]

    hf_key = os.getenv('HF_TOKEN', '')
    # Also export to env so subsystems (disaster_media, etc.) can read it
    if hf_key:
        os.environ['HF_TOKEN'] = hf_key

    return Config(
        firms_map_key=firms_map_key,
        usgs_feed_url=os.getenv('USGS_FEED_URL', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'),
        palantir_host=os.getenv('PALANTIR_HOST', ''),
        palantir_token=os.getenv('PALANTIR_TOKEN', ''),
        elevenlabs_api_key=os.getenv('ELEVENLABS_API_KEY', ''),
        elevenlabs_voice_id=os.getenv('ELEVENLABS_VOICE_ID', ''),
        huggingface_api_key=hf_key,
        env=os.getenv('ENV', 'development'),
        db_path=os.getenv('DB_PATH', 'sentry.db'),
        cors_origins=cors_origins,
    )

config = get_config()

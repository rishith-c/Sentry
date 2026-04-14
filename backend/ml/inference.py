"""Standalone inference script for SentryCNN model.

Usage:
    python -m backend.ml.inference --lat 34.213 --lng -118.537 --depth 18.2
"""

import argparse
import logging
import os
import time

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ai", "sentinel_cnn.pth")


def run_inference(lat: float, lng: float, depth: float) -> dict:
    """Run magnitude inference on a single event.

    Returns:
        dict with predicted_magnitude, latency_ms, device.
    """
    try:
        import torch
        from backend.ai.seismic_cnn import SentryCNN
    except ImportError:
        return {"error": "PyTorch not installed"}

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = SentryCNN().to(device)

    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))
        logger.info("[inference] Loaded weights from %s", MODEL_PATH)
    else:
        logger.warning("[inference] No weights found at %s, using random init", MODEL_PATH)

    model.eval()

    # Generate synthetic waveform for the given parameters
    from backend.ml.synthetic_data import generate_waveform
    waveform = generate_waveform(magnitude=5.0, depth_km=depth, distance_km=50.0)
    tensor = torch.tensor(waveform).unsqueeze(0).to(device)

    t0 = time.perf_counter()
    with torch.no_grad():
        prediction = model(tensor)
    latency = (time.perf_counter() - t0) * 1000

    magnitude = float(prediction.item())

    return {
        "predicted_magnitude": round(magnitude, 2),
        "latency_ms": round(latency, 1),
        "device": str(device),
        "lat": lat,
        "lng": lng,
        "depth": depth,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="SentryCNN Inference")
    parser.add_argument("--lat", type=float, default=34.213)
    parser.add_argument("--lng", type=float, default=-118.537)
    parser.add_argument("--depth", type=float, default=18.2)
    args = parser.parse_args()

    result = run_inference(args.lat, args.lng, args.depth)
    print(result)

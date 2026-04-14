"""Benchmark script for SentryCNN inference performance.

Measures GPU/CPU throughput, latency percentiles, and memory usage.

Usage:
    python -m backend.ml.benchmark --iterations 100
"""

import argparse
import logging
import os
import time

import numpy as np

logger = logging.getLogger(__name__)


def run_benchmark(iterations: int = 100) -> dict:
    """Run inference benchmark over multiple iterations.

    Returns:
        dict with p50, p95, p99 latencies, throughput, and device info.
    """
    try:
        import torch
        from backend.ai.seismic_cnn import SentryCNN
        from backend.ml.synthetic_data import generate_waveform
    except ImportError:
        return {"error": "PyTorch not installed"}

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = SentryCNN().to(device)
    model.eval()

    model_path = os.path.join(os.path.dirname(__file__), "..", "ai", "sentinel_cnn.pth")
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))

    # Warmup
    warmup_data = torch.randn(1, 3, 500).to(device)
    for _ in range(10):
        with torch.no_grad():
            model(warmup_data)

    # Benchmark
    latencies = []
    for i in range(iterations):
        waveform = generate_waveform(magnitude=np.random.uniform(2, 8), seed=i)
        tensor = torch.tensor(waveform).unsqueeze(0).to(device)

        t0 = time.perf_counter()
        with torch.no_grad():
            model(tensor)
        latencies.append((time.perf_counter() - t0) * 1000)

    latencies_arr = np.array(latencies)

    result = {
        "device": str(device),
        "iterations": iterations,
        "p50_ms": round(float(np.percentile(latencies_arr, 50)), 2),
        "p95_ms": round(float(np.percentile(latencies_arr, 95)), 2),
        "p99_ms": round(float(np.percentile(latencies_arr, 99)), 2),
        "mean_ms": round(float(np.mean(latencies_arr)), 2),
        "min_ms": round(float(np.min(latencies_arr)), 2),
        "max_ms": round(float(np.max(latencies_arr)), 2),
        "throughput_hz": round(1000.0 / float(np.mean(latencies_arr)), 1),
    }

    if torch.cuda.is_available():
        result["gpu_name"] = torch.cuda.get_device_name(0)
        result["gpu_memory_mb"] = round(torch.cuda.max_memory_allocated() / 1024 / 1024, 1)

    logger.info("[benchmark] Results: %s", result)
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="SentryCNN Benchmark")
    parser.add_argument("--iterations", type=int, default=100)
    args = parser.parse_args()

    result = run_benchmark(args.iterations)
    for k, v in result.items():
        print(f"  {k}: {v}")

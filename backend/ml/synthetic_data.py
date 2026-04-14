"""Synthetic seismic waveform generator for CNN training.

Generates 3-component waveforms with known magnitude labels for
training the SentryCNN model.
"""

import math
import random
from typing import Optional

import numpy as np


def generate_waveform(
    magnitude: float,
    depth_km: float = 10.0,
    distance_km: float = 50.0,
    n_samples: int = 500,
    noise_level: float = 0.1,
    seed: Optional[int] = None,
) -> np.ndarray:
    """Generate a synthetic 3-component seismic waveform.

    Args:
        magnitude: Target earthquake magnitude (0-9 scale).
        depth_km: Hypocentral depth in km.
        distance_km: Distance from epicenter in km.
        n_samples: Number of time samples per channel.
        noise_level: Gaussian noise amplitude relative to signal.
        seed: Optional random seed for reproducibility.

    Returns:
        numpy array of shape (3, n_samples) representing Z, N, E channels.
    """
    if seed is not None:
        np.random.seed(seed)
        random.seed(seed)

    t = np.linspace(0, 10, n_samples)

    # Amplitude scaling: exponential with magnitude
    amplitude = 10 ** (0.5 * magnitude - 1.5)
    # Distance attenuation
    attenuation = 1.0 / max(1.0, math.sqrt(distance_km))
    # Depth factor
    depth_factor = 1.0 / max(1.0, depth_km / 20.0)

    scale = amplitude * attenuation * depth_factor

    # P-wave arrival (faster, lower amplitude)
    p_arrival = distance_km / 6.0  # ~6 km/s
    p_wave = scale * 0.3 * np.exp(-0.5 * ((t - p_arrival) / 0.5) ** 2) * np.sin(2 * np.pi * 5 * t)

    # S-wave arrival (slower, higher amplitude)
    s_arrival = distance_km / 3.5  # ~3.5 km/s
    s_wave = scale * np.exp(-0.3 * ((t - s_arrival) / 1.0) ** 2) * np.sin(2 * np.pi * 2 * t)

    # Surface waves (late, long period)
    surf_arrival = distance_km / 2.5
    surface = scale * 0.6 * np.exp(-0.2 * ((t - surf_arrival) / 2.0) ** 2) * np.sin(2 * np.pi * 0.5 * t)

    # Combine with channel-specific variations
    z_channel = p_wave + 0.7 * s_wave + 0.5 * surface
    n_channel = 0.3 * p_wave + s_wave + 0.8 * surface
    e_channel = 0.3 * p_wave + 0.9 * s_wave + surface

    # Add noise
    noise = noise_level * scale * np.random.randn(3, n_samples)
    waveform = np.stack([z_channel, n_channel, e_channel]) + noise

    return waveform.astype(np.float32)


def generate_dataset(
    n_samples: int = 1000,
    mag_range: tuple[float, float] = (2.0, 8.0),
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate a synthetic dataset of waveforms and magnitude labels.

    Returns:
        Tuple of (waveforms, magnitudes) where waveforms has shape (n, 3, 500)
        and magnitudes has shape (n,).
    """
    rng = np.random.default_rng(seed)
    magnitudes = rng.uniform(mag_range[0], mag_range[1], n_samples).astype(np.float32)
    depths = rng.uniform(5, 100, n_samples)
    distances = rng.uniform(10, 200, n_samples)

    waveforms = np.stack([
        generate_waveform(mag, depth, dist, seed=seed + i)
        for i, (mag, depth, dist) in enumerate(zip(magnitudes, depths, distances))
    ])

    return waveforms, magnitudes


if __name__ == "__main__":
    waveforms, magnitudes = generate_dataset(n_samples=100)
    print(f"Generated {len(waveforms)} waveforms, shape: {waveforms.shape}")
    print(f"Magnitude range: {magnitudes.min():.1f} - {magnitudes.max():.1f}")

"""Particle-based wildfire ember advection simulation."""

import logging
import math
import time
from dataclasses import dataclass

import numpy as np

from backend.services.benchmark_logger import log_benchmark

logger = logging.getLogger(__name__)


@dataclass
class Particle:
    lat: float
    lng: float
    height: float  # metres above ground
    alive: bool = True


@dataclass
class WindField:
    speed_ms: float  # metres per second
    direction_deg: float  # 0-360, meteorological (direction wind comes FROM)


_METRES_PER_DEGREE = 111_000.0
_MAX_LOFT_HEIGHT = 200.0
_MIN_LOFT_HEIGHT = 1.0
_GRID_RESOLUTION = 0.01  # degrees


class EmberSimulation:
    """Simulate ember transport from wildfire hotspots under a uniform wind field."""

    def __init__(
        self,
        hotspots: list[dict],
        wind: WindField,
        n_particles_per_hotspot: int = 200,
    ) -> None:
        self.hotspots = hotspots
        self.wind = wind
        self.n_particles = n_particles_per_hotspot
        self._lats = np.empty(0)
        self._lngs = np.empty(0)
        self._heights = np.empty(0)
        self._alive = np.empty(0, dtype=bool)

    def _emit_particles(self) -> None:
        all_lats: list[np.ndarray] = []
        all_lngs: list[np.ndarray] = []
        all_heights: list[np.ndarray] = []

        rng = np.random.default_rng()

        for hs in self.hotspots:
            n = self.n_particles
            lats = hs["lat"] + rng.uniform(-0.001, 0.001, size=n)
            lngs = hs["lng"] + rng.uniform(-0.001, 0.001, size=n)

            mean_height = hs.get("frp", 50.0) * 0.8
            heights = rng.normal(loc=mean_height, scale=30.0, size=n)
            heights = np.clip(heights, _MIN_LOFT_HEIGHT, _MAX_LOFT_HEIGHT)

            all_lats.append(lats)
            all_lngs.append(lngs)
            all_heights.append(heights)

        if all_lats:
            self._lats = np.concatenate(all_lats)
            self._lngs = np.concatenate(all_lngs)
            self._heights = np.concatenate(all_heights)
        else:
            self._lats = np.empty(0)
            self._lngs = np.empty(0)
            self._heights = np.empty(0)

        self._alive = np.ones(len(self._lats), dtype=bool)

    def _advect_step(self) -> None:
        if not np.any(self._alive):
            return

        mask = self._alive
        n_alive = mask.sum()
        dir_rad = math.radians(self.wind.direction_deg)
        spd = self.wind.speed_ms

        # Meteorological convention: wind comes FROM direction, particles move opposite
        v_east = -math.sin(dir_rad) * spd
        v_north = -math.cos(dir_rad) * spd

        rng = np.random.default_rng()
        lat_rad = np.radians(self._lats[mask])
        cos_lat = np.cos(lat_rad)
        cos_lat = np.where(cos_lat == 0, 1e-10, cos_lat)

        d_lat = v_north / _METRES_PER_DEGREE + rng.normal(0, 0.0001, size=n_alive)
        d_lng = v_east / (_METRES_PER_DEGREE * cos_lat) + rng.normal(0, 0.0001, size=n_alive)

        self._lats[mask] += d_lat
        self._lngs[mask] += d_lng

        descent = 5.0 + self._heights[mask] * 0.05
        self._heights[mask] -= descent

        self._alive[self._heights <= 0] = False

    def run(self, steps: int = 30) -> dict:
        """Run the simulation and return a GeoJSON FeatureCollection of landing densities."""
        self._emit_particles()

        for _ in range(steps):
            self._advect_step()

        dead = ~self._alive
        if not np.any(dead):
            return {"type": "FeatureCollection", "features": []}

        land_lats = self._lats[dead]
        land_lngs = self._lngs[dead]

        grid_lats = np.floor(land_lats / _GRID_RESOLUTION) * _GRID_RESOLUTION
        grid_lngs = np.floor(land_lngs / _GRID_RESOLUTION) * _GRID_RESOLUTION

        bins: dict[tuple[float, float], int] = {}
        for lat_v, lng_v in zip(grid_lats, grid_lngs):
            key = (round(float(lat_v), 4), round(float(lng_v), 4))
            bins[key] = bins.get(key, 0) + 1

        max_count = max(bins.values()) if bins else 1

        features = []
        for (lat_v, lng_v), count in bins.items():
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng_v, lat_v]},
                "properties": {
                    "density": round(count / max_count, 3),
                    "particle_count": count,
                },
            })

        logger.info("Ember simulation: %d particles landed, %d grid cells", len(land_lats), len(features))
        return {"type": "FeatureCollection", "features": features}


def run_ember_simulation(hotspots: list[dict], wind: dict) -> dict:
    """Thin wrapper for EmberSimulation.run().

    Args:
        hotspots: list of {'lat', 'lng', 'frp'} dicts.
        wind: {'speed_ms', 'direction_deg'} dict.

    Returns:
        GeoJSON FeatureCollection.
    """
    t0 = time.time()
    wind_field = WindField(speed_ms=wind["speed_ms"], direction_deg=wind["direction_deg"])
    sim = EmberSimulation(hotspots=hotspots, wind=wind_field, n_particles_per_hotspot=200)
    result = sim.run(steps=30)
    elapsed_ms = (time.time() - t0) * 1000
    log_benchmark({
        "pipeline": "ember_simulation",
        "elapsed_ms": round(elapsed_ms, 2),
        "hotspot_count": len(hotspots),
        "feature_count": len(result.get("features", [])),
    })
    return result

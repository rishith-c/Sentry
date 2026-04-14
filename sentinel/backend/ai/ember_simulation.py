import numpy as np
from dataclasses import dataclass, field
import json

@dataclass
class WindField:
    speed_ms: float
    direction_deg: float

@dataclass
class Particle:
    lat: float
    lng: float
    height: float
    alive: bool = True

class EmberSimulation:
    def __init__(self, hotspots: list, wind: WindField, n_particles_per_hotspot: int = 200):
        self.hotspots = hotspots
        self.wind = wind
        self.n_per = n_particles_per_hotspot
        self.lats = np.array([])
        self.lngs = np.array([])
        self.heights = np.array([])
        self.alive = np.array([], dtype=bool)

    def _emit_particles(self):
        lats, lngs, heights = [], [], []
        for h in self.hotspots:
            frp = h.get("frp", 100.0)
            n = self.n_per
            lats.append(np.full(n, h["lat"]))
            lngs.append(np.full(n, h["lng"]))
            ht = np.random.normal(loc=frp * 0.8, scale=30.0, size=n)
            heights.append(np.clip(ht, 0, 200))
        self.lats   = np.concatenate(lats)
        self.lngs   = np.concatenate(lngs)
        self.heights = np.concatenate(heights)
        self.alive  = np.ones(len(self.lats), dtype=bool)

    def _advect_step(self):
        rad = np.deg2rad(self.wind.direction_deg)
        dx = self.wind.speed_ms * np.sin(rad) / 111320.0   # degrees lng
        dy = self.wind.speed_ms * np.cos(rad) / 110540.0   # degrees lat
        turb = np.random.normal(0, 0.0001, size=(2, len(self.lats)))
        self.lats[self.alive]   += dy + turb[0][self.alive]
        self.lngs[self.alive]   += dx + turb[1][self.alive]
        descent = np.maximum(0.5, self.heights / 100.0)
        self.heights[self.alive] -= descent[self.alive]
        self.alive = self.alive & (self.heights > 0)

    def run(self, steps: int = 30) -> dict:
        self._emit_particles()
        for _ in range(steps):
            self._advect_step()
            if not self.alive.any():
                break
        # Bin landed particles into 0.01° grid
        landed_lat = self.lats[~self.alive]
        landed_lng = self.lngs[~self.alive]
        if len(landed_lat) == 0:
            return {"type": "FeatureCollection", "features": []}
        lat_bins = np.round(landed_lat / 0.01) * 0.01
        lng_bins = np.round(landed_lng / 0.01) * 0.01
        coords, counts = np.unique(
            np.stack([lat_bins, lng_bins], axis=1), axis=0, return_counts=True
        )
        counts = counts.astype(float) / counts.max()
        features = []
        for (lat, lng), prob in zip(coords, counts):
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(lng), float(lat)]},
                "properties": {"probability": round(float(prob), 4)}
            })
        return {"type": "FeatureCollection", "features": features}

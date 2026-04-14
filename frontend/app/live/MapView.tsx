// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/store/useStore';
import type { Hotspot, DamageCell, Crew, Shelter, Hospital } from '@/lib/types';

// Fix Leaflet default icon paths for Next.js bundling
const iconPrototype = L.Icon.Default.prototype as unknown as { _getIconUrl?: string };
delete iconPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Color helpers ────────────────────────────────────────────────────────────

function getDamageColorRaw(probability: number): string {
  // Raw hex needed for SVG fill attributes inside Leaflet divIcon HTML strings.
  // These correspond to the design token values: threat-green, threat-amber,
  // threat-orange, threat-red, threat-purple.
  if (probability < 30) return '#10b981';
  if (probability < 55) return '#f59e0b';
  if (probability < 75) return '#f97316';
  if (probability < 90) return '#ef4444';
  return '#a855f7';
}

function getCrewStatusStyle(status: string): { fill: string; border: string; text: string; opacity: number; glow: string } {
  switch (status) {
    case 'active':
      return { fill: '#10b981', border: '#059669', text: '#fff', opacity: 1, glow: '' };
    case 'en_route':
      return { fill: '#f59e0b', border: '#d97706', text: '#fff', opacity: 1, glow: 'box-shadow:0 0 8px rgba(245,158,11,0.6);' };
    case 'standby':
    default:
      return { fill: '#3b82f6', border: '#2563eb', text: '#fff', opacity: 0.7, glow: '' };
  }
}

// ── Organic hull for ember zones ─────────────────────────────────────────────

function deterministicNoise(x: number, seed: number): number {
  const v = Math.sin((x + seed) * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function organicHull(
  points: ReadonlyArray<{ lat: number; lng: number }>,
  seed: number,
  expansionFrac = 0.10,
): [number, number][] {
  if (points.length < 3) return [];
  const cx = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const N = 120;
  const radii = new Array<number>(N).fill(0);

  points.forEach((p) => {
    const dLat = p.lat - cx;
    const dLng = p.lng - cy;
    const angle = Math.atan2(dLng, dLat);
    const idx = (((Math.floor(((angle + Math.PI) / (2 * Math.PI)) * N)) % N) + N) % N;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist > radii[idx]) radii[idx] = dist;
  });

  // Fill empty bins by neighbour interpolation
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      if (radii[i] === 0) {
        let l = i;
        let r = i;
        for (let s = 1; s < N; s++) { if (radii[(i - s + N) % N] > 0) { l = (i - s + N) % N; break; } }
        for (let s = 1; s < N; s++) { if (radii[(i + s) % N] > 0) { r = (i + s) % N; break; } }
        radii[i] = (radii[l] + radii[r]) / 2;
      }
    }
  }

  // Gaussian smooth
  const k = 7;
  const wts = [1, 3, 6, 8, 6, 3, 1];
  const wSum = wts.reduce((a, b) => a + b, 0);
  const smoothed = radii.map((_, i) => {
    let v = 0;
    for (let w = 0; w < k; w++) v += radii[(i + w - Math.floor(k / 2) + N) % N] * wts[w];
    return v / wSum;
  });

  return smoothed.map((r, i) => {
    const t = i / N;
    const angle = t * 2 * Math.PI - Math.PI;
    const noise = (deterministicNoise(t * 3.3, seed) - 0.5) * r * 0.22;
    const finalR = r * (1 + expansionFrac) + noise;
    return [cx + finalR * Math.cos(angle), cy + finalR * Math.sin(angle)] as [number, number];
  });
}

// ── Popup builders ───────────────────────────────────────────────────────────

function hotspotPopup(h: Hotspot): string {
  const color = h.frp > 400 ? '#ef4444' : h.frp > 200 ? '#f97316' : '#f59e0b';
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:10px">
    <b style="color:${color}">HOTSPOT</b><br/>
    FRP: ${h.frp} MW<br/>
    Confidence: ${h.confidence}
  </div>`;
}

function damageCellPopup(cell: DamageCell, pPct: number, color: string): string {
  const soilLabel: Record<string, string> = {
    alluvial: 'Soft ground',
    'sandy loam': 'Sandy soil',
    clay: 'Clay soil',
    bedrock: 'Solid rock',
  };
  const label = soilLabel[cell.soilType?.toLowerCase()] ?? (cell.soilType || 'Unknown');
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:10px">
    <b style="color:${color}">DAMAGE ${pPct}%</b><br/>
    Ground: ${label}
  </div>`;
}

function shelterPopup(s: Shelter): string {
  const occ = s.currentOccupancy ?? s.occupancy ?? 0;
  const cap = s.totalCapacity ?? s.capacity ?? 1;
  const ratio = occ / cap;
  const pct = Math.round(ratio * 100);
  const color = ratio >= 0.8 ? '#ef4444' : ratio >= 0.6 ? '#f59e0b' : '#22c55e';
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;min-width:170px">
    <div style="font-weight:700;color:#3b82f6;margin-bottom:4px">SHELTER</div>
    <div style="font-weight:600;margin-bottom:2px">${s.name}</div>
    <div>Occupancy: <b>${occ}/${cap}</b> (${pct}%)</div>
    <div style="height:4px;background:#1e1e2a;border-radius:2px;margin:4px 0">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
    </div>
  </div>`;
}

function hospitalPopup(h: Hospital): string {
  const cap = h.remainingCapacity ?? h.currentCapacity ?? 0;
  const alertColor =
    h.alertLevel === 'critical' ? '#ef4444' : h.alertLevel === 'elevated' ? '#f59e0b' : '#94a3b8';
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;min-width:170px">
    <div style="font-weight:700;color:#ef4444;margin-bottom:4px">HOSPITAL</div>
    <div style="font-weight:600;margin-bottom:2px">${h.name}</div>
    <div>Remaining capacity: <b>${cap}</b></div>
    <div>Alert: <b style="color:${alertColor}">${h.alertLevel.toUpperCase()}</b></div>
  </div>`;
}

function crewPopup(crew: Crew): string {
  const label = crew.label ?? crew.id;
  const status = (crew.status ?? 'standby').replace('_', ' ').toUpperCase();
  return `<div style="font-family:'JetBrains Mono',monospace;font-size:10px">
    <b>${label}</b><br/>
    Status: ${status}<br/>
    Personnel: ${crew.personnel}
  </div>`;
}

// ── MapView component ────────────────────────────────────────────────────────

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer groups
  const fireLayerRef = useRef<L.LayerGroup | null>(null);
  const emberLayerRef = useRef<L.LayerGroup | null>(null);
  const seismicLayerRef = useRef<L.LayerGroup | null>(null);
  const crewsLayerRef = useRef<L.LayerGroup | null>(null);
  const infraLayerRef = useRef<L.LayerGroup | null>(null);
  const epicenterLayerRef = useRef<L.LayerGroup | null>(null);

  // Track already-rendered damage cells for incremental animation
  const renderedCellIdsRef = useRef<Set<string>>(new Set());

  // Store selectors
  const hotspots = useStore((s) => s.hotspots);
  const emberZones = useStore((s) => s.emberZones);
  const damageCells = useStore((s) => s.damageCells);
  const seismicEvents = useStore((s) => s.seismicEvents);
  const crews = useStore((s) => s.crews);
  const shelters = useStore((s) => s.shelters);
  const hospitals = useStore((s) => s.hospitals);
  const layers = useStore((s) => s.layers);

  // ── Initialize map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [34.21, -118.53],
      zoom: 11,
      zoomControl: true,
      minZoom: 7,
      maxBounds: L.latLngBounds(L.latLng(32.5, -124.5), L.latLng(42.0, -114.0)),
      maxBoundsViscosity: 1.0,
    });

    // CartoDB dark tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Create layer groups
    fireLayerRef.current = L.layerGroup().addTo(map);
    emberLayerRef.current = L.layerGroup().addTo(map);
    seismicLayerRef.current = L.layerGroup().addTo(map);
    epicenterLayerRef.current = L.layerGroup().addTo(map);
    crewsLayerRef.current = L.layerGroup().addTo(map);
    infraLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      fireLayerRef.current = null;
      emberLayerRef.current = null;
      seismicLayerRef.current = null;
      epicenterLayerRef.current = null;
      crewsLayerRef.current = null;
      infraLayerRef.current = null;
      renderedCellIdsRef.current.clear();
    };
  }, []);

  // ── Fire layer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = fireLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!layers.fire || hotspots.length === 0) return;

    hotspots.forEach((h) => {
      const frp = h.frp ?? 0;
      const color = frp > 400 ? '#ef4444' : frp > 200 ? '#f97316' : '#f59e0b';
      const radius = Math.max(5, Math.min(14, Math.round(frp / 40)));

      L.circleMarker([h.lat, h.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.4,
        weight: 2,
        opacity: 0.9,
      })
        .bindTooltip(hotspotPopup(h), { direction: 'top', offset: [0, -radius] })
        .addTo(layer);
    });
  }, [layers.fire, hotspots]);

  // ── Ember layer ────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = emberLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!layers.ember || emberZones.length < 4) return;

    // Outer hull
    const outerPts = organicHull(emberZones, 42, 0.14);
    if (outerPts.length >= 3) {
      L.polygon(outerPts, {
        color: '#f97316',
        weight: 2.5,
        opacity: 0.95,
        fillColor: '#f97316',
        fillOpacity: 0.15,
      }).addTo(layer);
    }

    // Inner hull for high probability
    const highProb = emberZones.filter((z) => {
      const p = z.probability > 1 ? z.probability / 100 : z.probability;
      return p > 0.58;
    });
    if (highProb.length >= 4) {
      const innerPts = organicHull(highProb, 17, 0.06);
      if (innerPts.length >= 3) {
        L.polygon(innerPts, {
          color: '#ef4444',
          weight: 2,
          opacity: 0.90,
          fillColor: '#ef4444',
          fillOpacity: 0.12,
        }).addTo(layer);
      }
    }

    // Individual ember zone circles
    emberZones.forEach((z) => {
      const prob = z.probability > 1 ? z.probability / 100 : z.probability;
      L.circleMarker([z.lat, z.lng], {
        radius: 3,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: prob * 0.6,
        weight: 0,
      }).addTo(layer);
    });
  }, [layers.ember, emberZones]);

  // ── Seismic / damage layer ─────────────────────────────────────────────
  useEffect(() => {
    const layer = seismicLayerRef.current;
    if (!layer) return;

    if (damageCells.length === 0) {
      layer.clearLayers();
      renderedCellIdsRef.current.clear();
      return;
    }
    if (!layers.seismic) {
      layer.clearLayers();
      renderedCellIdsRef.current.clear();
      return;
    }

    damageCells.forEach((cell) => {
      if (renderedCellIdsRef.current.has(cell.id)) return;
      renderedCellIdsRef.current.add(cell.id);

      const p = cell.probability > 1 ? cell.probability / 100 : cell.probability;
      const pPct = Math.round(p * 100);
      const color = getDamageColorRaw(pPct);

      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.5 1L14 6.5H11.5V13.5H3.5V6.5H1L7.5 1Z" fill="${color}33" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M7.5 5L6.5 7.5L8 8.5L7 12" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`,
        className: 'damage-cell-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([cell.lat, cell.lng], { icon })
        .bindTooltip(damageCellPopup(cell, pPct, color), { direction: 'top' })
        .addTo(layer);
    });
  }, [layers.seismic, damageCells]);

  // ── Epicenter markers ──────────────────────────────────────────────────
  useEffect(() => {
    const layer = epicenterLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!layers.seismic || seismicEvents.length === 0) return;

    const latest = seismicEvents[seismicEvents.length - 1];
    if (!latest.lat || !latest.lng) return;
    const mag = latest.magnitude ?? 6.7;
    const depth = latest.depth ?? 17;

    // Crosshair icon
    const crosshairIcon = L.divIcon({
      html: `<div style="position:relative;width:16px;height:16px;">
        <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#fff;transform:translateY(-50%);opacity:0.8;"></div>
        <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:#fff;transform:translateX(-50%);opacity:0.8;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;border-radius:50%;background:#ef4444;box-shadow:0 0 5px #ef4444;"></div>
      </div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    L.marker([latest.lat, latest.lng], { icon: crosshairIcon })
      .bindTooltip(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:10px"><b style="color:#ef4444">M${mag} - ${depth}km depth</b><br/>Epicenter</div>`,
        { direction: 'top', offset: [0, -10] }
      )
      .addTo(layer);

    // Animated seismic rings
    const ringsIcon = L.divIcon({
      html: `<div style="position:relative;width:0;height:0;">
        <div style="position:absolute;border-radius:50%;border:1px solid rgba(239,68,68,0.7);transform:translate(-50%,-50%) scale(0);animation:seismic-ring 2.5s ease-out 0s infinite;width:24px;height:24px;"></div>
        <div style="position:absolute;border-radius:50%;border:1px solid rgba(239,68,68,0.45);transform:translate(-50%,-50%) scale(0);animation:seismic-ring 2.5s ease-out 0.5s infinite;width:44px;height:44px;"></div>
        <div style="position:absolute;border-radius:50%;border:1px solid rgba(239,68,68,0.25);transform:translate(-50%,-50%) scale(0);animation:seismic-ring 2.5s ease-out 1.0s infinite;width:68px;height:68px;"></div>
      </div>`,
      className: '',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker([latest.lat, latest.lng], { icon: ringsIcon, interactive: false }).addTo(layer);
  }, [layers.seismic, seismicEvents]);

  // ── Crews layer ────────────────────────────────────────────────────────
  useEffect(() => {
    const layer = crewsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!layers.crews) return;

    const crewList: ReadonlyArray<Crew> = crews.length > 0
      ? crews
      : [
          { id: 'crew_001', label: 'Crew 1', status: 'standby' as const, lat: 34.210, lng: -118.540, personnel: 10, assignedZoneId: null, lastUpdated: new Date() },
          { id: 'crew_002', label: 'Crew 2', status: 'standby' as const, lat: 34.274, lng: -118.500, personnel: 8, assignedZoneId: null, lastUpdated: new Date() },
          { id: 'crew_003', label: 'Crew 3', status: 'standby' as const, lat: 34.260, lng: -118.449, personnel: 12, assignedZoneId: null, lastUpdated: new Date() },
          { id: 'crew_004', label: 'Crew 4', status: 'standby' as const, lat: 34.238, lng: -118.478, personnel: 9, assignedZoneId: null, lastUpdated: new Date() },
          { id: 'crew_005', label: 'Crew 5', status: 'standby' as const, lat: 34.169, lng: -118.593, personnel: 11, assignedZoneId: null, lastUpdated: new Date() },
        ];

    crewList.forEach((crew) => {
      const s = getCrewStatusStyle(crew.status);
      const label = crew.label ?? crew.id;
      const icon = L.divIcon({
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${s.fill};border:2px solid ${s.border};color:${s.text};opacity:${s.opacity};font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;${s.glow}">${label}</div>`,
        className: 'crew-marker-icon',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([crew.lat, crew.lng], { icon })
        .bindTooltip(crewPopup(crew), { direction: 'top', offset: [0, -12] })
        .addTo(layer);
    });
  }, [layers.crews, crews]);

  // ── Infrastructure layer ───────────────────────────────────────────────
  useEffect(() => {
    const layer = infraLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!layers.infrastructure) return;

    // Shelters
    shelters.forEach((s) => {
      const occ = s.currentOccupancy ?? s.occupancy ?? 0;
      const cap = s.totalCapacity ?? s.capacity ?? 1;
      const ratio = occ / cap;
      const color = ratio >= 0.8 ? '#ef4444' : ratio >= 0.6 ? '#f59e0b' : '#22c55e';
      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:${color}22;border:1.5px solid ${color};border-radius:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="${color}">
            <path d="M5 0L0 4h1.5v5.5h7V4H10L5 0z"/>
          </svg>
        </div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([s.lat, s.lng], { icon })
        .bindPopup(shelterPopup(s), { maxWidth: 220 })
        .addTo(layer);
    });

    // Hospitals
    hospitals.forEach((h) => {
      const alertColor =
        h.alertLevel === 'critical' ? '#ef4444' : h.alertLevel === 'elevated' ? '#f59e0b' : '#94a3b8';
      const icon = L.divIcon({
        html: `<div style="width:16px;height:16px;background:${alertColor}22;border:1.5px solid ${alertColor};border-radius:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="${alertColor}">
            <path d="M4 0v4H0v2h4v4h2V6h4V4H6V0H4z"/>
          </svg>
        </div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([h.lat, h.lng], { icon })
        .bindPopup(hospitalPopup(h), { maxWidth: 220 })
        .addTo(layer);
    });
  }, [layers.infrastructure, shelters, hospitals]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-md border border-border"
    />
  );
}

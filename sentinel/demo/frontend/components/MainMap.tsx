'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/store/useStore';

// Fix Leaflet icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Mock data ─────────────────────────────────────────────────────────────────

const EMBER_ZONES: { lat: number; lng: number; probability: number }[] = [];
(() => {
  // Generate ember heatmap around hotspot H003
  const cx = 34.18; const cy = -118.60;
  for (let dlat = -0.08; dlat <= 0.08; dlat += 0.01) {
    for (let dlng = -0.02; dlng <= 0.12; dlng += 0.01) {
      // Wind blowing east — probability drops off with distance and goes east
      const dist = Math.sqrt(dlat * dlat + (dlng - 0.05) * (dlng - 0.05));
      const prob = Math.round(90 - dist * 600 + (Math.random() * 10 - 5));
      if (prob > 20) EMBER_ZONES.push({ lat: cx + dlat, lng: cy + dlng, probability: Math.min(95, Math.max(21, prob)) });
    }
  }
})();

// Northridge epicenter
const EPICENTER = { lat: 34.213, lng: -118.537, magnitude: 6.7, depth: 17 };

// Damage cells around Northridge epicenter
const DAMAGE_CELLS: { lat: number; lng: number; prob: number; soil: string; liq: string }[] = [];
(() => {
  const cx = EPICENTER.lat; const cy = EPICENTER.lng;
  const soilTypes = ['alluvial', 'bedrock', 'coastal sand', 'alluvial', 'bedrock'];
  const liqClasses = ['high', 'none', 'moderate', 'high', 'low'];
  for (let dlat = -0.15; dlat <= 0.15; dlat += 0.01) {
    for (let dlng = -0.15; dlng <= 0.15; dlng += 0.01) {
      const dist = Math.sqrt(dlat * dlat + dlng * dlng);
      const base = 95 - dist * 500;
      if (base < 5) continue;
      const prob = Math.min(98, Math.max(6, base + (Math.random() * 20 - 10)));
      const si = Math.floor(Math.random() * soilTypes.length);
      DAMAGE_CELLS.push({ lat: cx + dlat, lng: cy + dlng, prob: Math.round(prob), soil: soilTypes[si], liq: liqClasses[si] });
    }
  }
})();

const SHELTERS = [
  { id: 's1', name: 'Sylmar Recreation Center', lat: 34.29, lng: -118.44, occ: 320, cap: 400 },
  { id: 's2', name: 'Van Nuys Recreation Center', lat: 34.19, lng: -118.45, occ: 180, cap: 350 },
  { id: 's3', name: 'Chatsworth Park', lat: 34.26, lng: -118.60, occ: 50, cap: 200 },
];

const HOSPITALS = [
  { id: 'h1', name: 'Cedars-Sinai Medical Center', lat: 34.075, lng: -118.381, cap: 120, alert: 'elevated' as const },
  { id: 'h2', name: 'UCLA Medical Center', lat: 34.066, lng: -118.446, cap: 85, alert: 'normal' as const },
  { id: 'h3', name: 'Providence St. Joseph', lat: 34.18, lng: -118.31, cap: 60, alert: 'critical' as const },
];

// ── Organic geometry helpers ───────────────────────────────────────────────────

const _dnoise = (x: number, s: number = 0): number => {
  const v = Math.sin((x + s) * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Build an organic hull polygon from a cloud of lat/lng points. */
function organicHull(
  points: { lat: number; lng: number }[],
  seed: number,
  expansionFrac = 0.10,
): [number, number][] {
  if (points.length < 3) return [];
  const cx = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const N = 120;
  const radii = new Array(N).fill(0);

  points.forEach(p => {
    const dLat = p.lat - cx;
    const dLng = p.lng - cy;
    const angle = Math.atan2(dLng, dLat);
    const idx = (((Math.floor(((angle + Math.PI) / (2 * Math.PI)) * N)) % N) + N) % N;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist > radii[idx]) radii[idx] = dist;
  });

  // Fill empty bins by neighbour interpolation (two passes)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      if (radii[i] === 0) {
        let l = i, r = i;
        for (let s = 1; s < N; s++) { if (radii[(i - s + N) % N] > 0) { l = (i - s + N) % N; break; } }
        for (let s = 1; s < N; s++) { if (radii[(i + s) % N] > 0) { r = (i + s) % N; break; } }
        radii[i] = (radii[l] + radii[r]) / 2;
      }
    }
  }

  // Gaussian smooth (k=7)
  const k = 7; const wts = [1, 3, 6, 8, 6, 3, 1]; const wSum = wts.reduce((a, b) => a + b, 0);
  const smoothed = radii.map((_, i) => {
    let v = 0;
    for (let w = 0; w < k; w++) v += radii[(i + w - Math.floor(k / 2) + N) % N] * wts[w];
    return v / wSum;
  });

  // Generate vertices with expansion + organic noise
  return smoothed.map((r, i) => {
    const t = i / N;
    const angle = t * 2 * Math.PI - Math.PI;
    const noise = (_dnoise(t * 3.3, seed) - 0.5) * r * 0.22;
    const finalR = r * (1 + expansionFrac) + noise;
    return [cx + finalR * Math.cos(angle), cy + finalR * Math.sin(angle)] as [number, number];
  });
}

// ── Color helpers ─────────────────────────────────────────────────────────────

// Seismic damage severity ramp — four distinct hues so commanders
// can read zone intensity at a glance without confusing with fire (red/orange).
function getDamageColor(p: number): string {
  if (p < 30) return '#4ade80';  // green  — low structural risk
  if (p < 55) return '#facc15';  // yellow — moderate
  if (p < 75) return '#fb923c';  // amber  — high
  return '#f43f5e';              // rose   — critical collapse risk
}

function getEmberOpacity(p: number): number {
  if (p < 30) return 0;
  return (p - 30) / 70 * 0.75;
}

function getEmberColor(p: number): string {
  if (p < 65) return '#f59e0b';
  if (p < 75) return '#f97316';
  return '#ef4444';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MainMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dynHotspotsRef = useRef<L.LayerGroup | null>(null);
  const dynEmbersRef = useRef<L.LayerGroup | null>(null);
  const dynDamageRef = useRef<L.LayerGroup | null>(null);
  const dynEpicenterRef = useRef<L.LayerGroup | null>(null);
  const dynCrewsRef = useRef<L.LayerGroup | null>(null);
  const crewMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  // Tracks which damage cell IDs are already on the map so we only animate new arrivals
  const renderedCellIdsRef = useRef<Set<string>>(new Set());

  const storeHotspots = useStore(s => s.hotspots);
  const storeEmberZones = useStore(s => s.emberZones);
  const storeDamageCells = useStore(s => s.damageCells);
  const storeSeismicEvents = useStore(s => s.seismicEvents);
  const storeCrews = useStore(s => s.crews);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const californiaBounds = L.latLngBounds(
      L.latLng(32.5, -124.5),
      L.latLng(42.0, -114.0),
    );

    const map = L.map(containerRef.current, {
      center: [34.15, -118.50],
      zoom: 10,
      zoomControl: true,
      maxBounds: californiaBounds,
      maxBoundsViscosity: 1.0,
      minZoom: 7,
    });

    // ESRI World Imagery (satellite)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    }).addTo(map);

    // Satellite label overlay (roads/places on top)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '',
      subdomains: 'abcd',
      maxZoom: 19,
      opacity: 0.7,
    }).addTo(map);

    // ── Layer 5: Infrastructure ──
    SHELTERS.forEach(s => {
      const ratio = s.occ / s.cap;
      const color = ratio >= 0.8 ? '#ef4444' : ratio >= 0.6 ? '#f59e0b' : '#22c55e';
      const pct = Math.round(ratio * 100);
      const icon = L.divIcon({
        html: `<div style="
          width:16px;height:16px;background:${color}22;
          border:1.5px solid ${color};border-radius:2px;
          display:flex;align-items:center;justify-content:center;cursor:pointer;
        ">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="${color}">
            <path d="M5 0L0 4h1.5v5.5h7V4H10L5 0z"/>
          </svg>
        </div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      });
      L.marker([s.lat, s.lng], { icon }).bindPopup(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;min-width:170px">
          <div style="font-weight:700;color:#3b82f6;margin-bottom:4px">SHELTER</div>
          <div style="font-weight:600;margin-bottom:2px">${s.name}</div>
          <div>Occupancy: <b>${s.occ}/${s.cap}</b> (${pct}%)</div>
          <div style="height:4px;background:#1e1e2a;border-radius:2px;margin:4px 0">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
          </div>
        </div>`,
        { maxWidth: 220 }
      ).addTo(map);
    });

    HOSPITALS.forEach(h => {
      const c = h.alert === 'critical' ? '#ef4444' : h.alert === 'elevated' ? '#f59e0b' : '#94a3b8';
      const icon = L.divIcon({
        html: `<div style="
          width:16px;height:16px;background:${c}22;
          border:1.5px solid ${c};border-radius:2px;
          display:flex;align-items:center;justify-content:center;cursor:pointer;
        ">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="${c}">
            <path d="M4 0v4H0v2h4v4h2V6h4V4H6V0H4z"/>
          </svg>
        </div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      });
      L.marker([h.lat, h.lng], { icon }).bindPopup(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;min-width:170px">
          <div style="font-weight:700;color:#ef4444;margin-bottom:4px">HOSPITAL</div>
          <div style="font-weight:600;margin-bottom:2px">${h.name}</div>
          <div>Remaining capacity: <b>${h.cap}</b></div>
          <div>Alert: <b style="color:${c}">${h.alert.toUpperCase()}</b></div>
        </div>`,
        { maxWidth: 220 }
      ).addTo(map);
    });

    // WS status HUD
    const wsHud = (L.control as any)({ position: 'bottomleft' });
    wsHud.onAdd = () => {
      const d = L.DomUtil.create('div');
      d.style.cssText = 'background:rgba(13,13,18,0.9);border:1px solid #1e1e2a;padding:4px 8px;border-radius:4px;font-family:"JetBrains Mono",monospace;font-size:9px;display:flex;align-items:center;gap:5px;';
      d.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;box-shadow:0 0 4px #22c55e;"></span><span style="color:#22c55e">Live · 12ms</span>`;
      return d;
    };
    wsHud.addTo(map);

    // Dynamic layer groups (updated reactively from store)
    dynHotspotsRef.current = L.layerGroup().addTo(map);
    dynEmbersRef.current = L.layerGroup().addTo(map);
    dynDamageRef.current = L.layerGroup().addTo(map);
    dynEpicenterRef.current = L.layerGroup().addTo(map);
    dynCrewsRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      dynHotspotsRef.current = null;
      dynEmbersRef.current = null;
      dynDamageRef.current = null;
      dynEpicenterRef.current = null;
      dynCrewsRef.current = null;
      crewMarkersRef.current.clear();
    };
  }, []);

  // Render store hotspots dynamically
  useEffect(() => {
    const layer = dynHotspotsRef.current;
    if (!layer || storeHotspots.length === 0) return;
    layer.clearLayers();
    storeHotspots.forEach(h => {
      const frp = h.frp ?? 0;
      const color = frp > 400 ? '#ef4444' : frp > 200 ? '#f97316' : '#f59e0b';
      const size = Math.max(10, Math.min(22, Math.round(frp / 30)));
      const icon = L.divIcon({
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color}44;border:2px solid ${color};
          box-shadow:0 0 ${size}px ${color}88;
          cursor:pointer;
        "></div>`,
        className: 'hotspot-icon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([h.lat, h.lng], { icon }).bindTooltip(
        `<div style="font-family:'JetBrains Mono',monospace;font-size:10px">
          <b style="color:${color}">HOTSPOT</b><br/>
          FRP: ${frp} MW<br/>
          Confidence: ${h.confidence}
        </div>`,
        { direction: 'top', offset: [0, -size / 2] }
      ).addTo(layer);
    });
  }, [storeHotspots]);

  // Render damage cells from store — incremental so each cell grows in only once
  useEffect(() => {
    const layer = dynDamageRef.current;
    if (!layer) return;

    // Simulation reset — clear everything
    if (storeDamageCells.length === 0) {
      layer.clearLayers();
      renderedCellIdsRef.current.clear();
      return;
    }

    const soilLabel: Record<string, string> = {
      alluvial:     'Soft ground',
      'sandy loam': 'Sandy soil',
      clay:         'Clay soil',
      bedrock:      'Solid rock',
    };

    storeDamageCells.forEach(cell => {
      // Skip cells already on the map — only animate new arrivals
      if (renderedCellIdsRef.current.has(cell.id)) return;
      renderedCellIdsRef.current.add(cell.id);

      const p = cell.probability > 1 ? cell.probability / 100 : cell.probability;
      const pPct = Math.round(p * 100);
      const color = getDamageColor(pPct);

      // Building-with-crack icon — shape communicates structural damage,
      // color still encodes severity (green → yellow → amber → rose)
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

      const label = soilLabel[cell.soilType?.toLowerCase()] ?? (cell.soilType || 'Unknown');
      L.marker([cell.lat, cell.lng], { icon })
        .bindTooltip(
          `<div style="font-family:'JetBrains Mono',monospace;font-size:10px">
            <b style="color:${color}">DAMAGE ${pPct}%</b><br/>
            Ground: ${label}
          </div>`,
          { direction: 'top' }
        )
        .addTo(layer);
    });
  }, [storeDamageCells]);

  // Render ember zones as organic wave-contour polygons
  useEffect(() => {
    const layer = dynEmbersRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (storeEmberZones.length < 4) return;

    // Outer hull — all zones, solid orange outline
    const outerPts = organicHull(storeEmberZones, 42, 0.14);
    if (outerPts.length >= 3) {
      L.polygon(outerPts, {
        color: '#f97316',
        weight: 2.5,
        opacity: 0.95,
        fillColor: '#f97316',
        fillOpacity: 0.15,
      }).addTo(layer);
    }

    // Inner hull — high-probability zones only, solid red outline
    const highProb = storeEmberZones.filter(z => {
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
  }, [storeEmberZones]);

  useEffect(() => {
    const layer = dynCrewsRef.current;
    if (!layer) return;

    const STATUS_STYLE: Record<string, { fill: string; border: string; text: string; opacity: number }> = {
      active:   { fill: '#22c55e', border: '#16a34a', text: '#fff', opacity: 1 },
      en_route: { fill: '#3b82f6', border: '#2563eb', text: '#fff', opacity: 1 },
      standby:  { fill: 'transparent', border: '#475569', text: '#475569', opacity: 0.65 },
    };

    if (storeCrews.length === 0) {
      // Fall back to fire station positions if store has no crews
      const fallback = [
        { id: 'crew_001', label: 'Crew 1', status: 'standby', lat: 34.210, lng: -118.540 }, // Sta. 74 Reseda
        { id: 'crew_002', label: 'Crew 2', status: 'standby', lat: 34.274, lng: -118.500 }, // Sta. 87 Granada Hills
        { id: 'crew_003', label: 'Crew 3', status: 'standby', lat: 34.260, lng: -118.449 }, // Sta. 98 Mission Hills
        { id: 'crew_004', label: 'Crew 4', status: 'standby', lat: 34.238, lng: -118.478 }, // Sta. 88 North Hills
        { id: 'crew_005', label: 'Crew 5', status: 'standby', lat: 34.169, lng: -118.593 }, // Sta. 77 Woodland Hills
      ];
      fallback.forEach(crew => {
        const s = STATUS_STYLE[crew.status] ?? STATUS_STYLE.standby;
        const existing = crewMarkersRef.current.get(crew.id);
        if (existing) return;
        const icon = L.divIcon({
          html: `<div style="width:22px;height:22px;border-radius:50%;background:${s.fill};border:2px solid ${s.border};color:${s.text};opacity:${s.opacity};font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;">${crew.label}</div>`,
          className: 'crew-marker-icon', iconSize: [22, 22], iconAnchor: [11, 11],
        });
        const marker = L.marker([crew.lat, crew.lng], { icon });
        marker.addTo(layer);
        crewMarkersRef.current.set(crew.id, marker);
      });
      return;
    }

    storeCrews.forEach(crew => {
      const status = (crew.status as string) ?? 'standby';
      const s = STATUS_STYLE[status] ?? STATUS_STYLE.standby;
      const label = crew.label ?? crew.id;
      const existing = crewMarkersRef.current.get(crew.id);
      const icon = L.divIcon({
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${s.fill};border:2px solid ${s.border};color:${s.text};opacity:${s.opacity};font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;${status === 'en_route' ? 'box-shadow:0 0 8px rgba(59,130,246,0.6);' : ''}">${label}</div>`,
        className: 'crew-marker-icon', iconSize: [22, 22], iconAnchor: [11, 11],
      });
      if (existing) {
        const cur = existing.getLatLng();
        if (Math.abs(cur.lat - crew.lat) > 0.0001 || Math.abs(cur.lng - crew.lng) > 0.0001) {
          existing.setLatLng([crew.lat, crew.lng]);
        }
        existing.setIcon(icon);
      } else {
        const marker = L.marker([crew.lat, crew.lng], { icon });
        marker.bindTooltip(`<div style="font-family:'JetBrains Mono',monospace;font-size:10px"><b>${label}</b><br/>Status: ${status.replace('_',' ').toUpperCase()}</div>`, { direction: 'top', offset: [0, -12] });
        marker.addTo(layer);
        crewMarkersRef.current.set(crew.id, marker);
      }
    });
  }, [storeCrews]);

  useEffect(() => {
    const layer = dynEpicenterRef.current;
    if (!layer || storeSeismicEvents.length === 0) return;
    layer.clearLayers();

    const latest = storeSeismicEvents[storeSeismicEvents.length - 1];
    const lat = (latest as any).lat;
    const lng = (latest as any).lng;
    const mag = (latest as any).magnitude ?? 6.7;
    const depth = (latest as any).depth ?? 17;
    if (!lat || !lng) return;

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
    L.marker([lat, lng], { icon: crosshairIcon })
      .bindTooltip(`<div style="font-family:'JetBrains Mono',monospace;font-size:10px"><b style="color:#ef4444">M${mag} — ${depth}km depth</b><br/>Northridge Epicenter</div>`, { direction: 'top', offset: [0, -10] })
      .addTo(layer);

    // Animated seismic rings using divIcon — compact sizes
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
    L.marker([lat, lng], { icon: ringsIcon, interactive: false }).addTo(layer);
  }, [storeSeismicEvents]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

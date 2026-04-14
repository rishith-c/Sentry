'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { speakActionCard } from '@/lib/tts';
import type { ActionType, DamageCell, EmberZone, EventCategory, Hotspot } from '@/lib/types';

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000') + '/ws';
const MAX_ATTEMPTS = 10;

type SocketMessage = {
  type: string;
  data?: unknown;
  description?: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(record: JsonRecord, key: string, fallback = ''): string {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
}

function readNumber(record: JsonRecord, key: string, fallback = 0): number {
  const value = record[key];
  return typeof value === 'number' ? value : fallback;
}

function normalizeHotspot(record: JsonRecord): Hotspot {
  const confidence = readString(record, 'confidence', 'nominal');
  return {
    id: String(record.id ?? crypto.randomUUID()),
    lat: readNumber(record, 'lat'),
    lng: readNumber(record, 'lng'),
    frp: readNumber(record, 'frp'),
    confidence:
      confidence === 'high' || confidence === 'low' ? confidence : 'nominal',
    detectedAt: record.detected_at ? new Date(String(record.detected_at)) : new Date(),
  };
}

function normalizeEmberZone(record: JsonRecord): EmberZone {
  return {
    id: String(record.id ?? crypto.randomUUID()),
    lat: readNumber(record, 'lat'),
    lng: readNumber(record, 'lng'),
    probability: readNumber(record, 'probability'),
    hotspotId: String(record.hotspot_id ?? ''),
    forecastTs: record.forecast_ts ? new Date(String(record.forecast_ts)) : new Date(),
    nearestHotspotId: String(record.hotspot_id ?? ''),
    windSpeed: readNumber(record, 'wind_speed', 6.5),
    windDirection: readNumber(record, 'wind_direction', 270),
  };
}

function normalizeDamageCell(record: JsonRecord, index = 0): DamageCell {
  const rawProbability =
    typeof record.damage_prob === 'number'
      ? record.damage_prob
      : typeof record.damage_probability === 'number'
        ? record.damage_probability
        : readNumber(record, 'probability');
  const probability = rawProbability <= 1 ? Math.round(rawProbability * 100) : rawProbability;
  const liquefactionValue =
    readString(record, 'liquefaction_class', 'moderate').toLowerCase();

  return {
    id: String(record.id ?? `${index}-${record.lat ?? 0}-${record.lng ?? 0}`),
    lat: readNumber(record, 'lat'),
    lng: readNumber(record, 'lng'),
    probability,
    soilType: readString(record, 'soil_type', 'unknown'),
    liquefactionClass:
      liquefactionValue === 'none' ||
      liquefactionValue === 'low' ||
      liquefactionValue === 'moderate' ||
      liquefactionValue === 'high' ||
      liquefactionValue === 'very high'
        ? liquefactionValue
        : 'moderate',
    computedAt: new Date(),
    seismicEventId: String(record.event_id ?? 'stream'),
    distanceFromEpicenter: 0,
  };
}

function normalizeActionType(value: unknown): ActionType {
  switch (String(value ?? '').toUpperCase()) {
    case 'REPOSITION':
      return 'REPOSITION';
    case 'DISPATCH':
      return 'DISPATCH';
    case 'EVACUATE':
      return 'EVACUATE';
    default:
      return 'ALERT';
  }
}

function inferEventCategory(description: string): EventCategory {
  const text = description.toLowerCase();
  if (
    text.includes('fire') ||
    text.includes('hotspot') ||
    text.includes('frp') ||
    text.includes('ember')
  ) {
    return 'fire';
  }
  if (
    text.includes('seismic') ||
    text.includes('damage') ||
    text.includes('collapse') ||
    text.includes('pga') ||
    text.includes('cnn') ||
    text.includes('liquefaction')
  ) {
    return 'seismic';
  }
  if (text.includes('crew') || text.includes('dispatch') || text.includes('reposition')) {
    return 'crew';
  }
  if (
    text.includes('shelter') ||
    text.includes('hospital') ||
    text.includes('gas') ||
    text.includes('water')
  ) {
    return 'infrastructure';
  }
  if (text.includes('aip') || text.includes('agent') || text.includes('recommendation')) {
    return 'aip';
  }
  return 'system';
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        useStore.getState().setWsState('connected', 0);
      };

      ws.onmessage = (event) => {
        let message: SocketMessage;
        try {
          message = JSON.parse(event.data) as SocketMessage;
        } catch {
          return;
        }

        const store = useStore.getState();
        const { type, data } = message;
        const record = asRecord(data);

        switch (type) {
          case 'hotspot_new':
            if (!record) break;
            store.addHotspot(normalizeHotspot(record));
            store.addCommsMessage({
              from: 'FIRMS_POLLER',
              to: 'EMBER_SIM',
              text: `Hotspot detected at ${readNumber(record, 'lat')}, ${readNumber(record, 'lng')}. FRP ${readNumber(record, 'frp')}MW. Confidence: ${readString(record, 'confidence', 'nominal')}.`,
            });
            break;
          case 'fire_hotspots':
            if (!Array.isArray(data)) break;
            data
              .map(asRecord)
              .filter((item): item is JsonRecord => item !== null)
              .forEach((item) => store.addHotspot(normalizeHotspot(item)));
            break;
          case 'ember_zone_new':
            if (!record) break;
            store.setEmberZones([...store.emberZones, normalizeEmberZone(record)]);
            break;
          case 'ember_update':
          case 'ember_risk':
            if (!Array.isArray(data)) break;
            const emberZones = data
              .map(asRecord)
              .filter((item): item is JsonRecord => item !== null)
              .map(normalizeEmberZone);
            store.setEmberZones(emberZones);
            if (emberZones.length > 0) {
              const probabilities = emberZones.map((zone) => zone.probability);
              const minProbability = Math.min(...probabilities).toFixed(0);
              const maxProbability = Math.max(...probabilities).toFixed(0);
              store.addCommsMessage({
                from: 'EMBER_SIM',
                to: 'BROADCASTER',
                text: `${emberZones.length} ember risk zones computed. Probability range ${minProbability}-${maxProbability}%. Wind ${emberZones[0].windSpeed}m/s at ${emberZones[0].windDirection} degrees. Broadcasting heatmap.`,
              });
            }
            break;
          case 'seismic_event':
            if (!record) break;
            store.setSeismicEvents([
              ...store.seismicEvents,
              {
                id: String(record.id ?? crypto.randomUUID()),
                lat: readNumber(record, 'lat'),
                lng: readNumber(record, 'lng'),
                magnitude: readNumber(record, 'magnitude'),
                depth: readNumber(record, 'depth'),
                detectedAt: record.detected_at ? new Date(String(record.detected_at)) : new Date(),
              },
            ]);
            store.addCommsMessage({
              from: 'USGS_POLLER',
              to: 'SEISMIC_CNN',
              text: `Seismic event detected. M${readNumber(record, 'magnitude')} depth ${readNumber(record, 'depth')}km at ${readNumber(record, 'lat')}, ${readNumber(record, 'lng')}. Forwarding waveform data.`,
            });
            store.addCommsMessage({
              from: 'SEISMIC_CNN',
              to: 'GMPE_ENGINE',
              text: `Inference complete. Magnitude confirmed ${readNumber(record, 'magnitude')}. Initiating GMPE pipeline.`,
            });
            break;
          case 'seismic_grid':
          case 'damage_grid':
            if (Array.isArray(data)) {
              const damageCells = data
                .map(asRecord)
                .filter((item): item is JsonRecord => item !== null)
                .map((item, index) => normalizeDamageCell(item, index));
              store.addDamageCells(damageCells);
            } else if (record) {
              store.addDamageCells([normalizeDamageCell(record)]);
            }
            break;
          case 'epicenter_marker':
            if (!record) break;
            store.setSeismicEvents([
              {
                id: String(record.id ?? crypto.randomUUID()),
                lat: readNumber(record, 'lat'),
                lng: readNumber(record, 'lng'),
                magnitude: readNumber(record, 'magnitude', 6.7),
                depth: readNumber(record, 'depth', 17),
                detectedAt: new Date(),
              },
            ]);
            break;
          case 'damage_zones':
            if (!Array.isArray(data)) break;
            store.addDamageCells(
              data
                .map(asRecord)
                .filter((item): item is JsonRecord => item !== null)
                .map((item, index) => normalizeDamageCell(item, index))
            );
            break;
          case 'action_card_new':
            if (!record) break;
            store.addActionCard(record as never);
            store.incrementUnreadNotifications();
            break;
          case 'simulation_started':
            store.setSimulating(true);
            store.addEvent({
              id: record ? String(record.id ?? crypto.randomUUID()) : crypto.randomUUID(),
              timestamp: new Date(),
              category: 'seismic',
              level: 'warning',
              message: (record && readString(record, 'description')) || 'Simulation started',
              source: 'simulation',
            });
            break;
          case 'action_card':
            if (!record) break;
            const confidenceValue = readNumber(record, 'confidence');
            const confidence =
              confidenceValue <= 1 ? confidenceValue * 100 : confidenceValue;
            const actionType = normalizeActionType(record.action_type);
            const resourceId = String(record.resource_id ?? '');
            const resourceLabel =
              resourceId.replace(/^crew_0*(\d+)$/, 'Crew $1').replace('crew_', 'Crew ') ||
              'Resource';
            const rationale = readString(record, 'rationale');
            const zoneId = String(record.zone_id ?? '');
            const roundedConfidence = Math.round(confidence);

            store.addActionCard({
              id: String(record.id ?? crypto.randomUUID()),
              actionType,
              timeSensitivity:
                roundedConfidence > 85
                  ? 'IMMEDIATE'
                  : roundedConfidence > 70
                    ? 'HIGH'
                    : 'MEDIUM',
              confidence: roundedConfidence,
              resourceId,
              resourceLabel,
              zoneId,
              zoneThreatProbability: Math.round(roundedConfidence * 0.88),
              rationale,
              status: 'pending',
              createdAt: record.created_at ? new Date(String(record.created_at)) : new Date(),
            });
            store.incrementUnreadNotifications();

            const verb =
              actionType === 'REPOSITION'
                ? 'reposition required'
                : actionType === 'DISPATCH'
                  ? 'dispatch authorized'
                  : actionType === 'EVACUATE'
                    ? 'evacuation ordered'
                    : 'alert issued';

            store.addEvent({
              id: `aip-${record.id ?? crypto.randomUUID()}`,
              timestamp: new Date(),
              category: 'aip',
              level: confidenceValue >= 0.8 ? 'critical' : 'warning',
              message: `${resourceLabel}${zoneId ? ` -> Zone ${zoneId}` : ''} - ${roundedConfidence}% confidence, ${verb}.`,
              source: 'aip_agent',
            });
            store.addCommsMessage({
              from: 'AIP_AGENT',
              to: 'COMMANDER',
              text: `${actionType} ${resourceLabel}. Zone ${zoneId || 'N/A'}. Confidence ${roundedConfidence}%. ${rationale}`,
            });
            if (!store.isMuted) {
              speakActionCard({ actionType, resourceLabel, rationale });
              store.addCommsMessage({
                from: 'ELEVENLABS',
                to: 'COMMANDER',
                text: `Voice synthesis complete. Speaking: ${actionType} ${resourceLabel}.`,
              });
            }
            break;
          case 'crew_update':
            if (!record) break;
            const updatedCrewId = String(record.crew_id ?? record.id ?? '');
            store.updateCrew(updatedCrewId, {
              lat: readNumber(record, 'lat'),
              lng: readNumber(record, 'lng'),
              status:
                readString(record, 'status') === 'active'
                  ? 'active'
                  : readString(record, 'status') === 'standby'
                    ? 'standby'
                    : 'en_route',
              lastUpdated: new Date(),
            });
            store.addCommsMessage({
              from: 'BROADCASTER',
              to: 'FRONTEND',
              text: `${updatedCrewId.replace(/^crew_0*(\d+)$/, 'Crew $1')} position update. Status: ${readString(record, 'status', 'en_route')}. Location: ${readNumber(record, 'lat')}, ${readNumber(record, 'lng')}.`,
            });
            break;
          case 'event_log':
            const evtDescription = String((message as Record<string, unknown>).description ?? '');
            store.addCommsMessage({
              from: 'BROADCASTER',
              to: 'COMMANDER',
              text: evtDescription,
            });
            store.addEvent({
              id: crypto.randomUUID(),
              timestamp: new Date(),
              category: inferEventCategory(evtDescription),
              level: 'info',
              message: evtDescription,
              source: 'event_log',
            });
            return;
          case 'simulation_complete':
            store.setSimulating(false);
            store.addEvent({
              id: crypto.randomUUID(),
              timestamp: new Date(),
              category: 'system',
              level: 'success',
              message: 'Sentry simulation complete',
              source: 'simulation',
            });
            break;
          default:
            break;
        }

        store.addEvent({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          category: inferEventCategory(String((message as Record<string, unknown>).description ?? type)),
          level: 'info',
          message: String((message as Record<string, unknown>).description ?? ''),
          source: 'websocket',
        });
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        const attempt = attemptRef.current;
        if (attempt >= MAX_ATTEMPTS) {
          useStore.getState().setWsState('disconnected');
          return;
        }

        useStore.getState().setWsState('reconnecting', undefined, attempt);
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        attemptRef.current = attempt + 1;
        timeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        useStore.getState().setWsState('disconnected');
        ws.close();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, []);
}

'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { speakActionCard } from '@/lib/tts';

const WS_URL = (process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000') + '/ws';
const MAX_ATTEMPTS = 10;

export function useWebSocket() {
  const store = useStore.getState;
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
        let msg: { type: string; data?: any; description?: string };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        const s = useStore.getState();
        const { type, data } = msg;

        // Handle specific message types
        switch (type) {
          case 'hotspot_new':
            s.addHotspot({
              id: String(data.id),
              lat: data.lat,
              lng: data.lng,
              frp: data.frp ?? 0,
              confidence: data.confidence ?? 'nominal',
              detectedAt: data.detected_at ? new Date(data.detected_at) : new Date(),
            });
            s.addCommsMessage({ from: 'FIRMS_POLLER', to: 'EMBER_SIM', text: `Hotspot detected at ${data.lat}, ${data.lng}. FRP ${data.frp ?? 0}MW. Confidence: ${data.confidence ?? 'nominal'}.` });
            break;
          case 'ember_zone_new': {
            const current = useStore.getState().emberZones;
            s.setEmberZones([...current, {
              id: String(data.id),
              lat: data.lat,
              lng: data.lng,
              probability: data.probability ?? 0,
              nearestHotspotId: String(data.hotspot_id ?? ''),
              windSpeed: data.wind_speed ?? 6.5,
              windDirection: data.wind_direction ?? 270,
            }]);
            break;
          }
          case 'seismic_event':
            s.setSeismicEvents([...s.seismicEvents, {
              id: String(data.id ?? crypto.randomUUID()),
              lat: data.lat,
              lng: data.lng,
              magnitude: data.magnitude ?? 0,
              depth: data.depth ?? 0,
              detectedAt: data.detected_at ? new Date(data.detected_at) : new Date(),
            }]);
            s.addCommsMessage({ from: 'USGS_POLLER', to: 'SEISMIC_CNN', text: `Seismic event detected. M${data.magnitude ?? 0} depth ${data.depth ?? 0}km at ${data.lat}, ${data.lng}. Forwarding waveform data.` });
            s.addCommsMessage({ from: 'SEISMIC_CNN', to: 'GMPE_ENGINE', text: `Inference complete. Magnitude confirmed ${data.magnitude ?? 0}. Initiating GMPE pipeline.` });
            break;
          case 'epicenter_marker':
            // Treat the epicenter as a seismic event so MainMap renders the crosshair + rings
            s.setSeismicEvents([{
              id: String(data.id ?? crypto.randomUUID()),
              lat: data.lat,
              lng: data.lng,
              magnitude: data.magnitude ?? 6.7,
              depth: data.depth ?? 17,
              detectedAt: new Date(),
            }]);
            break;
          case 'damage_zones':
            s.addDamageCells(data);
            break;
          case 'action_card_new':
            s.addActionCard(data);
            s.incrementUnreadNotifications();
            break;
          case 'simulation_started':
            s.setSimulating(true);
            s.addEvent({
              id: data?.id ?? crypto.randomUUID(),
              timestamp: new Date(),
              category: 'seismic',
              description: data?.description ?? 'Simulation started',
            });
            break;
          case 'fire_hotspots':
            if (Array.isArray(data)) {
              data.forEach((h: any) => s.addHotspot({
                id: String(h.id),
                lat: h.lat,
                lng: h.lng,
                frp: h.frp ?? 0,
                confidence: h.confidence ?? 'nominal',
                detectedAt: h.detected_at ? new Date(h.detected_at) : new Date(),
              }));
            }
            break;
          case 'ember_update':
            if (Array.isArray(data)) {
              s.setEmberZones(data.map((z: any) => ({
                id: String(z.id),
                lat: z.lat,
                lng: z.lng,
                probability: z.probability ?? 0,
                nearestHotspotId: String(z.hotspot_id ?? ''),
                windSpeed: z.wind_speed ?? 6.5,
                windDirection: z.wind_direction ?? 270,
              })));
              const probs = data.map((z: any) => z.probability ?? 0);
              const minP = (Math.min(...probs) * 100).toFixed(0);
              const maxP = (Math.max(...probs) * 100).toFixed(0);
              const wind = data[0]?.wind_speed ?? 6.5;
              const dir = data[0]?.wind_direction ?? 270;
              s.addCommsMessage({ from: 'EMBER_SIM', to: 'BROADCASTER', text: `${data.length} ember risk zones computed. Probability range ${minP}-${maxP}%. Wind ${wind}m/s at ${dir} degrees. Broadcasting heatmap.` });
            }
            break;
          case 'action_card': {
            const conf = data.confidence ?? 0;
            const conf100 = conf <= 1 ? conf * 100 : conf;
            const resourceLabel = String(data.resource_id ?? '').replace(/^crew_0*(\d+)$/, 'Crew $1').replace('crew_', 'Crew ') || String(data.resource_id ?? '');
            const actionType = data.action_type ?? 'DISPATCH';
            const rationale = data.rationale ?? '';
            s.addActionCard({
              id: String(data.id),
              actionType,
              timeSensitivity: conf100 > 85 ? 'IMMEDIATE' : conf100 > 70 ? 'HIGH' : 'MEDIUM',
              confidence: conf100,
              resourceId: String(data.resource_id ?? ''),
              resourceLabel,
              zoneId: String(data.zone_id ?? ''),
              zoneThreatProbability: Math.round(conf100 * 0.88),
              rationale,
              status: 'pending',
              createdAt: data.created_at ? new Date(data.created_at) : new Date(),
            });
            s.incrementUnreadNotifications();
            // AIP summary in STATUS FEED
            const zoneId = String(data.zone_id ?? '');
            const verb = actionType === 'REPOSITION' ? 'reposition required'
              : actionType === 'DISPATCH' ? 'dispatch authorized'
              : actionType === 'EVACUATE' ? 'evacuation ordered'
              : actionType === 'ALERT' ? 'alert issued'
              : 'action pending';
            const zonePart = zoneId ? ` Zone ${zoneId}` : '';
            const confPct = Math.round(conf100);
            s.addEvent({
              id: `aip-${data.id}`,
              timestamp: new Date(),
              category: 'aip',
              description: `${resourceLabel} \u2192${zonePart} \u2014 ${confPct}% confidence, ${verb}.`,
            });
            s.addCommsMessage({ from: 'AIP_AGENT', to: 'COMMANDER', text: `${actionType} ${resourceLabel}. Zone ${zoneId || 'N/A'}. Confidence ${confPct}%. ${rationale}` });
            if (!s.isMuted) {
              speakActionCard({ actionType, resourceLabel, rationale });
              s.addCommsMessage({ from: 'ELEVENLABS', to: 'COMMANDER', text: `Voice synthesis complete. Speaking: ${actionType} ${resourceLabel}.` });
            }
            break;
          }
          case 'damage_grid': {
            const prob = data.damage_prob ?? 0;
            s.addDamageCells([{
              id: String(data.id),
              lat: data.lat,
              lng: data.lng,
              probability: prob,
              soilType: data.soil_type ?? '',
              liquefactionClass: 'moderate',
              computedAt: new Date(),
              seismicEventId: String(data.event_id ?? ''),
              distanceFromEpicenter: 0,
            }]);
            const cellCount = s.damageCells.length;
            if (cellCount === 1 || cellCount % 10 === 0) {
              s.addCommsMessage({ from: 'GMPE_ENGINE', to: 'FRONTEND', text: `Streaming damage cell ${cellCount}. Probability ${(prob * 100).toFixed(0)}% at ${data.lat}, ${data.lng}. Soil: ${data.soil_type ?? 'unknown'}.` });
            }
            break;
          }
          case 'crew_update':
            // crew_id is the string identifier (e.g. "crew_001"); data.id is the DB integer
            s.updateCrew(data.crew_id ?? String(data.id), {
              lat: data.lat,
              lng: data.lng,
              status: data.status ?? 'en_route',
              lastUpdated: new Date(),
            });
            { const crewLabel = String(data.crew_id ?? data.id).replace(/^crew_0*(\d+)$/, 'Crew $1');
              s.addCommsMessage({ from: 'BROADCASTER', to: 'FRONTEND', text: `${crewLabel} position update. Status: ${data.status ?? 'en_route'}. Location: ${data.lat}, ${data.lng}.` });
            }
            break;
          case 'event_log': {
            s.addCommsMessage({ from: 'BROADCASTER', to: 'COMMANDER', text: msg.description ?? '' });
            // Infer category from description keywords for better color coding
            const desc = (msg.description ?? '').toLowerCase();
            const inferredCat =
              desc.includes('fire') || desc.includes('hotspot') || desc.includes('frp') || desc.includes('ember') ? 'fire' :
              desc.includes('seismic') || desc.includes('damage') || desc.includes('collapse') || desc.includes('pga') || desc.includes('cnn') || desc.includes('liquefaction') ? 'seismic' :
              desc.includes('crew') || desc.includes('dispatch') || desc.includes('reposition') ? 'crew' :
              desc.includes('shelter') || desc.includes('hospital') || desc.includes('gas') || desc.includes('water') ? 'infrastructure' :
              desc.includes('aip') || desc.includes('agent') || desc.includes('threat') || desc.includes('recommendation') || desc.includes('sentinel') ? 'ai' :
              'system';
            s.addEvent({
              id: crypto.randomUUID(),
              timestamp: new Date(),
              category: inferredCat as any,
              description: msg.description ?? '',
            });
            // return early so we don't double-add via the catch-all below
            return;
          }
          case 'simulation_complete':
            s.setSimulating(false);
            s.addEvent({
              id: crypto.randomUUID(),
              timestamp: new Date(),
              category: 'system',
              description: 'SENTINEL simulation complete',
            });
            break;
        }

        // Add every event to the feed
        s.addEvent({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          category: (msg.type as any) ?? 'system',
          description: msg.description ?? '',
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
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
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

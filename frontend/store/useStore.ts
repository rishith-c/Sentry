'use client';

import { create } from 'zustand';
import type {
  Counter,
  Pipeline,
  Hotspot,
  EmberZone,
  DamageCell,
  SeismicEvent,
  Crew,
  Shelter,
  Hospital,
  EvacRoute,
  ActionCard,
  EventEntry,
  LayerKey,
  WSConnectionState,
} from '@/lib/types';

interface SentryState {
  // Session
  sessionStart: Date;
  isMuted: boolean;

  // Map layers visibility
  layers: Record<LayerKey, boolean>;

  // Counters
  counters: Counter;
  prevCounters: Counter | null;
  counterFlash: Record<keyof Counter, boolean>;

  // Pipelines
  pipelines: Pipeline[];

  // Map data
  hotspots: Hotspot[];
  emberZones: EmberZone[];
  damageCells: DamageCell[];
  seismicEvents: SeismicEvent[];
  crews: Crew[];
  shelters: Shelter[];
  hospitals: Hospital[];
  evacRoutes: EvacRoute[];

  // Action queue
  actionCards: ActionCard[];
  unreadNotifications: number;

  // Agent comms
  commsMessages: { from: string; to: string; text: string; timestamp: Date }[];
  addCommsMessage: (msg: { from: string; to: string; text: string }) => void;

  // Event feed
  events: EventEntry[];
  sessionEventCount: number;
  isFeedPaused: boolean;
  pendingEventsWhilePaused: number;

  // WebSocket
  wsState: WSConnectionState;
  wsLatency: number;
  wsReconnectAttempt: number;
  wsReconnectMax: number;
  wsRestored: boolean;

  // Simulation
  isSimulating: boolean;

  // Actions
  toggleLayer: (key: LayerKey) => void;
  setMuted: (muted: boolean) => void;
  setCounters: (c: Counter) => void;
  setPipelines: (p: Pipeline[]) => void;
  setHotspots: (h: Hotspot[]) => void;
  addHotspot: (h: Hotspot) => void;
  setEmberZones: (z: EmberZone[]) => void;
  addDamageCells: (cells: DamageCell[]) => void;
  setSeismicEvents: (e: SeismicEvent[]) => void;
  updateCrew: (id: string, update: Partial<Crew>) => void;
  setCrews: (c: Crew[]) => void;
  setShelters: (s: Shelter[]) => void;
  setHospitals: (h: Hospital[]) => void;
  setEvacRoutes: (r: EvacRoute[]) => void;
  addActionCard: (card: ActionCard) => void;
  approveAction: (id: string) => void;
  dismissAction: (id: string) => void;
  addEvent: (event: EventEntry) => void;
  setFeedPaused: (paused: boolean) => void;
  resumeFeed: () => void;
  setWsState: (state: WSConnectionState, latency?: number, attempt?: number) => void;
  setWsRestored: (restored: boolean) => void;
  setSimulating: (simulating: boolean) => void;
  incrementUnreadNotifications: () => void;
  clearUnreadNotifications: () => void;
  clearSimulationData: () => void;
}

const defaultCounters: Counter = {
  hotspots: 0,
  deployed: 0,
  totalCrews: 8,
  damageZones: 0,
  sheltersFull: 0,
  hospitalsAlert: 0,
};

export const useStore = create<SentryState>((set) => ({
  sessionStart: new Date(),
  isMuted: false,

  layers: {
    fire: true,
    ember: true,
    seismic: true,
    crews: true,
    infrastructure: true,
  },

  counters: defaultCounters,
  prevCounters: null,
  counterFlash: {
    hotspots: false,
    deployed: false,
    totalCrews: false,
    damageZones: false,
    sheltersFull: false,
    hospitalsAlert: false,
  },

  pipelines: [
    { id: 'firms', name: 'FIRMS', lastSynced: new Date(), status: 'green' },
    { id: 'usgs', name: 'USGS', lastSynced: new Date(), status: 'green' },
    { id: 'weather', name: 'WEATHER', lastSynced: new Date(), status: 'green' },
  ],

  hotspots: [],
  emberZones: [],
  damageCells: [],
  seismicEvents: [],
  crews: [
    // Positioned at real LAFD fire stations in the San Fernando Valley
    { id: 'crew_001', label: 'Crew 1', status: 'standby', lat: 34.210, lng: -118.540, personnel: 10, assignedZoneId: null, lastUpdated: new Date() }, // Sta. 74 — Reseda (near epicenter)
    { id: 'crew_002', label: 'Crew 2', status: 'standby', lat: 34.274, lng: -118.500, personnel: 8,  assignedZoneId: null, lastUpdated: new Date() }, // Sta. 87 — Granada Hills
    { id: 'crew_003', label: 'Crew 3', status: 'standby', lat: 34.260, lng: -118.449, personnel: 12, assignedZoneId: null, lastUpdated: new Date() }, // Sta. 98 — Mission Hills
    { id: 'crew_004', label: 'Crew 4', status: 'standby', lat: 34.238, lng: -118.478, personnel: 9,  assignedZoneId: null, lastUpdated: new Date() }, // Sta. 88 — North Hills
    { id: 'crew_005', label: 'Crew 5', status: 'standby', lat: 34.169, lng: -118.593, personnel: 11, assignedZoneId: null, lastUpdated: new Date() }, // Sta. 77 — Woodland Hills
  ],
  shelters: [
    { id: 's1', name: 'Sylmar Recreation Center', lat: 34.29, lng: -118.44, occupancy: 320, capacity: 400, damageZoneId: null, address: '13100 Borden Ave, Sylmar CA', status: 'available' },
    { id: 's2', name: 'Van Nuys Recreation Center', lat: 34.19, lng: -118.45, occupancy: 180, capacity: 350, damageZoneId: null, address: '14201 Friar St, Van Nuys CA', status: 'available' },
    { id: 's3', name: 'Chatsworth Park', lat: 34.26, lng: -118.60, occupancy: 50, capacity: 200, damageZoneId: null, address: '22360 Devonshire St, Chatsworth CA', status: 'available' },
  ],
  hospitals: [
    { id: 'h1', name: 'Cedars-Sinai Medical Center', lat: 34.075, lng: -118.381, currentCapacity: 120, alertLevel: 'normal', damageZoneId: null, address: '8700 Beverly Blvd, LA CA', lastUpdated: new Date() },
    { id: 'h2', name: 'UCLA Medical Center', lat: 34.066, lng: -118.446, currentCapacity: 85, alertLevel: 'normal', damageZoneId: null, address: '757 Westwood Plaza, LA CA', lastUpdated: new Date() },
    { id: 'h3', name: 'Providence St. Joseph', lat: 34.18, lng: -118.31, currentCapacity: 60, alertLevel: 'normal', damageZoneId: null, address: '501 S Buena Vista St, Burbank CA', lastUpdated: new Date() },
  ],
  evacRoutes: [],

  actionCards: [],
  unreadNotifications: 0,

  commsMessages: [],
  addCommsMessage: (msg) =>
    set((s) => ({
      commsMessages: [...s.commsMessages, { ...msg, timestamp: new Date() }].slice(-50),
    })),

  events: [],
  sessionEventCount: 0,
  isFeedPaused: false,
  pendingEventsWhilePaused: 0,

  wsState: 'connected',
  wsLatency: 12,
  wsReconnectAttempt: 0,
  wsReconnectMax: 10,
  wsRestored: false,

  isSimulating: false,

  toggleLayer: (key) =>
    set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),

  setMuted: (muted) => set({ isMuted: muted }),

  setCounters: (c) =>
    set((s) => {
      const flash = { ...s.counterFlash };
      const keys = Object.keys(c) as Array<keyof Counter>;
      keys.forEach((k) => {
        if (s.counters[k] !== c[k]) flash[k] = true;
      });
      setTimeout(() => {
        useStore.setState((st) => ({
          counterFlash: Object.fromEntries(
            Object.keys(st.counterFlash).map((k) => [k, false])
          ) as Record<keyof Counter, boolean>,
        }));
      }, 500);
      return { prevCounters: s.counters, counters: c, counterFlash: flash };
    }),

  setPipelines: (p) => set({ pipelines: p }),
  setHotspots: (h) => set({ hotspots: h }),
  addHotspot: (h) => set((s) => ({ hotspots: [...s.hotspots, h] })),
  setEmberZones: (z) => set({ emberZones: z }),
  addDamageCells: (cells) =>
    set((s) => ({ damageCells: [...s.damageCells, ...cells] })),
  setSeismicEvents: (e) => set({ seismicEvents: e }),
  updateCrew: (id, update) =>
    set((s) => ({
      crews: s.crews.map((c) => (c.id === id ? { ...c, ...update } : c)),
    })),
  setCrews: (c) => set({ crews: c }),
  setShelters: (sh) => set({ shelters: sh }),
  setHospitals: (h) => set({ hospitals: h }),
  setEvacRoutes: (r) => set({ evacRoutes: r }),

  addActionCard: (card) =>
    set((s) => {
      // Deduplicate — skip if a card with the same id already exists
      if (s.actionCards.some(c => c.id === card.id)) return s;
      return {
        actionCards: [card, ...s.actionCards].sort((a, b) => {
          if (b.confidence !== a.confidence) return b.confidence - a.confidence;
          const sensOrder: Record<string, number> = { IMMEDIATE: 0, HIGH: 1, MEDIUM: 2, ROUTINE: 3 };
          return (sensOrder[a.timeSensitivity] ?? 4) - (sensOrder[b.timeSensitivity] ?? 4);
        }),
      };
    }),

  approveAction: (id) =>
    set((s) => ({
      actionCards: s.actionCards.map((c) =>
        c.id === id ? { ...c, status: 'approved' } : c
      ),
    })),

  dismissAction: (id) =>
    set((s) => ({
      actionCards: s.actionCards.map((c) =>
        c.id === id ? { ...c, status: 'dismissed' } : c
      ),
    })),

  addEvent: (event) =>
    set((s) => {
      // Deduplicate by id — prevents double-fire in React StrictMode dev
      if (s.events.some(e => e.id === event.id)) return s;
      const newEvents = [event, ...s.events].slice(0, 50);
      if (s.isFeedPaused) {
        return {
          events: newEvents,
          sessionEventCount: s.sessionEventCount + 1,
          pendingEventsWhilePaused: s.pendingEventsWhilePaused + 1,
        };
      }
      return { events: newEvents, sessionEventCount: s.sessionEventCount + 1 };
    }),

  setFeedPaused: (paused) =>
    set({ isFeedPaused: paused, pendingEventsWhilePaused: paused ? 0 : 0 }),

  resumeFeed: () =>
    set({ isFeedPaused: false, pendingEventsWhilePaused: 0 }),

  setWsState: (state, latency, attempt) =>
    set({
      wsState: state,
      ...(latency !== undefined && { wsLatency: latency }),
      ...(attempt !== undefined && { wsReconnectAttempt: attempt }),
    }),

  setWsRestored: (restored) => set({ wsRestored: restored }),
  setSimulating: (simulating) => set({ isSimulating: simulating }),
  incrementUnreadNotifications: () =>
    set((s) => ({ unreadNotifications: s.unreadNotifications + 1 })),
  clearUnreadNotifications: () => set({ unreadNotifications: 0 }),
  clearSimulationData: () => set({ hotspots: [], emberZones: [], damageCells: [], seismicEvents: [], actionCards: [], commsMessages: [] }),
}));

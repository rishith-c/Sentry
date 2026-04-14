export type PipelineStatus = 'green' | 'amber' | 'red' | 'unknown' | 'ok' | 'error';
export type LayerKey = 'fire' | 'ember' | 'seismic' | 'crews' | 'infrastructure';
export type ActionType = 'REPOSITION' | 'DISPATCH' | 'ALERT' | 'EVACUATE' | 'SHELTER' | 'MEDICAL';
export type TimeSensitivity = 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'ROUTINE';
export type CrewStatus = 'active' | 'en_route' | 'standby' | 'returning';
export type AlertLevel = 'normal' | 'elevated' | 'critical';
export type RouteStatus = 'open' | 'congested' | 'closed';
export type EventCategory = 'seismic' | 'fire' | 'crew' | 'infrastructure' | 'ai' | 'aip' | 'system' | 'tts';
export type WSConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'dismissed';

export interface Counter {
  hotspots: number;
  deployed: number;
  totalCrews: number;
  damageZones: number;
  sheltersFull: number;
  hospitalsAlert: number;
}

export interface Pipeline {
  id: string;
  name: string;
  lastSynced: Date | null;
  status: PipelineStatus;
}

export interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  frp: number;
  confidence: 'low' | 'nominal' | 'high';
  detectedAt: Date;
  source?: string;
}

export interface EmberZone {
  id: string;
  lat: number;
  lng: number;
  probability: number;
  hotspotId: string;
  forecastTs: Date;
  geojsonCell?: string;
  // legacy compat
  nearestHotspotId?: string;
  windSpeed?: number;
  windDirection?: number;
}

export interface DamageCell {
  id: string;
  lat: number;
  lng: number;
  probability: number;
  soilType: string;
  liquefactionClass: 'none' | 'low' | 'moderate' | 'high' | 'very high';
  computedAt: Date;
  seismicEventId: string;
  distanceFromEpicenter?: number;
}

export interface SeismicEvent {
  id: string;
  lat: number;
  lng: number;
  magnitude: number;
  depth: number;
  detectedAt: Date;
  place?: string;
}

export interface Crew {
  id: string;
  label: string;
  status: CrewStatus;
  lat: number;
  lng: number;
  personnel: number;
  assignedZoneId: string | null;
  lastUpdated: Date;
}

export interface Shelter {
  id: string;
  name: string;
  lat: number;
  lng: number;
  occupancy: number;
  capacity: number;
  damageZoneId: string | null;
  // legacy fields kept for store compat
  address?: string;
  currentOccupancy?: number;
  totalCapacity?: number;
  linkedDamageZoneId?: string | null;
  linkedDamageProbability?: number | null;
  status?: 'available' | 'at_capacity' | 'closed';
}

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  currentCapacity: number;
  alertLevel: AlertLevel;
  damageZoneId: string | null;
  // legacy fields
  address?: string;
  remainingCapacity?: number;
  linkedDamageZoneId?: string | null;
  linkedDamageProbability?: number | null;
  lastUpdated?: Date;
}

export interface EvacRoute {
  id: string;
  status: RouteStatus;
  originZoneId: string;
  destinationZoneId: string;
  // legacy fields
  originZoneName?: string;
  destZoneName?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  lastUpdated?: Date;
}

export interface ActionCard {
  id: string;
  actionType: ActionType;
  resourceId: string;
  resourceLabel?: string;
  zoneId: string;
  confidence: number;
  timeSensitivity: TimeSensitivity;
  rationale: string;
  status: ActionStatus;
  createdAt: Date;
  approvedAt?: Date;
  // legacy fields
  zoneThreatProbability?: number;
  audioUrl?: string;
}

export interface EventEntry {
  id: string;
  category: EventCategory;
  level: 'info' | 'warning' | 'critical' | 'success';
  message: string;
  source: string;
  timestamp: Date;
  // legacy compat
  description?: string;
}

export interface WSMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

export interface BenchmarkResult {
  id: string;
  pipeline: string;
  durationMs: number;
  inputShape?: string;
  device: string;
  createdAt: Date;
}

export interface SyncStatus {
  firms: { lastSuccess: string | null; status: PipelineStatus };
  usgs: { lastSuccess: string | null; status: PipelineStatus };
  weather: { lastSuccess: string | null; status: PipelineStatus };
  aip?: { lastSuccess: string | null; status: PipelineStatus };
}

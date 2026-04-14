export type PipelineStatus = 'green' | 'amber' | 'red';
export type LayerKey = 'fire' | 'ember' | 'seismic' | 'crews' | 'infrastructure';
export type ActionType = 'REPOSITION' | 'DISPATCH' | 'ALERT' | 'EVACUATE';
export type TimeSensitivity = 'IMMEDIATE' | 'HIGH' | 'MEDIUM';
export type CrewStatus = 'active' | 'en_route' | 'standby';
export type AlertLevel = 'normal' | 'elevated' | 'critical';
export type RouteStatus = 'open' | 'congested' | 'closed';
export type EventCategory = 'seismic' | 'fire' | 'crew' | 'infrastructure' | 'ai' | 'aip' | 'system';

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
  frp: number; // Fire Radiative Power in MW
  confidence: 'low' | 'nominal' | 'high';
  detectedAt: Date;
}

export interface EmberZone {
  id: string;
  lat: number;
  lng: number;
  probability: number; // 0-100
  nearestHotspotId: string;
  windSpeed: number;
  windDirection: number;
}

export interface DamageCell {
  id: string;
  lat: number;
  lng: number;
  probability: number; // 0-100
  soilType: string;
  liquefactionClass: 'none' | 'low' | 'moderate' | 'high' | 'very high';
  computedAt: Date;
  seismicEventId: string;
  distanceFromEpicenter: number; // km
}

export interface SeismicEvent {
  id: string;
  lat: number;
  lng: number;
  magnitude: number;
  depth: number; // km
  detectedAt: Date;
}

export interface Crew {
  id: string;
  label: string; // C1, C2 etc.
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
  address: string;
  lat: number;
  lng: number;
  currentOccupancy: number;
  totalCapacity: number;
  linkedDamageZoneId: string | null;
  linkedDamageProbability: number | null;
  status: 'available' | 'at_capacity' | 'closed';
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  remainingCapacity: number;
  alertLevel: AlertLevel;
  linkedDamageZoneId: string | null;
  linkedDamageProbability: number | null;
  lastUpdated: Date;
}

export interface EvacRoute {
  id: string;
  status: RouteStatus;
  originZoneName: string;
  destZoneName: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  lastUpdated: Date;
}

export interface ActionCard {
  id: string;
  actionType: ActionType;
  timeSensitivity: TimeSensitivity;
  confidence: number; // 0-100
  resourceId: string;
  resourceLabel: string;
  zoneId: string;
  zoneThreatProbability: number;
  rationale: string;
  status: 'pending' | 'approved' | 'dismissed';
  createdAt: Date;
  audioUrl?: string;
}

export interface EventEntry {
  id: string;
  timestamp: Date;
  category: EventCategory;
  description: string;
}

export type WSConnectionState = 'connected' | 'reconnecting' | 'disconnected';

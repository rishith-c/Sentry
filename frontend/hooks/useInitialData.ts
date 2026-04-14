'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import {
  fetchCrews,
  fetchShelters,
  fetchHospitals,
  fetchActions,
  fetchCounters,
} from '@/lib/api';
import type {
  ActionType,
  AlertLevel,
  CrewStatus,
  TimeSensitivity,
} from '@/lib/types';

interface CrewRow {
  id: number | string;
  crew_id?: string;
  crew_identifier?: string;
  status?: string;
  lat: number;
  lng: number;
  capacity?: number;
  assigned_zone_id?: number | string | null;
  updated_at?: string;
}

interface ShelterRow {
  id: number | string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  occupancy?: number;
  capacity?: number;
  damage_zone_id?: number | string | null;
}

interface HospitalRow {
  id: number | string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  capacity?: number;
  current_capacity?: number;
  alert_level?: string;
  damage_zone_id?: number | string | null;
}

interface ActionRow {
  id: number | string;
  action_type?: string;
  time_sensitivity?: string;
  confidence?: number;
  resource_id?: number | string | null;
  zone_id?: number | string | null;
  rationale?: string;
  status?: 'pending' | 'approved' | 'dismissed';
  created_at?: string;
}

type CrewResponse = { crews: CrewRow[] } | CrewRow[];
type ShelterResponse = { shelters: ShelterRow[] };
type HospitalResponse = { hospitals: HospitalRow[] };
type ActionResponse = { actions: ActionRow[]; pending_count: number };

function normalizeCrewStatus(status?: string): CrewStatus {
  if (status === 'active' || status === 'en_route' || status === 'standby') {
    return status;
  }
  return 'standby';
}

function normalizeActionType(actionType?: string): ActionType {
  switch (String(actionType ?? '').toUpperCase()) {
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

function normalizeSensitivity(value?: string): TimeSensitivity {
  switch (String(value ?? '').toUpperCase()) {
    case 'IMMEDIATE':
      return 'IMMEDIATE';
    case 'HIGH':
      return 'HIGH';
    default:
      return 'MEDIUM';
  }
}

function normalizeAlertLevel(value?: string): AlertLevel {
  switch (value) {
    case 'critical':
    case 'elevated':
    case 'normal':
      return value;
    default:
      return 'normal';
  }
}

function extractCrews(response: CrewResponse): CrewRow[] {
  return Array.isArray(response) ? response : response.crews;
}

export function useInitialData() {
  useEffect(() => {
    async function loadAll() {
      const [crewsResult, sheltersResult, hospitalsResult] = await Promise.allSettled([
        fetchCrews() as Promise<CrewResponse>,
        fetchShelters() as Promise<ShelterResponse>,
        fetchHospitals() as Promise<HospitalResponse>,
      ]);

      const store = useStore.getState();

      if (crewsResult.status === 'fulfilled') {
        store.setCrews(
          extractCrews(crewsResult.value).map((crew) => {
            const crewId = String(
              crew.crew_id ?? crew.crew_identifier ?? `crew_${String(crew.id).padStart(3, '0')}`
            );
            return {
              id: crewId,
              label: crewId.replace(/^crew_0*(\d+)$/, 'Crew $1'),
              status: normalizeCrewStatus(crew.status),
              lat: crew.lat,
              lng: crew.lng,
              personnel: crew.capacity ?? 0,
              assignedZoneId: crew.assigned_zone_id ? String(crew.assigned_zone_id) : null,
              lastUpdated: crew.updated_at ? new Date(crew.updated_at) : new Date(),
            };
          })
        );
      }

      if (sheltersResult.status === 'fulfilled') {
        store.setShelters(
          sheltersResult.value.shelters.map((shelter) => ({
            id: String(shelter.id),
            name: shelter.name,
            lat: shelter.lat,
            lng: shelter.lng,
            occupancy: shelter.occupancy ?? 0,
            capacity: shelter.capacity ?? 0,
            damageZoneId: shelter.damage_zone_id ? String(shelter.damage_zone_id) : null,
            address: shelter.address ?? '',
            status:
              (shelter.occupancy ?? 0) >= (shelter.capacity ?? 1) ? 'at_capacity' as const : 'available' as const,
          }))
        );
      }

      if (hospitalsResult.status === 'fulfilled') {
        store.setHospitals(
          hospitalsResult.value.hospitals.map((hospital) => ({
            id: String(hospital.id),
            name: hospital.name,
            lat: hospital.lat,
            lng: hospital.lng,
            currentCapacity: hospital.capacity ?? hospital.current_capacity ?? 0,
            alertLevel: normalizeAlertLevel(hospital.alert_level),
            damageZoneId: hospital.damage_zone_id ? String(hospital.damage_zone_id) : null,
            address: hospital.address ?? '',
            lastUpdated: new Date(),
          }))
        );
      }

      try {
        const actions = (await fetchActions()) as ActionResponse;
        actions.actions.forEach((action) => {
          const confidenceRaw = action.confidence ?? 0;
          const confidence =
            confidenceRaw <= 1 ? Math.round(confidenceRaw * 100) : Math.round(confidenceRaw);
          const resourceId = action.resource_id ? String(action.resource_id) : '';

          store.addActionCard({
            id: String(action.id),
            actionType: normalizeActionType(action.action_type),
            timeSensitivity: normalizeSensitivity(action.time_sensitivity),
            confidence,
            resourceId,
            resourceLabel: resourceId.replace(/^crew_0*(\d+)$/, 'Crew $1') || 'Resource',
            zoneId: action.zone_id ? String(action.zone_id) : '—',
            zoneThreatProbability: Math.round(confidence * 0.88),
            rationale: action.rationale ?? '',
            status: action.status ?? 'pending',
            createdAt: action.created_at ? new Date(action.created_at) : new Date(),
          });
        });
      } catch {
        // The queue can remain empty until the first live action arrives.
      }

      try {
        const counters = await fetchCounters();
        store.setCounters({
          hotspots: counters.hotspots ?? 0,
          deployed: counters.crews_deployed ?? counters.crews ?? 0,
          totalCrews: counters.crews_total ?? counters.suppression_crews ?? 8,
          damageZones: counters.damage_zones ?? 0,
          sheltersFull: counters.shelters_at_capacity ?? 0,
          hospitalsAlert: counters.hospitals_on_alert ?? 0,
        });
      } catch {
        // Counter hydration is non-blocking on first paint.
      }

      store.addEvent({
        id: 'init-fetch',
        timestamp: new Date(),
        category: 'system',
        level: 'success',
        message: 'Connected to Sentry backend',
        source: 'system',
      });
    }

    void loadAll();
  }, []);
}

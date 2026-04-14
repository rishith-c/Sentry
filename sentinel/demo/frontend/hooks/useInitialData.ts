'use client';
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import {
  fetchCrews,
  fetchShelters,
  fetchHospitals,
} from '@/lib/api';

export function useInitialData() {
  useEffect(() => {
    async function loadAll() {
      // Only load persistent infrastructure data on startup.
      // Hotspots, seismic events, ember zones, and action cards are
      // simulation-specific — they stream in via WebSocket when a
      // simulation runs and are cleared by clearSimulationData().
      const [
        crewsResult,
        sheltersResult,
        hospitalsResult,
      ] = await Promise.allSettled([
        fetchCrews(),
        fetchShelters(),
        fetchHospitals(),
      ]);

      const s = useStore.getState();

      if (crewsResult.status === 'fulfilled') {
        s.setCrews(
          crewsResult.value.map((c: any) => ({
            id: c.crew_id ?? String(c.id),
            label: (c.crew_id ?? String(c.id)).replace(/^crew_0*(\d+)$/, 'Crew $1'),
            status: c.status ?? 'standby',
            lat: c.lat,
            lng: c.lng,
            personnel: c.capacity ?? 0,
            assignedZoneId: c.assigned_zone_id ?? null,
            lastUpdated: c.updated_at ? new Date(c.updated_at) : new Date(),
          }))
        );
      }

      if (sheltersResult.status === 'fulfilled') {
        s.setShelters(
          sheltersResult.value.map((sh: any) => ({
            id: String(sh.id),
            name: sh.name,
            address: sh.address ?? '',
            lat: sh.lat,
            lng: sh.lng,
            currentOccupancy: sh.occupancy ?? 0,
            totalCapacity: sh.capacity ?? 0,
            linkedDamageZoneId: null,
            linkedDamageProbability: null,
            status: (sh.occupancy ?? 0) >= (sh.capacity ?? 1) ? 'at_capacity' : 'available',
          }))
        );
      }

      if (hospitalsResult.status === 'fulfilled') {
        s.setHospitals(
          hospitalsResult.value.map((h: any) => ({
            id: String(h.id),
            name: h.name,
            address: h.address ?? '',
            lat: h.lat,
            lng: h.lng,
            remainingCapacity: h.capacity ?? 0,
            alertLevel: h.alert_level ?? 'normal',
            linkedDamageZoneId: null,
            linkedDamageProbability: null,
            lastUpdated: new Date(),
          }))
        );
      }

      s.addEvent({
        id: 'init-fetch',
        timestamp: new Date(),
        category: 'system',
        description: 'Connected to Sentinel backend',
      });
    }

    loadAll();
  }, []);
}

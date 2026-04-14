export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    throw new Error(`API error ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function fetchCrews() {
  return apiFetch<any[]>('/api/crews');
}

export function fetchShelters() {
  return apiFetch<any[]>('/api/shelters');
}

export function fetchHospitals() {
  return apiFetch<any[]>('/api/hospitals');
}

export function fetchHotspots() {
  return apiFetch<any[]>('/api/hotspots');
}

export function fetchEmberZones() {
  return apiFetch<any[]>('/api/ember-zones');
}

export function fetchSeismicEvents() {
  return apiFetch<any[]>('/api/seismic-events');
}

export function fetchDamageZones(eventId: number) {
  return apiFetch<any[]>(`/api/damage-zones/${eventId}`);
}

export function fetchActionCards() {
  return apiFetch<any[]>('/api/action-cards');
}

export function patchActionCard(id: number, status: string) {
  return apiFetch<any>(`/api/action-cards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function moveCrewToTarget(crewId: string) {
  return apiFetch<any>(`/api/crews/${crewId}/move`, { method: 'POST' });
}

export function resetSimulation() {
  return apiFetch<any>('/api/reset', { method: 'POST' });
}

export function triggerSimulation() {
  return apiFetch<any>('/api/simulate/northridge', { method: 'POST' });
}

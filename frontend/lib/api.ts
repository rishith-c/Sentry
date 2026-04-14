const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  // Hotspots
  getHotspots: () => apiFetch<{ hotspots: unknown[]; count: number }>('/api/hotspots'),

  // Damage
  getDamageZones: () => apiFetch<{ zones: unknown[]; event_id: number | null }>('/api/damage-zones'),
  simulate: () => apiFetch<{ status: string }>('/api/simulate', { method: 'POST' }),
  resetSimulation: () => apiFetch<{ status: string }>('/api/reset', { method: 'POST' }).catch(() => ({ status: 'ok' })),

  // Crews
  getCrews: () => apiFetch<{ crews: unknown[] }>('/api/crews'),
  updateCrew: (id: number, data: unknown) =>
    apiFetch(`/api/crews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Actions
  getActions: () => apiFetch<{ actions: unknown[]; pending_count: number }>('/api/actions'),
  createAction: (data: unknown) =>
    apiFetch('/api/actions', { method: 'POST', body: JSON.stringify(data) }),
  approveAction: (id: string | number) =>
    apiFetch(`/api/actions/${id}/approve`, { method: 'PATCH' }),
  dismissAction: (id: string | number) =>
    apiFetch(`/api/actions/${id}/dismiss`, { method: 'PATCH' }),

  // Infrastructure
  getShelters: () => apiFetch<{ shelters: unknown[] }>('/api/shelters'),
  getHospitals: () => apiFetch<{ hospitals: unknown[] }>('/api/hospitals'),
  getEvacRoutes: () => apiFetch<{ routes: unknown[] }>('/api/evacuation-routes'),

  // Session
  getSession: () => apiFetch<{ id: number; mute_state: boolean }>('/api/session'),
  updateSession: (data: unknown) =>
    apiFetch('/api/session', { method: 'PATCH', body: JSON.stringify(data) }),

  // Status
  getCounters: () => apiFetch<Record<string, number>>('/api/counters'),
  getSyncStatus: () => apiFetch<Record<string, unknown>>('/api/sync-status'),

  // Benchmarks
  getBenchmarks: () =>
    apiFetch<{ benchmarks: unknown[] }>('/api/benchmarks').catch(() => ({ benchmarks: [] })),

  // AI
  triggerHazardReport: (data: unknown) =>
    apiFetch('/api/ai/hazard-report', { method: 'POST', body: JSON.stringify(data) }).catch(
      () => ({})
    ),

  // Health
  health: () => apiFetch<Record<string, unknown>>('/health'),
};

// Legacy named exports for backward compatibility
export const API_URL = API_BASE;

export function fetchCrews() {
  return api.getCrews();
}
export function fetchShelters() {
  return api.getShelters();
}
export function fetchHospitals() {
  return api.getHospitals();
}
export function fetchHotspots() {
  return api.getHotspots();
}
export function fetchActions() {
  return api.getActions();
}
export function fetchCounters() {
  return api.getCounters();
}
export function fetchSyncStatus() {
  return api.getSyncStatus();
}
export function approveAction(id: number) {
  return api.approveAction(id);
}
export function dismissAction(id: number) {
  return api.dismissAction(id);
}
export function resetSimulation() {
  return api.resetSimulation();
}
export function triggerSimulation() {
  return api.simulate();
}

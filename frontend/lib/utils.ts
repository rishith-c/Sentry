import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(startTime: Date): string {
  const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getPipelineStatus(lastSynced: Date | null): 'green' | 'amber' | 'red' {
  if (!lastSynced) return 'red';
  const diff = (Date.now() - lastSynced.getTime()) / 1000;
  if (diff <= 60) return 'green';
  if (diff <= 180) return 'amber';
  return 'red';
}

export function getDamageCellColor(probability: number): string {
  if (probability < 30) return '#22c55e';
  if (probability < 50) return '#84cc16';
  if (probability < 70) return '#f97316';
  if (probability < 85) return '#ea580c';
  return '#dc2626';
}

export function getEmberColor(probability: number): [number, number, number, number] {
  // Returns [r, g, b, a]
  if (probability < 30) return [0, 0, 0, 0];
  if (probability < 40) return [251, 191, 36, Math.round(((probability - 30) / 10) * 80)];
  if (probability < 65) return [245, 158, 11, 120 + Math.round(((probability - 40) / 25) * 80)];
  if (probability < 75) return [249, 115, 22, 180 + Math.round(((probability - 65) / 10) * 40)];
  return [220, 38, 38, 220];
}

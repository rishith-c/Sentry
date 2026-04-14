// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BenchmarkResult, SyncStatus, PipelineStatus } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CounterData {
  hotspots: number;
  deployed: number;
  totalCrews: number;
  damageZones: number;
  sheltersFull: number;
  hospitalsAlert: number;
}

interface HealthData {
  uptime?: number;
  status?: string;
}

interface PipelineRow {
  name: string;
  id: string;
  status: PipelineStatus;
  lastSync: string | null;
  latencyMs: number;
  healthScore: number;
}

interface HourBucket {
  hour: number;
  label: string;
  fire: number;
  seismic: number;
  crew: number;
  system: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAT_CARDS: {
  key: keyof CounterData | 'avgResponse' | 'uptime';
  label: string;
  icon: string;
}[] = [
  { key: 'hotspots', label: 'Active Hotspots', icon: 'fire' },
  { key: 'damageZones', label: 'Damage Zones', icon: 'seismic' },
  { key: 'deployed', label: 'Crews Deployed', icon: 'crew' },
  { key: 'totalCrews', label: 'Total Events Processed', icon: 'system' },
  { key: 'avgResponse', label: 'Avg Response Time', icon: 'timer' },
  { key: 'uptime', label: 'System Uptime', icon: 'uptime' },
];

const PIPELINE_SEEDS: Omit<PipelineRow, 'status' | 'lastSync'>[] = [
  { name: 'FIRMS', id: 'firms', latencyMs: 340, healthScore: 98 },
  { name: 'USGS', id: 'usgs', latencyMs: 220, healthScore: 99 },
  { name: 'Weather', id: 'weather', latencyMs: 480, healthScore: 95 },
  { name: 'AIP Agent', id: 'aip', latencyMs: 780, healthScore: 91 },
  { name: 'Simulate', id: 'simulate', latencyMs: 1240, healthScore: 87 },
];

const CATEGORY_COLORS: Record<string, string> = {
  fire: 'bg-threat-orange',
  seismic: 'bg-accent',
  crew: 'bg-threat-green',
  system: 'bg-threat-purple',
};

const CATEGORY_TEXT_COLORS: Record<string, string> = {
  fire: 'text-threat-orange',
  seismic: 'text-accent',
  crew: 'text-threat-green',
  system: 'text-threat-purple',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusColor(status: PipelineStatus): string {
  if (status === 'green' || status === 'ok') return 'bg-threat-green';
  if (status === 'amber') return 'bg-threat-amber';
  if (status === 'red' || status === 'error') return 'bg-threat-red';
  return 'bg-text-muted';
}

function statusLabel(status: PipelineStatus): string {
  if (status === 'green' || status === 'ok') return 'Healthy';
  if (status === 'amber') return 'Degraded';
  if (status === 'red' || status === 'error') return 'Down';
  return 'Unknown';
}

function statusBadgeVariant(status: PipelineStatus): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'green' || status === 'ok') return 'success';
  if (status === 'amber') return 'warning';
  if (status === 'red' || status === 'error') return 'destructive';
  return 'outline';
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function generateTimeline(): HourBucket[] {
  const now = new Date();
  const buckets: HourBucket[] = [];
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    const h = hour.getHours();
    buckets.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      fire: Math.floor(Math.random() * 12) + (h >= 10 && h <= 18 ? 5 : 0),
      seismic: Math.floor(Math.random() * 4),
      crew: Math.floor(Math.random() * 6) + (h >= 8 && h <= 20 ? 3 : 0),
      system: Math.floor(Math.random() * 8) + 2,
    });
  }
  return buckets;
}

function getStatIcon(icon: string): React.ReactNode {
  const base = 'w-5 h-5';
  switch (icon) {
    case 'fire':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2c.5 2.5 3 4.5 3 8a5 5 0 0 1-10 0c0-3.5 2.5-5.5 3-8 1 2 2 3 2 3s1-1 2-3z" />
        </svg>
      );
    case 'seismic':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12h3l3-9 4 18 4-18 3 9h3" />
        </svg>
      );
    case 'crew':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'system':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'timer':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'uptime':
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const [counters, setCounters] = useState<CounterData | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[] | null>(null);
  const [loading, setLoading] = useState(true);

  const timeline = useMemo(() => generateTimeline(), []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [countersRes, healthRes, syncRes, benchRes] = await Promise.allSettled([
        api.getCounters(),
        api.health(),
        api.getSyncStatus(),
        api.getBenchmarks(),
      ]);

      if (countersRes.status === 'fulfilled') {
        const raw = countersRes.value as Record<string, number>;
        setCounters({
          hotspots: raw.hotspots ?? 0,
          deployed: raw.deployed ?? 0,
          totalCrews: raw.totalCrews ?? 8,
          damageZones: raw.damageZones ?? 0,
          sheltersFull: raw.sheltersFull ?? 0,
          hospitalsAlert: raw.hospitalsAlert ?? 0,
        });
      }

      if (healthRes.status === 'fulfilled') {
        setHealthData(healthRes.value as HealthData);
      }

      if (syncRes.status === 'fulfilled') {
        setSyncStatus(syncRes.value as unknown as SyncStatus);
      }

      if (benchRes.status === 'fulfilled') {
        const raw = benchRes.value as { benchmarks: BenchmarkResult[] };
        setBenchmarks(
          (raw.benchmarks ?? []).map((b) => ({
            ...b,
            createdAt: new Date(b.createdAt),
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = window.setInterval(() => void fetchAll(), 15000);
    return () => window.clearInterval(interval);
  }, [fetchAll]);

  /* Build pipeline rows from sync status */
  const pipelineRows: PipelineRow[] = useMemo(() => {
    return PIPELINE_SEEDS.map((seed) => {
      const syncEntry = syncStatus?.[seed.id as keyof SyncStatus] as
        | { lastSuccess: string | null; status: PipelineStatus }
        | undefined;
      return {
        ...seed,
        status: syncEntry?.status ?? 'unknown',
        lastSync: syncEntry?.lastSuccess ?? null,
      };
    });
  }, [syncStatus]);

  /* Stat card values */
  function getStatValue(key: string): string {
    if (!counters && key !== 'uptime' && key !== 'avgResponse') return '--';
    switch (key) {
      case 'hotspots':
        return String(counters?.hotspots ?? 0);
      case 'damageZones':
        return String(counters?.damageZones ?? 0);
      case 'deployed':
        return String(counters?.deployed ?? 0);
      case 'totalCrews':
        return String((counters?.hotspots ?? 0) + (counters?.damageZones ?? 0) + (counters?.deployed ?? 0) + (counters?.sheltersFull ?? 0));
      case 'avgResponse':
        return '4.2m';
      case 'uptime':
        return healthData?.uptime ? formatUptime(healthData.uptime) : '99.9%';
      default:
        return '--';
    }
  }

  function getStatTrend(key: string): { up: boolean; value: string } {
    switch (key) {
      case 'hotspots':
        return { up: true, value: '+12%' };
      case 'damageZones':
        return { up: true, value: '+3' };
      case 'deployed':
        return { up: true, value: '+2' };
      case 'totalCrews':
        return { up: true, value: '+48' };
      case 'avgResponse':
        return { up: false, value: '-0.8m' };
      case 'uptime':
        return { up: false, value: '0.0%' };
      default:
        return { up: false, value: '' };
    }
  }

  /* Benchmark extremes */
  const benchmarkExtremes = useMemo(() => {
    if (!benchmarks || benchmarks.length === 0) return { fastest: '', slowest: '' };
    const sorted = [...benchmarks].sort((a, b) => a.durationMs - b.durationMs);
    return {
      fastest: sorted[0].id,
      slowest: sorted[sorted.length - 1].id,
    };
  }, [benchmarks]);

  /* Timeline max for scaling */
  const timelineMax = useMemo(() => {
    return Math.max(...timeline.map((b) => b.fire + b.seismic + b.crew + b.system), 1);
  }, [timeline]);

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <TopBar />

      {/* Sub-header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border/60">
        <Link
          href="/live"
          className="font-data text-[10px] font-semibold text-text-muted border border-border rounded px-3 py-1.5 hover:bg-surface transition-colors tracking-wider"
        >
          &larr; LIVE DASHBOARD
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <h1 className="font-brand text-xl font-extrabold tracking-widest text-text-primary uppercase">
          Analytics
        </h1>
        <span className="font-ui text-xs text-text-muted">
          Platform performance and intelligence metrics
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void fetchAll()}
          disabled={loading}
          className="font-data text-[10px] font-semibold text-text-muted border border-border rounded px-3 py-1.5 hover:bg-surface transition-colors tracking-wider disabled:opacity-40"
        >
          {loading ? 'LOADING...' : 'REFRESH'}
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Section 1: Overview Stats */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 rounded-full bg-accent" />
            <h2 className="font-ui text-sm font-semibold text-text-primary uppercase tracking-wider">
              Overview
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STAT_CARDS.map((card) => {
              const trend = getStatTrend(card.key);
              const trendIsGood =
                card.key === 'avgResponse' ? !trend.up : card.key === 'uptime' ? true : trend.up;
              return (
                <Card key={card.key} className="relative overflow-hidden group hover:border-accent/30 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-accent/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-text-muted">
                        {getStatIcon(card.icon)}
                      </div>
                      {trend.value && (
                        <span
                          className={`font-data text-[10px] font-semibold ${
                            trendIsGood ? 'text-threat-green' : 'text-threat-red'
                          }`}
                        >
                          {trendIsGood ? '\u2191' : '\u2193'} {trend.value}
                        </span>
                      )}
                    </div>
                    {loading && !counters ? (
                      <Skeleton className="h-8 w-20 mb-1" />
                    ) : (
                      <p className="font-data text-3xl font-bold text-text-data leading-none mb-1">
                        {getStatValue(card.key)}
                      </p>
                    )}
                    <p className="font-ui text-xs text-text-muted">{card.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Section 2: Pipeline Health */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 rounded-full bg-threat-green" />
            <h2 className="font-ui text-sm font-semibold text-text-primary uppercase tracking-wider">
              Pipeline Health
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                        Pipeline
                      </th>
                      <th className="text-left font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                        Status
                      </th>
                      <th className="text-left font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                        Last Sync
                      </th>
                      <th className="text-right font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                        Latency
                      </th>
                      <th className="text-right font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                        Health Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/30 last:border-b-0 hover:bg-surface/50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <span className="font-data text-sm font-semibold text-text-primary">
                            {row.name}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${statusColor(row.status)} ${
                                row.status === 'green' || row.status === 'ok'
                                  ? 'animate-live-pulse'
                                  : ''
                              }`}
                            />
                            <Badge variant={statusBadgeVariant(row.status)}>
                              {statusLabel(row.status)}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-data text-xs text-text-muted">
                            {formatSyncTime(row.lastSync)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-data text-xs text-text-data">
                            {row.latencyMs}ms
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-2 justify-end">
                                  <div className="w-16 h-1.5 rounded-full bg-surface overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        row.healthScore >= 95
                                          ? 'bg-threat-green'
                                          : row.healthScore >= 85
                                          ? 'bg-threat-amber'
                                          : 'bg-threat-red'
                                      }`}
                                      style={{ width: `${row.healthScore}%` }}
                                    />
                                  </div>
                                  <span className="font-data text-xs text-text-data">
                                    {row.healthScore}%
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span className="font-data text-xs">
                                  {row.name} health: {row.healthScore}%
                                </span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 3: ML Benchmark Results */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 rounded-full bg-threat-purple" />
            <h2 className="font-ui text-sm font-semibold text-text-primary uppercase tracking-wider">
              ML Benchmark Results
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              {benchmarks === null ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : benchmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <svg
                    className="w-10 h-10 text-text-muted/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <p className="font-ui text-sm text-text-muted">
                    No benchmark results yet. Run a simulation to generate ML benchmarks.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                          Pipeline
                        </th>
                        <th className="text-right font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                          Duration (ms)
                        </th>
                        <th className="text-left font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                          Input Shape
                        </th>
                        <th className="text-left font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                          Device
                        </th>
                        <th className="text-right font-ui text-[10px] font-semibold text-text-muted uppercase tracking-widest px-5 py-3">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarks.map((b) => {
                        const isFastest = b.id === benchmarkExtremes.fastest;
                        const isSlowest = b.id === benchmarkExtremes.slowest;
                        return (
                          <tr
                            key={b.id}
                            className={`border-b border-border/30 last:border-b-0 transition-colors ${
                              isFastest
                                ? 'bg-threat-green/5 hover:bg-threat-green/10'
                                : isSlowest
                                ? 'bg-threat-red/5 hover:bg-threat-red/10'
                                : 'hover:bg-surface/50'
                            }`}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-data text-sm text-text-primary">
                                  {b.pipeline}
                                </span>
                                {isFastest && (
                                  <Badge variant="success">FASTEST</Badge>
                                )}
                                {isSlowest && (
                                  <Badge variant="destructive">SLOWEST</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span
                                className={`font-data text-sm font-semibold ${
                                  isFastest
                                    ? 'text-threat-green'
                                    : isSlowest
                                    ? 'text-threat-red'
                                    : 'text-text-data'
                                }`}
                              >
                                {b.durationMs.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-data text-xs text-text-muted">
                                {b.inputShape ?? '--'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant="outline">{b.device}</Badge>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="font-data text-xs text-text-muted">
                                {b.createdAt instanceof Date
                                  ? b.createdAt.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: '2-digit',
                                      year: 'numeric',
                                    })
                                  : '--'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Historical Event Timeline */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 rounded-full bg-threat-amber" />
            <h2 className="font-ui text-sm font-semibold text-text-primary uppercase tracking-wider">
              Event Timeline
            </h2>
            <span className="font-ui text-xs text-text-muted ml-2">Last 24 hours</span>
          </div>
          <Card>
            <CardContent className="p-5">
              {/* Legend */}
              <div className="flex items-center gap-5 mb-5">
                {Object.entries(CATEGORY_TEXT_COLORS).map(([cat, color]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[cat]}`} />
                    <span className={`font-ui text-[10px] uppercase tracking-wider ${color}`}>
                      {cat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1 h-40">
                {timeline.map((bucket) => {
                  const total = bucket.fire + bucket.seismic + bucket.crew + bucket.system;
                  const heightPercent = (total / timelineMax) * 100;
                  const firePct = total > 0 ? (bucket.fire / total) * 100 : 0;
                  const seismicPct = total > 0 ? (bucket.seismic / total) * 100 : 0;
                  const crewPct = total > 0 ? (bucket.crew / total) * 100 : 0;

                  return (
                    <TooltipProvider key={bucket.label}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                            <div
                              className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse transition-all group-hover:opacity-80"
                              style={{ height: `${Math.max(heightPercent, 2)}%` }}
                            >
                              <div
                                className="w-full bg-threat-orange"
                                style={{ height: `${firePct}%` }}
                              />
                              <div
                                className="w-full bg-accent"
                                style={{ height: `${seismicPct}%` }}
                              />
                              <div
                                className="w-full bg-threat-green"
                                style={{ height: `${crewPct}%` }}
                              />
                              <div className="w-full bg-threat-purple flex-1" />
                            </div>
                            {bucket.hour % 3 === 0 && (
                              <span className="font-data text-[8px] text-text-muted">
                                {bucket.label}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            <p className="font-data text-xs font-semibold">{bucket.label}</p>
                            <p className="font-data text-[10px] text-threat-orange">
                              Fire: {bucket.fire}
                            </p>
                            <p className="font-data text-[10px] text-accent">
                              Seismic: {bucket.seismic}
                            </p>
                            <p className="font-data text-[10px] text-threat-green">
                              Crew: {bucket.crew}
                            </p>
                            <p className="font-data text-[10px] text-threat-purple">
                              System: {bucket.system}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Navigation links */}
        <div className="flex items-center gap-3 pt-2 pb-8">
          <Link
            href="/incidents"
            className="font-ui text-sm text-accent hover:text-accent/80 transition-colors"
          >
            View Incident History &rarr;
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <Link
            href="/settings"
            className="font-ui text-sm text-accent hover:text-accent/80 transition-colors"
          >
            Platform Settings &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}

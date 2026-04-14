// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import type { PipelineStatus, SyncStatus } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DataSourceStatus {
  name: string;
  id: string;
  description: string;
  status: PipelineStatus;
  lastSuccess: string | null;
  endpoint: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTO_REFRESH_OPTIONS = [
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusDotColor(status: PipelineStatus): string {
  if (status === 'green' || status === 'ok') return 'bg-threat-green';
  if (status === 'amber') return 'bg-threat-amber';
  if (status === 'red' || status === 'error') return 'bg-threat-red';
  return 'bg-text-muted';
}

function statusBadgeVariant(status: PipelineStatus): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'green' || status === 'ok') return 'success';
  if (status === 'amber') return 'warning';
  if (status === 'red' || status === 'error') return 'destructive';
  return 'outline';
}

function statusLabel(status: PipelineStatus): string {
  if (status === 'green' || status === 'ok') return 'Connected';
  if (status === 'amber') return 'Degraded';
  if (status === 'red' || status === 'error') return 'Disconnected';
  return 'Unknown';
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Section Components                                                 */
/* ------------------------------------------------------------------ */

function SectionHeading({
  color,
  title,
  subtitle,
}: {
  color: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-1 h-5 rounded-full ${color}`} />
      <div>
        <h2 className="font-ui text-sm font-semibold text-text-primary uppercase tracking-wider">
          {title}
        </h2>
        {subtitle && (
          <p className="font-ui text-xs text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border/30 last:border-b-0">
      <div className="space-y-0.5">
        <p className="font-ui text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="font-ui text-xs text-text-muted">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(15);
  const [autoApprove, setAutoApprove] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [syncRes] = await Promise.allSettled([
        api.getSyncStatus(),
      ]);

      if (syncRes.status === 'fulfilled') {
        setSyncStatus(syncRes.value as unknown as SyncStatus);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 30000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  /* Build data source list from sync status */
  const dataSources: DataSourceStatus[] = [
    {
      name: 'FIRMS Satellite Feed',
      id: 'firms',
      description: 'NASA Fire Information for Resource Management System — active fire detection via VIIRS/MODIS',
      status: (syncStatus?.firms?.status as PipelineStatus) ?? 'unknown',
      lastSuccess: syncStatus?.firms?.lastSuccess ?? null,
      endpoint: 'https://firms.modaps.eosdis.nasa.gov/api',
    },
    {
      name: 'USGS Earthquake Feed',
      id: 'usgs',
      description: 'United States Geological Survey real-time seismic event feed (GeoJSON)',
      status: (syncStatus?.usgs?.status as PipelineStatus) ?? 'unknown',
      lastSuccess: syncStatus?.usgs?.lastSuccess ?? null,
      endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0',
    },
    {
      name: 'Weather API',
      id: 'weather',
      description: 'Real-time meteorological data including wind speed, direction, humidity, and temperature',
      status: (syncStatus?.weather?.status as PipelineStatus) ?? 'unknown',
      lastSuccess: syncStatus?.weather?.lastSuccess ?? null,
      endpoint: 'api.openweathermap.org/data/3.0',
    },
  ];

  const confidenceThreshold = 75;

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
        <div>
          <h1 className="font-brand text-xl font-extrabold tracking-widest text-text-primary uppercase">
            Settings
          </h1>
          <p className="font-ui text-xs text-text-muted mt-0.5">
            Platform configuration and data source management
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href="/analytics"
          className="font-ui text-sm text-accent hover:text-accent/80 transition-colors"
        >
          Analytics &rarr;
        </Link>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-8">
        {/* General Settings */}
        <section>
          <SectionHeading color="bg-accent" title="General" subtitle="Application preferences" />
          <Card>
            <CardContent className="p-5">
              <SettingRow
                label="Theme"
                description="Visual theme for the platform interface"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="default">DARK</Badge>
                  <span className="font-ui text-[10px] text-text-muted">(locked)</span>
                </div>
              </SettingRow>

              <SettingRow
                label="Audio Alerts"
                description="Play audio for critical events and action card generation"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={audioAlerts}
                    onCheckedChange={setAudioAlerts}
                  />
                  <span className="font-data text-xs text-text-muted w-8">
                    {audioAlerts ? 'ON' : 'OFF'}
                  </span>
                </div>
              </SettingRow>

              <SettingRow
                label="Auto-Refresh Interval"
                description="Frequency of data polling from backend services"
              >
                <div className="flex items-center gap-1">
                  {AUTO_REFRESH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAutoRefresh(opt.value)}
                      className={`font-data text-[11px] font-semibold px-2.5 py-1 rounded transition-colors ${
                        autoRefresh === opt.value
                          ? 'bg-accent text-bg'
                          : 'bg-surface text-text-muted hover:bg-border/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow
                label="Notification Sound"
                description="Audible tone when new action cards arrive"
              >
                <Badge variant="outline">Default Tone</Badge>
              </SettingRow>
            </CardContent>
          </Card>
        </section>

        {/* Data Sources */}
        <section>
          <SectionHeading
            color="bg-threat-green"
            title="Data Sources"
            subtitle="External feed connections and sync status"
          />

          <div className="space-y-3">
            {dataSources.map((source) => (
              <Card key={source.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotColor(
                            source.status
                          )} ${
                            source.status === 'green' || source.status === 'ok'
                              ? 'animate-live-pulse'
                              : ''
                          }`}
                        />
                        <h3 className="font-ui text-sm font-semibold text-text-primary">
                          {source.name}
                        </h3>
                        <Badge variant={statusBadgeVariant(source.status)}>
                          {statusLabel(source.status)}
                        </Badge>
                      </div>
                      <p className="font-ui text-xs text-text-muted leading-relaxed pl-5">
                        {source.description}
                      </p>
                      <div className="flex items-center gap-6 pl-5 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="font-ui text-[10px] text-text-muted uppercase tracking-wider">
                            Last Sync
                          </span>
                          {loading ? (
                            <Skeleton className="h-3 w-16" />
                          ) : (
                            <span className="font-data text-xs text-text-data">
                              {formatSyncTime(source.lastSuccess)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-ui text-[10px] text-text-muted uppercase tracking-wider">
                            Endpoint
                          </span>
                          <span className="font-data text-[10px] text-text-muted truncate max-w-xs">
                            {source.endpoint}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* AI Configuration */}
        <section>
          <SectionHeading
            color="bg-threat-purple"
            title="AI Configuration"
            subtitle="AIP Agent and ML pipeline settings"
          />
          <Card>
            <CardContent className="p-5">
              <SettingRow
                label="Model"
                description="Primary AI model powering the AIP agent"
              >
                <Badge variant="outline">
                  <span className="font-data">HuggingFace / distilbert-base</span>
                </Badge>
              </SettingRow>

              <SettingRow
                label="Confidence Threshold"
                description="Minimum confidence required for autonomous action generation"
              >
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-threat-amber to-threat-green transition-all"
                      style={{ width: `${confidenceThreshold}%` }}
                    />
                  </div>
                  <span className="font-data text-sm font-bold text-text-data w-12 text-right">
                    {confidenceThreshold}%
                  </span>
                </div>
              </SettingRow>

              <SettingRow
                label="Auto-Approve Actions"
                description="Automatically approve actions above confidence threshold (use with caution)"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={autoApprove}
                    onCheckedChange={setAutoApprove}
                  />
                  <span
                    className={`font-data text-xs ${
                      autoApprove ? 'text-threat-red' : 'text-text-muted'
                    } w-8`}
                  >
                    {autoApprove ? 'ON' : 'OFF'}
                  </span>
                </div>
              </SettingRow>

              <SettingRow
                label="ML Pipeline"
                description="Seismic CNN and damage model inference configuration"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    <span className="font-data">CPU</span>
                  </Badge>
                  <Badge variant="success">Active</Badge>
                </div>
              </SettingRow>

              <SettingRow
                label="TTS Engine"
                description="Text-to-speech engine for audio briefings"
              >
                <Badge variant="outline">
                  <span className="font-data">ElevenLabs</span>
                </Badge>
              </SettingRow>
            </CardContent>
          </Card>
        </section>

        {/* System Information */}
        <section className="pb-8">
          <SectionHeading
            color="bg-threat-amber"
            title="System"
            subtitle="Platform version and diagnostics"
          />
          <Card>
            <CardContent className="p-5">
              <SettingRow label="Platform" description="Version identifier">
                <span className="font-data text-sm text-text-data">SENTRY v1.0.0</span>
              </SettingRow>

              <SettingRow label="Backend" description="API server framework">
                <span className="font-data text-xs text-text-muted">FastAPI / Python 3.13</span>
              </SettingRow>

              <SettingRow label="Frontend" description="Client framework">
                <span className="font-data text-xs text-text-muted">Next.js 14 / React 18</span>
              </SettingRow>

              <SettingRow label="Database" description="Local persistence">
                <span className="font-data text-xs text-text-muted">SQLite (sentinel.db)</span>
              </SettingRow>

              <SettingRow
                label="WebSocket"
                description="Real-time event transport"
              >
                <Badge variant="success">Connected</Badge>
              </SettingRow>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

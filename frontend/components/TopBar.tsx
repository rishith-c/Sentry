// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import type { Counter, PipelineStatus } from '@/lib/types';

const PIPELINE_STATUS_COLOR: Record<PipelineStatus, string> = {
  green: 'bg-threat-green',
  ok: 'bg-threat-green',
  amber: 'bg-threat-amber',
  red: 'bg-threat-red',
  error: 'bg-threat-red',
  unknown: 'bg-text-muted',
};

interface CounterDisplay {
  key: keyof Counter;
  label: string;
}

const COUNTER_DISPLAYS: readonly CounterDisplay[] = [
  { key: 'hotspots', label: 'Hotspots' },
  { key: 'deployed', label: 'Deployed' },
  { key: 'totalCrews', label: 'Crews' },
  { key: 'damageZones', label: 'Damage' },
  { key: 'sheltersFull', label: 'Shelters Full' },
  { key: 'hospitalsAlert', label: 'Hospitals' },
] as const;

function formatCounterValue(key: keyof Counter, counters: Counter): string {
  if (key === 'deployed') {
    return `${counters.deployed}/${counters.totalCrews}`;
  }
  return String(counters[key]);
}

export default function TopBar() {
  const pipelines = useStore((s) => s.pipelines);
  const counters = useStore((s) => s.counters);
  const counterFlash = useStore((s) => s.counterFlash);
  const wsState = useStore((s) => s.wsState);
  const wsLatency = useStore((s) => s.wsLatency);
  const isMuted = useStore((s) => s.isMuted);
  const setMuted = useStore((s) => s.setMuted);
  const pathname = usePathname();

  const [utcTime, setUtcTime] = useState('');

  const tick = useCallback(() => {
    const now = new Date();
    setUtcTime(
      now.toISOString().slice(11, 19) + 'Z'
    );
  }, []);

  useEffect(() => {
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  const isLive = pathname === '/live';
  const isAnalytics = pathname === '/analytics';

  return (
    <TooltipProvider delayDuration={200}>
      <header className="flex items-center h-12 bg-surface border-b border-border px-3 shrink-0">
        {/* Left: Brand */}
        <span className="font-brand text-lg tracking-widest text-text-primary font-bold select-none">
          SENTRY
        </span>

        <Separator orientation="vertical" className="mx-3 h-5" />

        {/* Pipeline sync dots */}
        <div className="flex items-center gap-2">
          {pipelines.map((pipeline) => (
            <Tooltip key={pipeline.id}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-block w-2 h-2 rounded-full shrink-0',
                    PIPELINE_STATUS_COLOR[pipeline.status] ?? 'bg-text-muted'
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="font-ui text-xs">
                  {pipeline.name}:{' '}
                  <span className="font-data">{pipeline.status.toUpperCase()}</span>
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator orientation="vertical" className="mx-3 h-5" />

        {/* Counter badges */}
        <div className="flex items-center gap-3">
          {COUNTER_DISPLAYS.map((display) => {
            if (display.key === 'totalCrews') return null;
            const isFlashing = counterFlash[display.key];
            return (
              <div key={display.key} className="flex flex-col items-center">
                <span className="font-ui text-[10px] text-text-muted leading-none">
                  {display.label}
                </span>
                <span
                  className={cn(
                    'font-data text-lg leading-tight text-text-data transition-colors',
                    isFlashing && 'text-threat-amber'
                  )}
                >
                  {formatCounterValue(display.key, counters)}
                </span>
              </div>
            );
          })}
        </div>

        <Separator orientation="vertical" className="mx-3 h-5" />

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <Link
            href="/live"
            className={cn(
              'font-ui text-xs font-semibold tracking-wider px-3 py-1 rounded transition-colors',
              isLive
                ? 'bg-threat-red/15 text-threat-red border border-threat-red/30'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            LIVE
          </Link>
          <Link
            href="/analytics"
            className={cn(
              'font-ui text-xs font-semibold tracking-wider px-3 py-1 rounded transition-colors',
              isAnalytics
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            ANALYTICS
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* WS Latency */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'font-data text-xs',
                  wsState === 'connected' ? 'text-threat-green' : 'text-threat-red'
                )}
              >
                {wsLatency}ms
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="font-ui text-xs">
                WebSocket: {wsState}
              </span>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          {/* Mute toggle */}
          <div className="flex items-center gap-2">
            <span className="font-ui text-[10px] text-text-muted">
              {isMuted ? 'MUTED' : 'AUDIO'}
            </span>
            <Switch
              checked={!isMuted}
              onCheckedChange={(checked) => setMuted(!checked)}
              className="scale-75"
            />
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* UTC clock */}
          <span className="font-data text-sm text-text-data tracking-wide">
            {utcTime}
          </span>
        </div>
      </header>
    </TooltipProvider>
  );
}

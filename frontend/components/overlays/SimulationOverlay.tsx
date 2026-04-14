// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function SimulationOverlay() {
  const isSimulating = useStore((s) => s.isSimulating);

  if (!isSimulating) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[500] pointer-events-none',
        'border-2 border-threat-amber/30'
      )}
    >
      {/* Amber glow corners */}
      <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(245,158,11,0.08)]" />

      {/* Centered top pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <Badge
          className={cn(
            'font-data text-xs font-bold tracking-widest px-4 py-1.5',
            'bg-threat-amber/15 border border-threat-amber/40 text-threat-amber',
            'animate-live-pulse'
          )}
        >
          SIMULATION RUNNING
        </Badge>
      </div>
    </div>
  );
}

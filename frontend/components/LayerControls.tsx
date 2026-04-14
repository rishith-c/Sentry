// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { resetSimulation, triggerSimulation } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { LayerKey } from '@/lib/types';

interface LayerConfig {
  key: LayerKey;
  label: string;
  activeColor: string;
  activeBorder: string;
}

const LAYERS: readonly LayerConfig[] = [
  { key: 'fire', label: 'Fire', activeColor: 'text-threat-orange', activeBorder: 'border-threat-orange' },
  { key: 'ember', label: 'Ember', activeColor: 'text-threat-amber', activeBorder: 'border-threat-amber' },
  { key: 'seismic', label: 'Seismic', activeColor: 'text-accent', activeBorder: 'border-accent' },
  { key: 'crews', label: 'Crews', activeColor: 'text-threat-green', activeBorder: 'border-threat-green' },
  { key: 'infrastructure', label: 'Infrastructure', activeColor: 'text-threat-purple', activeBorder: 'border-threat-purple' },
] as const;

export default function LayerControls() {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const isSimulating = useStore((s) => s.isSimulating);
  const setSimulating = useStore((s) => s.setSimulating);
  const clearSimulationData = useStore((s) => s.clearSimulationData);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    setPending(true);
    setError(null);
    clearSimulationData();
    try {
      await resetSimulation().catch(() => null);
      await triggerSimulation();
      setSimulating(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Simulation failed';
      setError(message);
      setSimulating(false);
    } finally {
      setPending(false);
    }
  }, [clearSimulationData, setSimulating]);

  return (
    <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
      {/* Layer toggle pills */}
      <div className="flex items-center gap-1.5 bg-surface/90 backdrop-blur-sm border border-border rounded-lg p-1.5">
        {LAYERS.map((layer) => {
          const isActive = layers[layer.key];
          return (
            <Button
              key={layer.key}
              variant="ghost"
              size="sm"
              onClick={() => toggleLayer(layer.key)}
              className={cn(
                'h-7 px-3 rounded-md font-ui text-[11px] font-medium tracking-wide min-h-0 transition-all',
                isActive
                  ? `${layer.activeColor} border ${layer.activeBorder} bg-bg/50`
                  : 'text-text-muted border border-transparent hover:border-border'
              )}
            >
              {layer.label}
            </Button>
          );
        })}
      </div>

      {/* Simulate button */}
      <div className="flex items-center gap-2">
        {pending ? (
          <Skeleton className="h-8 w-28 rounded-lg" />
        ) : (
          <Button
            size="sm"
            onClick={runSimulation}
            disabled={pending || isSimulating}
            className={cn(
              'h-8 px-4 rounded-lg font-ui text-xs font-bold tracking-wide min-h-0',
              isSimulating
                ? 'bg-surface text-text-muted border border-border cursor-default'
                : 'bg-threat-amber text-bg hover:bg-threat-amber/90 border border-threat-amber/50'
            )}
          >
            {isSimulating ? 'RUNNING...' : 'SIMULATE'}
          </Button>
        )}

        {isSimulating && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-threat-red animate-live-pulse" />
            <span className="font-data text-[10px] text-threat-red tracking-wide">
              LIVE
            </span>
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-threat-red/10 border border-threat-red/30 rounded-md px-3 py-1.5">
          <span className="font-ui text-xs text-threat-red">{error}</span>
        </div>
      )}
    </div>
  );
}

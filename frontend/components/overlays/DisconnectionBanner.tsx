// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';

export default function DisconnectionBanner() {
  const wsState = useStore((s) => s.wsState);
  const wsReconnectAttempt = useStore((s) => s.wsReconnectAttempt);
  const wsReconnectMax = useStore((s) => s.wsReconnectMax);
  const wsRestored = useStore((s) => s.wsRestored);
  const setWsRestored = useStore((s) => s.setWsRestored);
  const [showRestored, setShowRestored] = useState(false);

  const isDisconnected = wsState !== 'connected';

  // Show "Connection restored" briefly when reconnecting succeeds
  useEffect(() => {
    if (wsRestored) {
      setShowRestored(true);
      const timeout = setTimeout(() => {
        setShowRestored(false);
        setWsRestored(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [wsRestored, setWsRestored]);

  if (!isDisconnected && !showRestored) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 transition-colors',
        showRestored
          ? 'bg-threat-green/90'
          : 'bg-threat-red/90'
      )}
    >
      {showRestored ? (
        <span className="font-ui text-sm font-semibold text-bg">
          Connection restored
        </span>
      ) : (
        <>
          {/* Animated pulse dot */}
          <span className="inline-block w-2 h-2 rounded-full bg-text-primary animate-pulse shrink-0" />

          <span className="font-ui text-sm font-semibold text-text-primary">
            {wsState === 'reconnecting'
              ? 'Reconnecting...'
              : wsState === 'error'
                ? 'Connection error'
                : 'Disconnected'}
          </span>

          {wsReconnectAttempt > 0 && (
            <span className="font-data text-xs text-text-primary/80">
              Attempt {wsReconnectAttempt} of {wsReconnectMax}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EventCategory } from '@/lib/types';

const MAX_VISIBLE_EVENTS = 50;

const CATEGORY_DOT_COLOR: Record<EventCategory, string> = {
  seismic: 'bg-accent',
  fire: 'bg-threat-orange',
  crew: 'bg-threat-green',
  infrastructure: 'bg-threat-amber',
  ai: 'bg-threat-purple',
  aip: 'bg-threat-purple',
  system: 'bg-text-muted',
  tts: 'bg-text-muted',
};

const CATEGORY_TEXT_COLOR: Record<EventCategory, string> = {
  seismic: 'text-accent',
  fire: 'text-threat-orange',
  crew: 'text-threat-green',
  infrastructure: 'text-threat-amber',
  ai: 'text-threat-purple',
  aip: 'text-threat-purple',
  system: 'text-text-muted',
  tts: 'text-text-muted',
};

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function EventFeed() {
  const events = useStore((s) => s.events);
  const isPaused = useStore((s) => s.isFeedPaused);
  const pendingWhilePaused = useStore((s) => s.pendingEventsWhilePaused);
  const setFeedPaused = useStore((s) => s.setFeedPaused);
  const resumeFeed = useStore((s) => s.resumeFeed);
  const sessionEventCount = useStore((s) => s.sessionEventCount);

  const visibleEvents = useMemo(
    () => events.slice(0, MAX_VISIBLE_EVENTS),
    [events]
  );

  const handleTogglePause = () => {
    if (isPaused) {
      resumeFeed();
    } else {
      setFeedPaused(true);
    }
  };

  return (
    <footer className="flex flex-col h-[120px] bg-surface border-t border-border shrink-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border/50 shrink-0">
        <span className="font-ui text-[10px] font-semibold tracking-wider text-text-muted uppercase">
          Event Feed
        </span>

        <Badge variant="outline" className="font-data text-[10px] px-1.5 py-0">
          {sessionEventCount}
        </Badge>

        {isPaused && pendingWhilePaused > 0 && (
          <Badge variant="warning" className="font-data text-[10px] px-1.5 py-0">
            +{pendingWhilePaused} new
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleTogglePause}
          className={cn(
            'h-6 px-2 rounded-md font-ui text-[10px] font-semibold min-h-0',
            isPaused
              ? 'text-threat-amber hover:text-threat-amber/80'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          {isPaused ? 'RESUME' : 'PAUSE'}
        </Button>
      </div>

      {/* Event list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {visibleEvents.length === 0 ? (
            <div className="flex items-center justify-center h-16">
              <span className="font-ui text-xs text-text-muted">
                No events yet
              </span>
            </div>
          ) : (
            visibleEvents.map((event) => {
              const dotColor = CATEGORY_DOT_COLOR[event.category] ?? 'bg-text-muted';
              const textColor = CATEGORY_TEXT_COLOR[event.category] ?? 'text-text-muted';

              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-1 border-b border-border/20 hover:bg-bg/30 transition-colors"
                >
                  {/* Category dot */}
                  <span
                    className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', dotColor)}
                  />

                  {/* Timestamp */}
                  <span className="font-data text-[10px] text-text-muted shrink-0 w-16">
                    {formatEventTime(event.timestamp)}
                  </span>

                  {/* Source badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-data text-[9px] px-1.5 py-0 rounded shrink-0 uppercase',
                      textColor
                    )}
                  >
                    {event.source}
                  </Badge>

                  {/* Message */}
                  <span className="font-ui text-sm text-text-data truncate">
                    {event.message ?? event.description}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </footer>
  );
}

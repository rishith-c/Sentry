// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const AGENT_LABEL_COLOR: Record<string, string> = {
  USGS_POLLER: 'text-threat-red',
  FIRMS_POLLER: 'text-threat-orange',
  SEISMIC_CNN: 'text-accent',
  GMPE_ENGINE: 'text-accent',
  EMBER_SIM: 'text-threat-amber',
  AIP_AGENT: 'text-threat-purple',
  ELEVENLABS: 'text-threat-green',
  BROADCASTER: 'text-text-muted',
  COMMANDER: 'text-text-primary',
  FRONTEND: 'text-text-muted',
};

function formatMsgTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AgentComms() {
  const messages = useStore((s) => s.commsMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col bg-surface border border-border rounded-lg overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <span className="font-ui text-xs font-semibold tracking-wider text-text-primary uppercase">
          Agent Comms
        </span>
        <span className="font-data text-[10px] text-text-muted">
          {messages.length} msgs
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <span className="font-ui text-sm text-text-muted">
                Awaiting agent traffic...
              </span>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const fromColor = AGENT_LABEL_COLOR[msg.from] ?? 'text-text-muted';
              const isFromAgent = msg.from !== 'FRONTEND';

              return (
                <div
                  key={idx}
                  className={cn(
                    'px-3 py-2 border-b border-border/30',
                    isFromAgent ? 'bg-bg/30' : 'bg-surface'
                  )}
                >
                  {/* Sender / Receiver / Timestamp row */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('font-ui text-[10px] font-semibold tracking-wide', fromColor)}>
                      {msg.from}
                    </span>
                    <span className="font-ui text-[9px] text-text-muted/40">
                      &rarr;
                    </span>
                    <span className="font-ui text-[10px] text-text-muted">
                      {msg.to}
                    </span>
                    <span className="font-data text-[9px] text-text-muted/60 ml-auto">
                      {formatMsgTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* Message bubble */}
                  <div
                    className={cn(
                      'rounded-md px-2.5 py-1.5 max-w-[90%]',
                      isFromAgent
                        ? 'bg-surface border border-border/50 ml-0'
                        : 'bg-accent/10 border border-accent/20 ml-auto'
                    )}
                  >
                    <p className="font-ui text-sm text-text-data leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

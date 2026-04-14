'use client';

import { useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';

const CATEGORY_COLOR: Record<string, string> = {
  fire:           '#f97316',
  seismic:        '#22c55e',
  crew:           '#3b82f6',
  infrastructure: '#f59e0b',
  ai:             '#a855f7',
  aip:            '#8b5cf6',
  system:         '#64748b',
};

const CATEGORY_LABEL: Record<string, string> = {
  fire:           'FIRE',
  seismic:        'SEISMIC',
  crew:           'CREW',
  infrastructure: 'INFRA',
  ai:             'AI',
  aip:            'AIP',
  system:         'SYS',
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Derive a display category from the raw WS message type when it doesn't map directly
function resolveCategory(cat: string): string {
  if (cat in CATEGORY_LABEL) return cat;
  if (cat.includes('fire') || cat.includes('hotspot') || cat.includes('ember')) return 'fire';
  if (cat.includes('seismic') || cat.includes('damage') || cat.includes('epicenter')) return 'seismic';
  if (cat.includes('crew')) return 'crew';
  if (cat.includes('action') || cat.includes('ai')) return 'ai';
  return 'system';
}

export default function EventFeed() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const events = useStore(s => s.events);
  const isSimulating = useStore(s => s.isSimulating);

  // Auto-scroll to top (newest) when not simulating, or always during simulation
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events.length]);

  return (
    <section style={{
      height: 160, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#000000', borderTop: '1px solid #222222',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 28, flexShrink: 0,
        background: '#0a0a0a', borderBottom: '1px solid #222222',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: '"Fira Code", monospace', fontSize: 9, fontWeight: 700,
            color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>STATUS FEED</span>
          <span style={{
            display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
            background: isSimulating ? '#ef4444' : '#22c55e',
            animation: 'pulse-slow 2s ease-in-out infinite',
          }} />
          {isSimulating && (
            <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 8, color: '#ef4444', letterSpacing: '0.06em' }}>
              LIVE SIMULATION
            </span>
          )}
        </div>
        <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 8, color: '#444444' }}>
          {events.length} events
        </span>
      </div>

      {/* Events */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
        {events.map((event, i) => {
          const cat = resolveCategory(event.category ?? 'system');
          const color = CATEGORY_COLOR[cat] ?? '#64748b';
          const label = CATEGORY_LABEL[cat] ?? 'SYS';
          const desc = event.description?.trim();
          if (!desc) return null;
          return (
            <div key={`${event.id}-${i}`} style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              minHeight: 22, padding: '2px 0',
              borderBottom: i === 0 ? '1px solid #1a1a1a' : 'none',
            }}>
              {/* suppressHydrationWarning prevents mismatch between SSR and client clock */}
              <span suppressHydrationWarning style={{
                fontFamily: '"Fira Code", monospace', fontSize: 11,
                color: '#444444', width: 66, flexShrink: 0,
              }}>
                {formatTime(event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp))}
              </span>
              <span style={{
                fontFamily: '"Fira Code", monospace', fontSize: 10, fontWeight: 700,
                color, width: 52, flexShrink: 0, letterSpacing: '0.06em',
              }}>
                [{label}]
              </span>
              <span style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 13,
                fontWeight: i === 0 ? 500 : 400,
                color: i === 0 ? '#e2e8f0' : '#666666',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }} title={desc}>
                {desc}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`@keyframes pulse-slow { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </section>
  );
}

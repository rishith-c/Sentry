'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';

const AGENT_COLORS: Record<string, string> = {
  USGS_POLLER:    '#ef4444',
  FIRMS_POLLER:   '#ef4444',
  SEISMIC_CNN:    '#f97316',
  GMPE_ENGINE:    '#f97316',
  LIQUEFACTION:   '#f59e0b',
  EMBER_SIM:      '#f59e0b',
  AIP_AGENT:      '#8b5cf6',
  BROADCASTER:    '#3b82f6',
  FRONTEND:       '#3b82f6',
  ELEVENLABS:     '#10b981',
  COMMANDER:      '#f1f5f9',
};

const CHARS_PER_SEC = 40;

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, 1000 / CHARS_PER_SEC);
    return () => clearInterval(interval);
  }, [text]);

  return <>{displayed}<span style={{ opacity: 0.3 }}>_</span></>;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AgentComms() {
  const isSimulating = useStore((s) => s.isSimulating);
  const commsMessages = useStore((s) => s.commsMessages);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [commsMessages.length]);

  const simDone = !isSimulating && commsMessages.length > 0;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'absolute', left: 0, top: 0, zIndex: 20,
          background: '#0a0e1a', border: '1px solid #1e293b',
          borderLeft: 'none', borderTop: 'none',
          borderRadius: '0 0 6px 0',
          padding: '8px 12px',
          color: '#64748b', cursor: 'pointer',
          fontFamily: '"Fira Code", monospace', fontSize: 10,
          fontWeight: 700, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: isSimulating ? '#22c55e' : '#334155',
          animation: isSimulating ? 'pulse-slow 2s ease-in-out infinite' : 'none',
        }} />
        AGENT COMMS
      </button>
    );
  }

  return (
    <div style={{
      width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#0a0e1a', borderRight: '1px solid #1e293b',
      fontFamily: '"Fira Code", monospace',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 32, flexShrink: 0,
        borderBottom: '1px solid #1e293b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: isSimulating ? '#22c55e' : '#334155',
            animation: isSimulating ? 'pulse-slow 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#e2e8f0',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            AGENT COMMS
          </span>
          {commsMessages.length > 0 && (
            <span style={{ fontSize: 8, color: '#475569' }}>
              {commsMessages.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: 14, padding: '2px 4px',
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {commsMessages.length === 0 && (
          <div style={{
            color: '#334155', fontSize: 11, fontStyle: 'italic',
            padding: '20px 0', textAlign: 'center',
          }}>
            Awaiting incident trigger...
          </div>
        )}

        {commsMessages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', gap: 1,
            padding: '4px 0',
            borderBottom: '1px solid #0f172a',
          }}>
            {/* Agent routing line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span suppressHydrationWarning style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>
                {formatTime(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp))}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: AGENT_COLORS[msg.from] ?? '#64748b',
              }}>
                {msg.from}
              </span>
              <span style={{ fontSize: 11, color: '#475569' }}>&rarr;</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: AGENT_COLORS[msg.to] ?? '#64748b',
              }}>
                {msg.to}
              </span>
            </div>
            {/* Message text */}
            <div style={{
              fontSize: 12, color: '#f1f5f9', lineHeight: 1.5,
              paddingLeft: 4,
            }}>
              {i === commsMessages.length - 1 ? (
                <TypewriterText text={msg.text} />
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}

        {simDone && (
          <div style={{
            color: '#22c55e', fontSize: 10, fontWeight: 700,
            padding: '12px 0 4px', textAlign: 'center',
            letterSpacing: '0.05em',
          }}>
            All systems nominal. Awaiting commander input.
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Volume2, VolumeX, Zap } from 'lucide-react';
import { triggerSimulation, resetSimulation } from '@/lib/api';
import { useStore } from '@/store/useStore';

const LAYERS: { key: string; label: string; color: string; icon: (c: string) => React.ReactNode }[] = [
  {
    key: 'fire', label: 'Fire Perimeter', color: '#ef4444',
    icon: (c) => (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1C6 1 9 4.5 9 6.8C9 8.6 7.7 10 6 10C4.3 10 3 8.6 3 6.8C3 5.2 4 3.5 5 3C5 4 5.5 4.5 6 4C6 4 7 3 6 1Z" fill={c}/>
      </svg>
    ),
  },
  {
    key: 'ember', label: 'Fire Spread', color: '#f97316',
    icon: (c) => (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 4C3.5 4 3.5 2 6 2C8.5 2 9.5 4 11 4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M1 7C3.5 7 3.5 5 6 5C8.5 5 9.5 7 11 7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="9.5" cy="9.5" r="1.2" fill={c}/>
      </svg>
    ),
  },
  {
    key: 'seismic', label: 'Seismic Damage', color: '#38bdf8',
    icon: (c) => (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <polyline points="1,6 3,6 4,2.5 5,9.5 6,6 7,4 8,8 9,6 11,6" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    key: 'crews', label: 'Crews', color: '#3b82f6',
    icon: (c) => (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="3.5" r="2" fill={c}/>
        <path d="M2.5 11C2.5 8.5 4 7 6 7C8 7 9.5 8.5 9.5 11" fill={c}/>
      </svg>
    ),
  },
  {
    key: 'infrastructure', label: 'Infrastructure', color: '#f59e0b',
    icon: (c) => (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="5" y="2" width="2" height="8" fill={c}/>
        <rect x="2" y="5" width="8" height="2" fill={c}/>
      </svg>
    ),
  },
];

// Mini scale entries shown inline in the toolbar
const DAMAGE_SCALE = [
  { color: '#4ade80', label: 'Low' },
  { color: '#facc15', label: 'Mod' },
  { color: '#fb923c', label: 'High' },
  { color: '#f43f5e', label: 'Crit' },
];

export default function LayerControls() {
  const [active, setActive] = React.useState<Record<string, boolean>>({
    fire: true, ember: true, seismic: true, crews: true, infrastructure: true,
  });
  const muted = useStore((s) => s.isMuted);
  const setMuted = useStore((s) => s.setMuted);
  const toggle = (key: string) => setActive(prev => ({ ...prev, [key]: !prev[key] }));
  const isSimulating = useStore((s) => s.isSimulating);
  const setSimulating = useStore((s) => s.setSimulating);
  const clearSimulationData = useStore((s) => s.clearSimulationData);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 48, padding: '0 14px',
      background: '#0a0a0a', borderBottom: '1px solid #222222',
      flexShrink: 0, justifyContent: 'space-between',
    }}>
      {/* Layer wave-pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {LAYERS.map(({ key, label, color, icon }) => {
          const on = active[key];
          return (
            <button key={key} onClick={() => toggle(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px',
              borderRadius: 9999,
              border: on ? `1px solid ${color}55` : '1px solid #2a2a2a',
              background: on ? '#1f1f1f' : 'transparent',
              color: on ? '#ffffff' : '#444444',
              fontSize: 12,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              letterSpacing: '0.01em',
            }}>
              <span style={{ flexShrink: 0, opacity: on ? 1 : 0.3, display: 'flex' }}>
                {icon(color)}
              </span>
              {label}
            </button>
          );
        })}

        {/* Damage severity scale — shows the seismic color gradient inline */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px',
          borderRadius: 9999,
          border: '1px solid #2a2a2a',
          background: 'transparent',
        }}>
          {DAMAGE_SCALE.map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{
                fontSize: 10, fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 600, color: '#666666', letterSpacing: '0.02em',
              }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Simulation status badge — appears next to Infrastructure when running */}
        {isSimulating && (
          <>
            {/* Divider */}
            <div style={{ width: 1, height: 20, background: '#2a2a2a', flexShrink: 0 }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px',
              borderRadius: 9999,
              border: '1px solid #ef444444',
              background: 'rgba(239,68,68,0.07)',
            }}>
              {/* Heartbeat icon */}
              <svg width="28" height="14" viewBox="0 0 44 18" fill="none" style={{ flexShrink: 0 }}>
                <path d="M2 9L9 9L12 3L15 15L18 9L20 9L22 5L24 13L27 9L35 9" stroke="#ef4444" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
                color: '#ef4444', letterSpacing: '0.08em', textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                Simulating Northridge 1994 — M6.7
              </span>
              {/* Bouncing dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {[0, 100, 200].map(delay => (
                  <span key={delay} style={{
                    width: 4, height: 4, borderRadius: '50%', background: '#ef4444',
                    display: 'inline-block',
                    animation: `bounce ${0.6}s ease-in-out ${delay}ms infinite`,
                  }} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Voice button — bigger */}
        <button onClick={() => setMuted(!muted)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 20px',
          borderRadius: 9999,
          border: '1px solid #444444',
          background: muted ? 'transparent' : '#1f1f1f',
          color: muted ? '#444444' : '#ffffff',
          fontSize: 13,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          letterSpacing: '0.01em',
        }}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {muted ? 'Muted' : 'Voice'}
        </button>

        {/* Simulate Crisis */}
        <button
          disabled={isSimulating}
          onClick={() => {
            if (isSimulating) return;
            clearSimulationData();
            resetSimulation().then(() => triggerSimulation()).catch(console.error);
            setSimulating(true);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            borderRadius: 9999,
            border: `1px solid ${isSimulating ? '#7f1d1d' : '#ef4444'}`,
            background: isSimulating ? '#1a0a0a' : 'transparent',
            color: isSimulating ? '#7f1d1d' : '#ef4444',
            fontSize: 11,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: isSimulating ? 'not-allowed' : 'pointer',
            animation: isSimulating ? 'none' : 'glow-pulse 1.5s ease-in-out infinite',
            opacity: isSimulating ? 0.6 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {isSimulating ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="6" cy="6" r="5" stroke="#7f1d1d" strokeWidth="1.5" fill="none" strokeDasharray="20 8" />
              </svg>
              Simulating...
            </>
          ) : (
            <>
              <Zap size={12} />
              Simulate Crisis
            </>
          )}
        </button>
      </div>
    </div>
  );
}

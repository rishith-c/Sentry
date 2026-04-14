'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const PIPELINES = [
  { id: 'firms', status: 'green' as const },
  { id: 'usgs', status: 'amber' as const },
  { id: 'weather', status: 'green' as const },
];

const NAV_ITEMS = ['INTEL', 'COMMS', 'MAPS', 'ASSETS'];

export default function TopBar() {
  const [sessionTime, setSessionTime] = useState('0m');
  const [utcTime, setUtcTime] = useState('');
  const [utcDate, setUtcDate] = useState('');
  const [activeNav, setActiveNav] = useState('INTEL');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const now = new Date();
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setSessionTime(h > 0 ? `${h}h ${m}m` : `${m}m`);
      setUtcTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT');
      const dateStr = now
        .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'America/Los_Angeles' })
        .toUpperCase().replace(/ /g, '-').replace(',', '');
      setUtcDate(dateStr);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const allGreen = PIPELINES.every(p => p.status === 'green');

  return (
    <header style={{
      display: 'flex', alignItems: 'center', height: 44, padding: '0 12px',
      background: '#000000', borderBottom: '1px solid #222222',
      flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{
          fontFamily: '"Fira Code", monospace', fontSize: 13, fontWeight: 700,
          letterSpacing: '0.18em', color: '#ffffff', textTransform: 'uppercase',
        }}>SENTINEL</span>

        <div style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 4px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: allGreen ? '#22c55e' : '#aaaaaa',
          }} />
          <span style={{
            fontFamily: '"Fira Code", monospace', fontSize: 9, fontWeight: 600,
            color: '#aaaaaa', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>{allGreen ? 'LIVE' : 'DEGRADED'}</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 4px' }} />

        <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555' }}>
          Session: {sessionTime}
        </span>

        <div style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 4px' }} />

        <Link href="/live" style={{
          fontFamily: '"Fira Code", monospace', fontSize: 9, fontWeight: 700,
          color: '#ef4444', letterSpacing: '0.08em', textDecoration: 'none',
          padding: '4px 10px', borderRadius: 4,
          border: '1px solid #ef444444', background: 'rgba(239,68,68,0.07)',
        }}>
          LIVE INTEL
        </Link>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 13, color: '#ffffff', letterSpacing: '0.06em', lineHeight: 1.2 }}>
            {utcTime}
          </span>
          <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555', lineHeight: 1.2 }}>
            {utcDate}
          </span>
        </div>
      </div>
    </header>
  );
}

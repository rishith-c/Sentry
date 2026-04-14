'use client';

import { AlertTriangle } from 'lucide-react';

export default function DisconnectionBanner({ show = false }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 16px', flexShrink: 0,
      background: '#7c2d12', borderBottom: '1px solid #c2410c',
    }}>
      <AlertTriangle size={13} color="#fb923c" />
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#fb923c',
      }}>Satellite feed disconnected — Reconnecting (attempt 3 of 10)</span>
    </div>
  );
}

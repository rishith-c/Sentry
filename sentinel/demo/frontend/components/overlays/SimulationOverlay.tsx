'use client';

export default function SimulationOverlay({ show = false }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 500,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        padding: '20px 32px', borderRadius: 8,
        background: 'rgba(5,5,7,0.85)',
        border: '1px solid #1e1e2a',
        backdropFilter: 'blur(4px)',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="3" fill="#ef4444" />
          <path d="M4 22L10 22L13 14L16 30L19 22L21 22L24 16L27 28L30 22L40 22" stroke="#ef4444" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="22" cy="22" r="9" stroke="#ef444444" strokeWidth="1.5" fill="none" style={{ animation: 'seismic-wave 3s ease-out infinite' }} />
          <circle cx="22" cy="22" r="16" stroke="#ef444422" strokeWidth="1" fill="none" style={{ animation: 'seismic-wave 3s ease-out 0.8s infinite' }} />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700,
            color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
          }}>Simulating Northridge 1994 — M6.7</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
            {[0, 100, 200].map(delay => (
              <span key={delay} style={{
                width: 5, height: 5, borderRadius: '50%', background: '#ef4444',
                display: 'inline-block',
                animation: `bounce 0.6s ease-in-out ${delay}ms infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

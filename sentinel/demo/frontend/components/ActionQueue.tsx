'use client';

import { useStore } from '@/store/useStore';
import ActionCard from './ActionCard';
import type { ActionType, TimeSensitivity } from '@/lib/types';


function formatTimeAgo(d: Date | string | undefined): string {
  if (!d) return 'just now';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function normalizeCard(raw: any): { id: string; actionType: ActionType; timeSensitivity: TimeSensitivity; confidence: number; resourceId: string; resourceLabel: string; zoneId: string; zoneThreatProbability: number; rationale: string; timeAgo: string } {
  const conf = raw.confidence ?? 0;
  const confidence100 = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  const actionType = (raw.actionType || raw.action_type || 'ALERT') as ActionType;
  const timeSensitivity: TimeSensitivity = confidence100 >= 88 ? 'IMMEDIATE' : confidence100 >= 78 ? 'HIGH' : 'MEDIUM';
  const rid = raw.resourceId || raw.resource_id || '';
  const resourceLabel = raw.resourceLabel || rid.replace(/^crew_0*(\d+)$/, 'Crew $1').replace('crew_', 'Crew ') || rid;
  const zoneId = raw.zoneId || raw.zone_id || '—';
  const zoneThreatProbability = raw.zoneThreatProbability ?? Math.round(confidence100 * 0.88);
  return {
    id: String(raw.id),
    actionType,
    timeSensitivity,
    confidence: confidence100,
    resourceId: rid,
    resourceLabel,
    zoneId,
    zoneThreatProbability,
    rationale: raw.rationale || '',
    timeAgo: formatTimeAgo(raw.createdAt || raw.created_at),
  };
}

export default function ActionQueue() {
  const storeCards = useStore(s => s.actionCards);
  const cards = storeCards
    .filter(c => (c as any).status === 'pending' || !(c as any).status)
    .map(normalizeCard);

  return (
    <aside style={{
      width: 320, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: '#000000', borderLeft: '1px solid #222222',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 40, flexShrink: 0,
        background: '#0a0a0a', borderBottom: '1px solid #222222',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, fontWeight: 700,
            color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>AI Recommendations</span>
          <span style={{
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, color: '#555555',
            border: '1px solid #2a2a2a', borderRadius: 9999, padding: '1px 7px', background: '#111111',
            fontWeight: 500,
          }}>Beta</span>
          <span style={{
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 3,
            background: '#1a1a1a', color: '#aaaaaa',
            border: '1px solid #333333',
            fontFamily: '"Fira Code", monospace', fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{cards.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8, background: '#000000' }}>
        {cards.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '32px 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth="1.5">
              <path d="M9 12h6M12 9v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round"/>
            </svg>
            <span style={{
              fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#333333',
              textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center',
            }}>No active recommendations</span>
            <span style={{
              fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, color: '#2a2a2a',
              textAlign: 'center', lineHeight: 1.5,
            }}>Run a simulation to generate AI-driven action cards</span>
          </div>
        ) : (
          cards.map((card, i) => <ActionCard key={`${card.id}-${i}`} {...card} />)
        )}
      </div>

      {/* Threat level */}
      <div style={{ flexShrink: 0, padding: '8px 12px', borderTop: '1px solid #222222', background: '#0a0a0a' }}>
        <span style={{
          fontFamily: '"Fira Code", monospace', fontSize: 8, color: '#555555',
          textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block',
        }}>SYSTEM THREAT LEVEL</span>
        <div style={{ position: 'relative', marginTop: 5 }}>
          <div style={{ height: 3, borderRadius: 2, background: 'linear-gradient(to right, #ffffff, #888888, #ef4444)' }} />
          <div style={{
            position: 'absolute', top: '50%', left: '75%',
            transform: 'translate(-50%, -50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.6)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 7, color: '#444444' }}>LOW</span>
          <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 7, color: '#444444' }}>EXTREMIS</span>
        </div>
      </div>
    </aside>
  );
}

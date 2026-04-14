'use client';

import { useState } from 'react';
import { patchActionCard, moveCrewToTarget } from '@/lib/api';

type ActionType = 'REPOSITION' | 'DISPATCH' | 'ALERT' | 'EVACUATE';
type TimeSensitivity = 'IMMEDIATE' | 'HIGH' | 'MEDIUM';

export interface ActionCardProps {
  id: string;
  actionType: ActionType;
  timeSensitivity: TimeSensitivity;
  confidence: number;
  resourceId: string;
  resourceLabel: string;
  zoneId: string;
  zoneThreatProbability: number;
  rationale: string;
  timeAgo: string;
  onApprove?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const PRIORITY_LABEL: Record<TimeSensitivity, string> = {
  IMMEDIATE: 'PRIORITY: 01',
  HIGH:      'PRIORITY: 02',
  MEDIUM:    'PRIORITY: 03',
};

export default function ActionCard({
  id, actionType, timeSensitivity, confidence, resourceId, resourceLabel,
  zoneId, zoneThreatProbability, rationale, timeAgo, onApprove, onDismiss,
}: ActionCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [approved, setApproved] = useState(false);

  if (dismissed || approved) return null;

  return (
    <div style={{
      background: '#111111',
      border: '1px solid #2a2a2a',
      borderRadius: 4,
      padding: '10px 12px',
      width: '100%',
      animation: 'slide-in-right 0.2s ease-out forwards',
    }}>
      {/* Priority */}
      <div style={{
        fontFamily: '"Fira Code", monospace', fontSize: 8,
        color: '#aaaaaa', letterSpacing: '0.1em',
        marginBottom: 4, textTransform: 'uppercase',
      }}>
        {PRIORITY_LABEL[timeSensitivity]}
      </div>

      {/* Type + sensitivity + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '2px 6px', borderRadius: 3,
            fontSize: 8, fontWeight: 700,
            fontFamily: '"Fira Code", monospace', letterSpacing: '0.1em', textTransform: 'uppercase',
            background: '#1a1a1a', color: '#aaaaaa', border: '1px solid #333333',
          }}>{actionType}</span>
          <span style={{
            fontSize: 9, fontWeight: 600,
            fontFamily: '"Fira Code", monospace', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: timeSensitivity === 'IMMEDIATE' ? '#ffffff' : '#aaaaaa',
          }}>{timeSensitivity}</span>
        </div>
        <span style={{ fontSize: 9, fontFamily: '"Fira Code", monospace', color: '#555555' }}>
          {timeAgo}
        </span>
      </div>

      {/* Confidence */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 8, fontFamily: '"Fira Code", monospace', color: '#555555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            CONFIDENCE
          </span>
          <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', color: '#ffffff', lineHeight: 1 }}>
            {confidence}%
          </span>
        </div>
        <div style={{ height: 2, background: '#2a2a2a', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${confidence}%`, background: '#ffffff', borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Resource / Zone */}
      <div style={{ marginBottom: 8, lineHeight: 1.6 }}>
        <div>
          <span style={{ fontSize: 9, fontFamily: '"Fira Code", monospace', color: '#555555' }}>Resource: </span>
          <span style={{ fontSize: 9, fontFamily: '"Fira Code", monospace', color: '#ffffff', fontWeight: 600 }}>{resourceLabel}</span>
        </div>
        <div>
          <span style={{ fontSize: 9, fontFamily: '"Fira Code", monospace', color: '#555555' }}>Zone: </span>
          <span style={{ fontSize: 9, fontFamily: '"Fira Code", monospace', color: '#ffffff' }}>{zoneId} </span>
          <span style={{ fontSize: 9, fontFamily: '"Fira Code", monospace', color: '#aaaaaa' }}>({zoneThreatProbability}% damage prob)</span>
        </div>
      </div>

      {/* Rationale */}
      <p style={{ fontFamily: '"Fira Sans", sans-serif', fontSize: 10, color: '#888888', lineHeight: 1.65, margin: '0 0 10px 0' }}>
        {rationale}
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <ApproveButton onClick={() => {
          const numId = parseInt(id, 10);
          if (!isNaN(numId)) patchActionCard(numId, 'approved').catch(console.error);
          if (resourceId) moveCrewToTarget(resourceId).catch(console.error);
          setApproved(true);
          onApprove?.(id);
        }} />
        <RejectButton onClick={() => {
          const numId = parseInt(id, 10);
          if (!isNaN(numId)) patchActionCard(numId, 'dismissed').catch(console.error);
          setDismissed(true);
          onDismiss?.(id);
        }} />
      </div>
    </div>
  );
}

function ApproveButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, height: 36, borderRadius: 3,
        fontSize: 10, fontWeight: 700,
        fontFamily: '"Fira Code", monospace', letterSpacing: '0.08em', textTransform: 'uppercase',
        background: hovered ? '#16a34a' : '#22c55e',
        color: '#000000', border: 'none',
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}
    >APPROVE</button>
  );
}

function RejectButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, height: 36, borderRadius: 3,
        fontSize: 10, fontWeight: 700,
        fontFamily: '"Fira Code", monospace', letterSpacing: '0.08em', textTransform: 'uppercase',
        background: hovered ? '#b91c1c' : '#ef4444',
        color: '#ffffff', border: 'none',
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}
    >REJECT</button>
  );
}

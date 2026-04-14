// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useMemo, useState } from 'react';
import { API_URL } from '@/lib/api';

interface MediaTriageResult {
  incident_labels: string[];
  priority: string;
  requires_human_review: boolean;
  image_classification: { top_label: string; confidence: number; scores: Array<{ label: string; score: number }> } | null;
  image_caption: string | null;
  transcript: string | null;
  transcript_labels: Array<{ label: string; score: number }>;
  operator_brief: string;
  civilian_response_text: string;
  civilian_response_audio: { mime_type: string; base64: string } | null;
  models_used: Record<string, string | null>;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ff4444',
  high: '#ffaa00',
  medium: '#aaaaaa',
  low: '#555555',
};

export default function CitizenIntakePanel() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MediaTriageResult | null>(null);

  const audioSrc = useMemo(() => {
    if (!result?.civilian_response_audio?.base64) return null;
    return `data:${result.civilian_response_audio.mime_type};base64,${result.civilian_response_audio.base64}`;
  }, [result]);

  async function submitTriage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      if (imageFile) form.append('image', imageFile);
      if (audioFile) form.append('audio', audioFile);
      if (note.trim()) form.append('note', note.trim());

      const response = await fetch(`${API_URL}/api/media/triage`, { method: 'POST', body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.detail ?? 'Media triage failed.');
      setResult(payload as MediaTriageResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Media triage failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={{ padding: '0 12px 8px' }}>
      <div style={{
        background: '#111111',
        border: '1px solid #222222',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            fontFamily: '"Fira Code", monospace',
            fontSize: 10,
            fontWeight: 600,
            color: '#ffaa00',
            letterSpacing: '0.12em',
          }}>
            CIVILIAN INTAKE AI
          </span>
          <span style={{
            fontFamily: '"Fira Code", monospace',
            fontSize: 9,
            color: '#555555',
          }}>
            Media triage
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12 }}>
          {/* Upload form */}
          <form onSubmit={submitTriage} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                border: `1px dashed ${imageFile ? '#4a9eff' : '#2a2a2a'}`,
                borderRadius: 4,
                cursor: 'pointer',
                background: imageFile ? 'rgba(74,158,255,0.05)' : 'transparent',
              }}>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#aaaaaa', marginBottom: 4 }}>
                  {imageFile ? imageFile.name : 'Drop image'}
                </span>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 8, color: '#555555' }}>
                  JPG, PNG, WEBP
                </span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </label>

              <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                border: `1px dashed ${audioFile ? '#4a9eff' : '#2a2a2a'}`,
                borderRadius: 4,
                cursor: 'pointer',
                background: audioFile ? 'rgba(74,158,255,0.05)' : 'transparent',
              }}>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#aaaaaa', marginBottom: 4 }}>
                  {audioFile ? audioFile.name : 'Drop audio'}
                </span>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 8, color: '#555555' }}>
                  MP3, WAV, M4A
                </span>
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Caller note, location, or context..."
              style={{
                fontFamily: '"Fira Sans", sans-serif',
                fontSize: 12,
                color: '#aaaaaa',
                background: '#0a0a0a',
                border: '1px solid #2a2a2a',
                borderRadius: 4,
                padding: '8px 10px',
                minHeight: 60,
                resize: 'vertical',
                outline: 'none',
              }}
            />

            <button
              type="submit"
              disabled={pending}
              style={{
                fontFamily: '"Fira Code", monospace',
                fontSize: 10,
                fontWeight: 700,
                color: '#ffffff',
                background: pending ? '#333333' : '#4a9eff',
                border: 'none',
                borderRadius: 4,
                padding: '8px 16px',
                cursor: pending ? 'default' : 'pointer',
              }}
            >
              {pending ? 'ANALYZING...' : 'RUN AI TRIAGE'}
            </button>

            {error && (
              <div style={{ fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#ff4444' }}>{error}</div>
            )}
          </form>

          {/* Results */}
          <div style={{ minWidth: 0 }}>
            {!result ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontFamily: '"Fira Code", monospace',
                fontSize: 10,
                color: '#333333',
              }}>
                No triage result yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Priority + labels */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontFamily: '"Fira Code", monospace',
                    fontSize: 9,
                    fontWeight: 700,
                    color: PRIORITY_COLORS[result.priority] ?? '#aaaaaa',
                    border: `1px solid ${(PRIORITY_COLORS[result.priority] ?? '#aaaaaa')}33`,
                    borderRadius: 3,
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                  }}>
                    {result.priority}
                  </span>
                  {result.incident_labels.map((label) => (
                    <span key={label} style={{
                      fontFamily: '"Fira Code", monospace',
                      fontSize: 8,
                      color: '#aaaaaa',
                      border: '1px solid #2a2a2a',
                      borderRadius: 3,
                      padding: '2px 5px',
                    }}>
                      {label}
                    </span>
                  ))}
                </div>

                {/* Brief */}
                <div>
                  <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555', letterSpacing: '0.08em' }}>OPERATOR BRIEF</span>
                  <p style={{ fontFamily: '"Fira Sans", sans-serif', fontSize: 11, color: '#aaaaaa', lineHeight: 1.5, marginTop: 4 }}>
                    {result.operator_brief}
                  </p>
                </div>

                {/* Transcript */}
                {result.transcript && (
                  <div>
                    <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555', letterSpacing: '0.08em' }}>TRANSCRIPT</span>
                    <p style={{ fontFamily: '"Fira Sans", sans-serif', fontSize: 11, color: '#888888', lineHeight: 1.5, marginTop: 4 }}>
                      {result.transcript}
                    </p>
                  </div>
                )}

                {/* Audio */}
                {audioSrc && (
                  <div>
                    <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555', letterSpacing: '0.08em' }}>RESPONSE AUDIO</span>
                    <audio controls src={audioSrc} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                )}

                {/* Civilian response */}
                <div>
                  <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555', letterSpacing: '0.08em' }}>CIVILIAN RESPONSE</span>
                  <p style={{ fontFamily: '"Fira Sans", sans-serif', fontSize: 11, color: '#aaaaaa', lineHeight: 1.5, marginTop: 4 }}>
                    {result.civilian_response_text}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

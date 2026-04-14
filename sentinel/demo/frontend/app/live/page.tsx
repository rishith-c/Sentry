'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface Hotspot {
  id: number;
  lat: number;
  lng: number;
  frp: number;
  confidence: string;
  detected_at: string;
}

interface SeismicEvent {
  id: string | number;
  magnitude: number;
  depth: number;
  lat: number;
  lng: number;
  place: string;
  detected_at: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Los_Angeles' });
}

function cleanPlace(place: string): string {
  // "13 km NW of Parkfield, CA" -> "Parkfield, CA"
  // "off the coast of Washington" -> "Washington"
  const ofMatch = place.match(/of\s+(.+)/);
  return ofMatch ? ofMatch[1] : place;
}

export default function LiveDashboard() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [quakes, setQuakes] = useState<SeismicEvent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function fetchData() {
    try {
      // Real fire hotspots from NASA FIRMS (last 24h, worldwide)
      const firmsRes = await fetch('https://firms.modaps.eosdis.nasa.gov/api/area/csv/ea7c6aebe253712abf282d07cdad38aa/VIIRS_SNPP_NRT/world/1');
      if (firmsRes.ok) {
        const csv = await firmsRes.text();
        const lines = csv.trim().split('\n');
        const fires: Hotspot[] = lines.slice(1, 201).map((line, i) => {
          const cols = line.split(',');
          return {
            id: i + 1,
            lat: parseFloat(cols[0]),
            lng: parseFloat(cols[1]),
            frp: parseFloat(cols[12]) || 0,
            confidence: cols[9] === 'h' ? 'high' : cols[9] === 'l' ? 'low' : 'nominal',
            detected_at: `${cols[5]}T${String(cols[6]).padStart(4, '0').slice(0,2)}:${String(cols[6]).padStart(4, '0').slice(2)}:00Z`,
          };
        });
        setHotspots(fires);
      }

      // Real earthquakes from USGS (last hour, M1+)
      const usgsRes = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
      if (usgsRes.ok) {
        const geo = await usgsRes.json();
        const events: SeismicEvent[] = (geo.features || []).map((f: any) => ({
          id: f.id,
          magnitude: f.properties.mag ?? 0,
          depth: f.geometry.coordinates[2] ?? 0,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          place: f.properties.place ?? '',
          detected_at: new Date(f.properties.time).toISOString(),
        }));
        setQuakes(events);
      }

      setLastRefresh(new Date());
    } catch {}
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const highConfidence = hotspots.filter(h => h.confidence === 'high');

  return (
    <div style={{
      minHeight: '100vh', background: '#000000', color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52, borderBottom: '1px solid #222222',
        background: '#0a0a0a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{
            fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#475569',
            textDecoration: 'none',
          }}>
            ← COMMAND VIEW
          </Link>
          <span style={{ color: '#222222' }}>|</span>
          <span style={{
            fontFamily: '"Fira Code", monospace', fontSize: 13, fontWeight: 700,
            color: '#ffffff', letterSpacing: '0.08em',
          }}>
            LIVE INTELLIGENCE DASHBOARD
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569',
          }}>
            Auto-refresh 30s
          </span>
          <span suppressHydrationWarning style={{
            fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#334155',
          }}>
            Last: {lastRefresh.toLocaleTimeString('en-US', { hour12: false })}
          </span>
          <button onClick={fetchData} style={{
            padding: '4px 12px', borderRadius: 4,
            border: '1px solid #333333', background: '#111111',
            color: '#aaaaaa', fontSize: 10, fontFamily: '"Fira Code", monospace',
            cursor: 'pointer', fontWeight: 600,
          }}>
            REFRESH
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: 16, padding: '24px 24px 0' }}>
        <div style={{
          flex: 1, background: '#111111', border: '1px solid #2a2a2a',
          borderRadius: 6, padding: '20px 24px',
        }}>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            TOTAL HOTSPOTS
          </div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: '#ef4444', lineHeight: 1,
          }}>
            {hotspots.length}
          </div>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569',
            marginTop: 8,
          }}>
            All detected fire ignition points
          </div>
        </div>

        <div style={{
          flex: 1, background: '#111111', border: '1px solid #2a2a2a',
          borderRadius: 6, padding: '20px 24px',
        }}>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            HIGH CONFIDENCE
          </div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: '#f97316', lineHeight: 1,
          }}>
            {highConfidence.length}
          </div>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569',
            marginTop: 8,
          }}>
            FRP confirmed &gt; 400 MW threshold
          </div>
        </div>

        <div style={{
          flex: 1, background: '#111111', border: '1px solid #2a2a2a',
          borderRadius: 6, padding: '20px 24px',
        }}>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            AVG FRP
          </div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: '#f59e0b', lineHeight: 1,
          }}>
            {hotspots.length > 0 ? Math.round(hotspots.reduce((s, h) => s + h.frp, 0) / hotspots.length) : 0}
            <span style={{ fontSize: 14, color: '#666666', marginLeft: 4 }}>MW</span>
          </div>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569',
            marginTop: 8,
          }}>
            Mean fire radiative power
          </div>
        </div>

        <div style={{
          flex: 1, background: '#111111', border: '1px solid #2a2a2a',
          borderRadius: 6, padding: '20px 24px',
        }}>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 9, color: '#555555',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            SEISMIC EVENTS
          </div>
          <div style={{
            fontSize: 36, fontWeight: 700, color: '#38bdf8', lineHeight: 1,
          }}>
            {quakes.length}
          </div>
          <div style={{
            fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569',
            marginTop: 8,
          }}>
            Max M{quakes.length > 0 ? Math.max(...quakes.map(q => q.magnitude)).toFixed(1) : '0.0'}
          </div>
        </div>
      </div>

      {/* Side-by-side tables */}
      <div style={{ display: 'flex', gap: 16, padding: '20px 24px', flex: 1, minHeight: 0 }}>
        {/* Fire Hotspots */}
        <div style={{
          flex: 1, background: '#0a0a0a', border: '1px solid #222222', borderRadius: 6,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderBottom: '1px solid #222222',
            background: '#111111',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{
              fontFamily: '"Fira Code", monospace', fontSize: 11, fontWeight: 700,
              color: '#ef4444', letterSpacing: '0.08em',
            }}>FIRE HOTSPOTS</span>
            <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569' }}>({hotspots.length})</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '50px 80px 90px 80px 80px 1fr',
            padding: '8px 16px', borderBottom: '1px solid #1a1a1a',
          }}>
            {['ID', 'LAT', 'LNG', 'FRP', 'CONF', 'TIME'].map(h => (
              <span key={h} style={{
                fontFamily: '"Fira Code", monospace', fontSize: 8, fontWeight: 700,
                color: '#555555', letterSpacing: '0.1em',
              }}>{h}</span>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {hotspots.map((h, i) => (
              <div key={h.id} style={{
                display: 'grid', gridTemplateColumns: '50px 80px 90px 80px 80px 1fr',
                padding: '6px 16px',
                borderBottom: '1px solid #1a1a1a',
                background: i % 2 === 0 ? 'transparent' : '#080808',
              }}>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#666666' }}>{h.id}</span>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#e2e8f0' }}>{h.lat.toFixed(3)}</span>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#e2e8f0' }}>{h.lng.toFixed(3)}</span>
                <span style={{
                  fontFamily: '"Fira Code", monospace', fontSize: 11, fontWeight: 600,
                  color: h.frp > 400 ? '#ef4444' : h.frp > 200 ? '#f97316' : '#f59e0b',
                }}>{h.frp}</span>
                <span style={{
                  fontFamily: '"Fira Code", monospace', fontSize: 10, fontWeight: 600,
                  color: h.confidence === 'high' ? '#22c55e' : '#f59e0b',
                  textTransform: 'uppercase',
                }}>{h.confidence}</span>
                <span suppressHydrationWarning style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#475569' }}>{formatTime(h.detected_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seismic Events */}
        <div style={{
          flex: 1, background: '#0a0a0a', border: '1px solid #222222', borderRadius: 6,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderBottom: '1px solid #222222',
            background: '#111111',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
            <span style={{
              fontFamily: '"Fira Code", monospace', fontSize: 11, fontWeight: 700,
              color: '#38bdf8', letterSpacing: '0.08em',
            }}>SEISMIC EVENTS</span>
            <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#475569' }}>({quakes.length})</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '70px 70px 70px 1fr 90px',
            padding: '8px 16px', borderBottom: '1px solid #1a1a1a',
          }}>
            {['ID', 'MAG', 'DEPTH', 'LOCATION', 'TIME'].map(h => (
              <span key={h} style={{
                fontFamily: '"Fira Code", monospace', fontSize: 8, fontWeight: 700,
                color: '#555555', letterSpacing: '0.1em',
              }}>{h}</span>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {quakes.map((q, i) => (
              <div key={q.id} style={{
                display: 'grid', gridTemplateColumns: '70px 70px 70px 1fr 90px',
                padding: '6px 16px',
                borderBottom: '1px solid #1a1a1a',
                background: i % 2 === 0 ? 'transparent' : '#080808',
              }}>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 10, color: '#666666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(q.id).slice(-8)}</span>
                <span style={{
                  fontFamily: '"Fira Code", monospace', fontSize: 11, fontWeight: 700,
                  color: q.magnitude >= 6 ? '#ef4444' : q.magnitude >= 4 ? '#f97316' : '#f59e0b',
                }}>M{q.magnitude.toFixed(1)}</span>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#e2e8f0' }}>{Math.round(q.depth)}km</span>
                <span style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.place}>{cleanPlace(q.place)}</span>
                <span suppressHydrationWarning style={{ fontFamily: '"Fira Code", monospace', fontSize: 11, color: '#475569' }}>{formatTime(q.detected_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

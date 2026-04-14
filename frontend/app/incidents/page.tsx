// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type IncidentType = 'Seismic' | 'Wildfire' | 'Multi-Hazard';
type SeverityLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Extreme';

interface IncidentMetrics {
  areasAffected: number;
  crewsDeployed: number;
  responseTimeMinutes: number;
  damageAssessment: string;
  populationAffected: number;
  infrastructureDamaged: number;
}

interface Incident {
  id: string;
  title: string;
  type: IncidentType;
  severity: SeverityLevel;
  date: string;
  endDate: string;
  summary: string;
  location: string;
  metrics: IncidentMetrics;
  timeline: { time: string; event: string }[];
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-2024-001',
    title: '1994 Northridge Earthquake Simulation',
    type: 'Seismic',
    severity: 'Extreme',
    date: '2024-01-17',
    endDate: '2024-01-24',
    summary:
      'Full simulation of the M6.7 Northridge earthquake event. The AIP agent detected P-wave arrival at 04:30:55 PT and issued IMMEDIATE shelter-in-place directives within 8 seconds. Ground damage probability exceeded 85% in 4 zones within the San Fernando Valley, triggering automated crew repositioning.',
    location: 'Northridge, San Fernando Valley, CA',
    metrics: {
      areasAffected: 12,
      crewsDeployed: 5,
      responseTimeMinutes: 4,
      damageAssessment: 'Severe structural damage across 4 primary zones. Liquefaction detected in 2 sub-regions. 3 hospitals at elevated alert.',
      populationAffected: 84200,
      infrastructureDamaged: 47,
    },
    timeline: [
      { time: '04:30:55', event: 'P-wave detected by USGS feed — M6.7 at 34.213N, 118.537W, depth 18.4km' },
      { time: '04:31:03', event: 'AIP agent issued IMMEDIATE shelter-in-place for zones Z-01 through Z-04' },
      { time: '04:31:18', event: 'Seismic CNN processed waveform — confirmed M6.7 classification' },
      { time: '04:31:45', event: 'Damage model computed: 4 zones above 85% probability threshold' },
      { time: '04:32:10', event: 'Crew 1 and Crew 3 repositioned to high-priority damage zones' },
      { time: '04:33:00', event: 'Hospital alert level escalated: Providence St. Joseph to CRITICAL' },
      { time: '04:35:00', event: 'Evacuation routes Z-02 to S-01 marked as congested' },
      { time: '04:42:00', event: 'All 5 crews deployed and en route to assigned sectors' },
    ],
  },
  {
    id: 'INC-2024-002',
    title: 'San Fernando Valley Wildfire Outbreak',
    type: 'Wildfire',
    severity: 'Critical',
    date: '2024-02-03',
    endDate: '2024-02-05',
    summary:
      'FIRMS satellite feed detected 23 high-confidence thermal anomalies across the western San Fernando Valley within a 90-minute window. Ember simulation projected spread vectors toward residential areas near Chatsworth and Woodland Hills. AIP agent issued evacuation advisories for 3 zones.',
    location: 'Chatsworth / Woodland Hills, CA',
    metrics: {
      areasAffected: 6,
      crewsDeployed: 4,
      responseTimeMinutes: 7,
      damageAssessment: 'Moderate wildfire spread contained within 48 hours. 2 shelters activated. No critical infrastructure loss.',
      populationAffected: 31500,
      infrastructureDamaged: 12,
    },
    timeline: [
      { time: '14:12:00', event: 'FIRMS feed: 8 new high-confidence hotspots detected near Chatsworth' },
      { time: '14:15:30', event: 'Ember simulation projected NE spread vector — 65% probability to residential zone' },
      { time: '14:18:00', event: 'AIP agent issued ADVISORY for zones Z-05, Z-06, Z-07' },
      { time: '14:22:00', event: 'Crew 5 dispatched to Woodland Hills staging area' },
      { time: '14:45:00', event: 'FIRMS update: 15 additional hotspots confirmed — upgraded to CRITICAL' },
      { time: '15:10:00', event: 'Chatsworth Park shelter activated — initial capacity 200' },
      { time: '18:00:00', event: 'Fire line established along Devonshire corridor' },
    ],
  },
  {
    id: 'INC-2024-003',
    title: 'Multi-Hazard: Earthquake Aftershock + Secondary Fires',
    type: 'Multi-Hazard',
    severity: 'High',
    date: '2024-03-11',
    endDate: '2024-03-12',
    summary:
      'A M4.2 aftershock in the Northridge region ruptured a gas main near Reseda Blvd, triggering secondary fire ignition. The platform detected both the seismic event and the subsequent thermal anomaly within 3 minutes, demonstrating multi-hazard correlation capabilities.',
    location: 'Reseda, San Fernando Valley, CA',
    metrics: {
      areasAffected: 3,
      crewsDeployed: 3,
      responseTimeMinutes: 5,
      damageAssessment: 'Localized gas main rupture caused secondary fire. Contained within 6 hours. Minor structural damage to 8 buildings.',
      populationAffected: 12800,
      infrastructureDamaged: 9,
    },
    timeline: [
      { time: '22:14:30', event: 'USGS feed: M4.2 aftershock detected at 34.201N, 118.536W, depth 9km' },
      { time: '22:15:10', event: 'Seismic CNN classified as aftershock — low structural risk' },
      { time: '22:17:45', event: 'FIRMS hotspot detected at 34.198N, 118.534W — gas main rupture confirmed' },
      { time: '22:18:00', event: 'AIP agent correlated seismic + fire events — upgraded to MULTI-HAZARD' },
      { time: '22:20:00', event: 'Crew 1, Crew 2 dispatched — dual fire/rescue configuration' },
      { time: '22:35:00', event: 'Gas utility notified and shutoff valve activated remotely' },
      { time: '23:00:00', event: 'Fire contained — monitoring phase initiated' },
    ],
  },
  {
    id: 'INC-2024-004',
    title: 'Moderate Seismic Activity Cluster',
    type: 'Seismic',
    severity: 'Moderate',
    date: '2024-03-28',
    endDate: '2024-03-28',
    summary:
      'A cluster of 6 seismic events (M2.1 to M3.4) detected over 4 hours in the northern San Fernando Valley. The platform maintained elevated monitoring status and pre-positioned crews at key intersections. No damage thresholds were exceeded, but the cluster pattern triggered an advisory.',
    location: 'Granada Hills / Sylmar, CA',
    metrics: {
      areasAffected: 2,
      crewsDeployed: 2,
      responseTimeMinutes: 12,
      damageAssessment: 'No significant damage. Advisory issued as precautionary measure. All infrastructure checked and cleared.',
      populationAffected: 5600,
      infrastructureDamaged: 0,
    },
    timeline: [
      { time: '08:42:00', event: 'USGS: M2.1 detected near Granada Hills — shallow focus' },
      { time: '09:15:00', event: 'USGS: M2.8 detected — same fault segment' },
      { time: '09:45:00', event: 'AIP agent flagged cluster pattern — advisory issued' },
      { time: '10:30:00', event: 'Crew 2, Crew 4 pre-positioned at key intersections' },
      { time: '11:10:00', event: 'USGS: M3.4 — largest in cluster. Damage model: below threshold' },
      { time: '12:45:00', event: 'Cluster activity subsided — advisory downgraded to NOMINAL' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function severityColor(severity: SeverityLevel): string {
  switch (severity) {
    case 'Low':
      return 'text-threat-green';
    case 'Moderate':
      return 'text-threat-amber';
    case 'High':
      return 'text-threat-orange';
    case 'Critical':
      return 'text-threat-red';
    case 'Extreme':
      return 'text-threat-purple';
  }
}

function severityBgColor(severity: SeverityLevel): string {
  switch (severity) {
    case 'Low':
      return 'bg-threat-green/10 border-threat-green/20';
    case 'Moderate':
      return 'bg-threat-amber/10 border-threat-amber/20';
    case 'High':
      return 'bg-threat-orange/10 border-threat-orange/20';
    case 'Critical':
      return 'bg-threat-red/10 border-threat-red/20';
    case 'Extreme':
      return 'bg-threat-purple/10 border-threat-purple/20';
  }
}

function typeBadgeVariant(type: IncidentType): 'default' | 'warning' | 'destructive' {
  switch (type) {
    case 'Seismic':
      return 'default';
    case 'Wildfire':
      return 'warning';
    case 'Multi-Hazard':
      return 'destructive';
  }
}

function formatIncidentDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IncidentsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const filtered = useMemo(() => {
    return MOCK_INCIDENTS.filter((inc) => {
      if (typeFilter !== 'all' && inc.type !== typeFilter) return false;
      if (severityFilter && inc.severity.toLowerCase() !== severityFilter.toLowerCase()) return false;
      if (dateFrom && inc.date < dateFrom) return false;
      if (dateTo && inc.date > dateTo) return false;
      return true;
    });
  }, [typeFilter, severityFilter, dateFrom, dateTo]);

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <TopBar />

      {/* Sub-header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border/60">
        <Link
          href="/live"
          className="font-data text-[10px] font-semibold text-text-muted border border-border rounded px-3 py-1.5 hover:bg-surface transition-colors tracking-wider"
        >
          &larr; LIVE DASHBOARD
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <div>
          <h1 className="font-brand text-xl font-extrabold tracking-widest text-text-primary uppercase">
            Incident History
          </h1>
          <p className="font-ui text-xs text-text-muted mt-0.5">
            Post-event analysis and timeline
          </p>
        </div>
        <div className="flex-1" />
        <Link
          href="/analytics"
          className="font-ui text-sm text-accent hover:text-accent/80 transition-colors"
        >
          Analytics &rarr;
        </Link>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Filters */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-threat-red" />
            <h2 className="font-ui text-sm font-semibold text-text-primary uppercase tracking-wider">
              Filters
            </h2>
          </div>

          {/* Type tabs */}
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList>
              <TabsTrigger value="all">All Types</TabsTrigger>
              <TabsTrigger value="Seismic">Seismic</TabsTrigger>
              <TabsTrigger value="Wildfire">Wildfire</TabsTrigger>
              <TabsTrigger value="Multi-Hazard">Multi-Hazard</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Additional filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="font-ui text-[10px] text-text-muted uppercase tracking-wider">
                Severity
              </label>
              <Input
                placeholder="e.g. Critical"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-36 h-9 text-sm rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-ui text-[10px] text-text-muted uppercase tracking-wider">
                From
              </label>
              <Input
                placeholder="YYYY-MM-DD"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36 h-9 text-sm rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-ui text-[10px] text-text-muted uppercase tracking-wider">
                To
              </label>
              <Input
                placeholder="YYYY-MM-DD"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36 h-9 text-sm rounded-lg"
              />
            </div>
            {(severityFilter || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="font-ui text-xs text-threat-red hover:text-threat-red/80 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>

          <p className="font-ui text-xs text-text-muted">
            Showing {filtered.length} of {MOCK_INCIDENTS.length} incidents
          </p>
        </section>

        <Separator />

        {/* Incident list */}
        <section>
          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="space-y-4 pr-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <svg
                    className="w-12 h-12 text-text-muted/30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <p className="font-ui text-sm text-text-muted">
                    No incidents match the current filters.
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible>
                  {filtered.map((incident) => (
                    <AccordionItem key={incident.id} value={incident.id}>
                      <Card className="mb-3 overflow-hidden">
                        <AccordionTrigger className="px-5 py-0 hover:no-underline">
                          <div className="flex items-start gap-4 py-4 w-full pr-4">
                            {/* Severity stripe */}
                            <div
                              className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                                incident.severity === 'Extreme'
                                  ? 'bg-threat-purple'
                                  : incident.severity === 'Critical'
                                  ? 'bg-threat-red'
                                  : incident.severity === 'High'
                                  ? 'bg-threat-orange'
                                  : incident.severity === 'Moderate'
                                  ? 'bg-threat-amber'
                                  : 'bg-threat-green'
                              }`}
                            />

                            <div className="flex-1 text-left space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge variant={typeBadgeVariant(incident.type)}>
                                  {incident.type}
                                </Badge>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityBgColor(
                                    incident.severity
                                  )} ${severityColor(incident.severity)}`}
                                >
                                  {incident.severity}
                                </span>
                                <span className="font-data text-[10px] text-text-muted">
                                  {incident.id}
                                </span>
                              </div>

                              <h3 className="font-ui text-base font-semibold text-text-primary">
                                {incident.title}
                              </h3>

                              <div className="flex items-center gap-4 text-xs">
                                <span className="font-data text-text-muted">
                                  {formatIncidentDate(incident.date)}
                                  {' \u2014 '}
                                  {formatIncidentDate(incident.endDate)}
                                </span>
                                <span className="font-ui text-text-muted">
                                  {incident.location}
                                </span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent>
                          <CardContent className="pt-0 pb-5 space-y-5">
                            {/* Summary */}
                            <div className="bg-surface/50 rounded-xl p-4 border border-border/40">
                              <p className="font-ui text-sm text-text-primary/90 leading-relaxed">
                                {incident.summary}
                              </p>
                            </div>

                            {/* Metrics grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                              {[
                                {
                                  label: 'Areas Affected',
                                  value: incident.metrics.areasAffected,
                                  color: 'text-threat-orange',
                                },
                                {
                                  label: 'Crews Deployed',
                                  value: incident.metrics.crewsDeployed,
                                  color: 'text-threat-green',
                                },
                                {
                                  label: 'Response Time',
                                  value: `${incident.metrics.responseTimeMinutes}m`,
                                  color: 'text-accent',
                                },
                                {
                                  label: 'Population',
                                  value: incident.metrics.populationAffected.toLocaleString(),
                                  color: 'text-text-data',
                                },
                                {
                                  label: 'Infrastructure',
                                  value: incident.metrics.infrastructureDamaged,
                                  color: 'text-threat-amber',
                                },
                                {
                                  label: 'Duration',
                                  value: `${
                                    Math.ceil(
                                      (new Date(incident.endDate).getTime() -
                                        new Date(incident.date).getTime()) /
                                        86400000
                                    )
                                  }d`,
                                  color: 'text-threat-purple',
                                },
                              ].map((metric) => (
                                <div
                                  key={metric.label}
                                  className="bg-bg/50 rounded-lg p-3 border border-border/30"
                                >
                                  <p className={`font-data text-xl font-bold ${metric.color}`}>
                                    {metric.value}
                                  </p>
                                  <p className="font-ui text-[10px] text-text-muted uppercase tracking-wider mt-1">
                                    {metric.label}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Damage assessment */}
                            <div>
                              <h4 className="font-ui text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                                Damage Assessment
                              </h4>
                              <p className="font-ui text-sm text-text-primary/80 leading-relaxed">
                                {incident.metrics.damageAssessment}
                              </p>
                            </div>

                            {/* Event timeline */}
                            <div>
                              <h4 className="font-ui text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                                Event Timeline
                              </h4>
                              <div className="relative pl-6 space-y-0">
                                {/* Vertical line */}
                                <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/60" />

                                {incident.timeline.map((entry, idx) => (
                                  <div key={idx} className="relative flex items-start gap-3 py-2">
                                    {/* Dot */}
                                    <div
                                      className={`absolute left-[-15px] top-3 w-2.5 h-2.5 rounded-full border-2 border-bg ${
                                        idx === 0
                                          ? 'bg-threat-red'
                                          : idx === incident.timeline.length - 1
                                          ? 'bg-threat-green'
                                          : 'bg-accent'
                                      }`}
                                    />
                                    <span className="font-data text-[11px] text-text-muted w-16 flex-shrink-0 pt-0.5">
                                      {entry.time}
                                    </span>
                                    <p className="font-ui text-sm text-text-primary/80">
                                      {entry.event}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </AccordionContent>
                      </Card>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}

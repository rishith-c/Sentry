// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { CrewStatus, AlertLevel } from '@/lib/types';

const CREW_STATUS_STYLES: Record<CrewStatus, { label: string; variant: 'success' | 'warning' | 'default' | 'outline' }> = {
  active: { label: 'ACTIVE', variant: 'success' },
  en_route: { label: 'EN ROUTE', variant: 'warning' },
  standby: { label: 'STANDBY', variant: 'outline' },
  returning: { label: 'RETURNING', variant: 'default' },
};

const ALERT_LEVEL_STYLES: Record<AlertLevel, { variant: 'success' | 'warning' | 'destructive' }> = {
  normal: { variant: 'success' },
  elevated: { variant: 'warning' },
  critical: { variant: 'destructive' },
};

function getCapacityColor(ratio: number): string {
  if (ratio < 0.6) return 'bg-threat-green';
  if (ratio < 0.85) return 'bg-threat-amber';
  return 'bg-threat-red';
}

export default function CommandOverview() {
  const crews = useStore((s) => s.crews);
  const shelters = useStore((s) => s.shelters);
  const hospitals = useStore((s) => s.hospitals);

  const sortedCrews = useMemo(
    () => [...crews].sort((a, b) => {
      const statusOrder: Record<CrewStatus, number> = { active: 0, en_route: 1, returning: 2, standby: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    }),
    [crews]
  );

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto">
      {/* Crews section */}
      <section>
        <h2 className="font-ui text-xs font-semibold tracking-wider text-text-muted uppercase mb-3">
          Crew Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedCrews.map((crew) => {
            const statusConfig = CREW_STATUS_STYLES[crew.status];
            return (
              <Card key={crew.id} className="bg-surface border-border rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-ui text-sm font-semibold text-text-primary">
                      {crew.label}
                    </span>
                    <Badge variant={statusConfig.variant} className="font-data text-[9px] px-1.5 py-0">
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-data text-lg text-text-data">
                      {crew.personnel}
                    </span>
                    <span className="font-ui text-[10px] text-text-muted">
                      personnel
                    </span>
                  </div>
                  {crew.assignedZoneId && (
                    <span className="font-data text-[10px] text-text-muted/60 mt-1 block">
                      Zone: {crew.assignedZoneId}
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Shelters section */}
      <section>
        <h2 className="font-ui text-xs font-semibold tracking-wider text-text-muted uppercase mb-3">
          Shelters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {shelters.map((shelter) => {
            const occupancy = shelter.currentOccupancy ?? shelter.occupancy ?? 0;
            const capacity = shelter.totalCapacity ?? shelter.capacity ?? 1;
            const ratio = capacity > 0 ? occupancy / capacity : 0;

            return (
              <Card key={shelter.id} className="bg-surface border-border rounded-lg">
                <CardContent className="p-3 space-y-2">
                  <span className="font-ui text-sm font-semibold text-text-primary block">
                    {shelter.name}
                  </span>
                  <Progress
                    value={ratio * 100}
                    className="h-1.5"
                    indicatorClassName={getCapacityColor(ratio)}
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-data text-xs text-text-data">
                      {occupancy}/{capacity}
                    </span>
                    <span className="font-ui text-[10px] text-text-muted">
                      {Math.round(ratio * 100)}% full
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Hospitals section */}
      <section>
        <h2 className="font-ui text-xs font-semibold tracking-wider text-text-muted uppercase mb-3">
          Hospitals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {hospitals.map((hospital) => {
            const alertConfig = ALERT_LEVEL_STYLES[hospital.alertLevel];
            const displayCapacity = hospital.remainingCapacity ?? hospital.currentCapacity ?? 0;

            return (
              <Card key={hospital.id} className="bg-surface border-border rounded-lg">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-ui text-sm font-semibold text-text-primary truncate mr-2">
                      {hospital.name}
                    </span>
                    <Badge variant={alertConfig.variant} className="font-data text-[9px] px-1.5 py-0 shrink-0">
                      {hospital.alertLevel.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-data text-lg text-text-data">
                      {displayCapacity}
                    </span>
                    <span className="font-ui text-[10px] text-text-muted">
                      capacity remaining
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

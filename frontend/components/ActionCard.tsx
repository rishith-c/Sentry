// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { approveAction, dismissAction } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ActionCard as ActionCardType, TimeSensitivity } from '@/lib/types';

interface ActionCardProps {
  card: ActionCardType;
}

const SENSITIVITY_STYLES: Record<TimeSensitivity, string> = {
  IMMEDIATE: 'border-threat-red/30 bg-threat-red/10 text-threat-red',
  HIGH: 'border-threat-orange/30 bg-threat-orange/10 text-threat-orange',
  MEDIUM: 'border-threat-amber/30 bg-threat-amber/10 text-threat-amber',
  ROUTINE: 'border-border bg-surface text-text-muted',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'bg-threat-green';
  if (confidence >= 60) return 'bg-threat-amber';
  if (confidence >= 40) return 'bg-threat-orange';
  return 'bg-threat-red';
}

export default function ActionCard({ card }: ActionCardProps) {
  const approve = useStore((s) => s.approveAction);
  const dismiss = useStore((s) => s.dismissAction);

  const isResolved = card.status === 'approved' || card.status === 'dismissed';

  const handleApprove = useCallback(async () => {
    approve(card.id);
    try {
      await approveAction(Number(card.id));
    } catch {
      // non-fatal: optimistic update already applied
    }
  }, [approve, card.id]);

  const handleDismiss = useCallback(async () => {
    dismiss(card.id);
    try {
      await dismissAction(Number(card.id));
    } catch {
      // non-fatal: optimistic update already applied
    }
  }, [dismiss, card.id]);

  return (
    <Card
      className={cn(
        'bg-surface border-border rounded-lg transition-opacity',
        isResolved && 'opacity-50'
      )}
    >
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              'font-data text-[10px] px-2 py-0.5 rounded',
              SENSITIVITY_STYLES[card.timeSensitivity]
            )}
          >
            {card.actionType}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'font-data text-[9px] px-1.5 py-0.5 rounded',
              SENSITIVITY_STYLES[card.timeSensitivity]
            )}
          >
            {card.timeSensitivity}
          </Badge>
          <span className="font-data text-xs text-text-muted ml-auto">
            {card.confidence}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-2">
        <p className="font-ui text-sm text-text-data leading-relaxed line-clamp-2">
          {card.rationale}
        </p>

        <div className="space-y-1">
          <Progress
            value={card.confidence}
            className="h-1.5"
            indicatorClassName={getConfidenceColor(card.confidence)}
          />
        </div>

        {(card.resourceLabel ?? card.resourceId) && (
          <div className="flex items-center gap-2">
            <span className="font-data text-[10px] text-text-muted">
              {card.resourceLabel ?? card.resourceId}
            </span>
            {card.zoneId && card.zoneId !== '—' && (
              <span className="font-data text-[10px] text-text-muted/60">
                Zone {card.zoneId}
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0 gap-2">
        {isResolved ? (
          <Badge
            variant={card.status === 'approved' ? 'success' : 'outline'}
            className="font-data text-[10px]"
          >
            {card.status.toUpperCase()}
          </Badge>
        ) : (
          <>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isResolved}
              className="h-7 px-3 rounded-md bg-threat-green/15 text-threat-green border border-threat-green/30 hover:bg-threat-green/25 font-ui text-xs font-semibold"
            >
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={isResolved}
              className="h-7 px-3 rounded-md text-text-muted hover:text-text-primary font-ui text-xs"
            >
              Dismiss
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

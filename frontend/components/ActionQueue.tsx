// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActionCard from '@/components/ActionCard';
import type { TimeSensitivity } from '@/lib/types';

type FilterKey = 'all' | 'IMMEDIATE' | 'HIGH' | 'MEDIUM';

const FILTER_TABS: readonly { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
] as const;

export default function ActionQueue() {
  const cards = useStore((s) => s.actionCards);

  const pendingCount = useMemo(
    () => cards.filter((c) => c.status === 'pending').length,
    [cards]
  );

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => b.confidence - a.confidence),
    [cards]
  );

  return (
    <aside className="flex flex-col w-[300px] bg-surface border-l border-border shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span className="font-ui text-xs font-semibold tracking-wider text-text-primary uppercase">
          AI Recommendations
        </span>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="font-data text-[10px] px-1.5 py-0">
            {pendingCount}
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <Tabs defaultValue="all" className="flex flex-col flex-1 min-h-0">
        <div className="px-3 pt-2 shrink-0">
          <TabsList className="w-full h-8 bg-bg/50 rounded-md p-0.5">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 h-7 min-h-0 rounded-sm font-ui text-[10px] font-medium tracking-wide px-1"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {FILTER_TABS.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="flex-1 mt-0 min-h-0"
          >
            <FilteredCardList
              cards={sortedCards}
              filter={tab.value}
            />
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}

interface FilteredCardListProps {
  cards: ReturnType<typeof useStore.getState>['actionCards'];
  filter: FilterKey;
}

function FilteredCardList({ cards, filter }: FilteredCardListProps) {
  const filtered = useMemo(() => {
    if (filter === 'all') return cards;
    return cards.filter((c) => c.timeSensitivity === (filter as TimeSensitivity));
  }, [cards, filter]);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-ui text-sm text-text-muted">
          No pending actions
        </span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-3">
        {filtered.map((card) => (
          <ActionCard key={card.id} card={card} />
        ))}
      </div>
    </ScrollArea>
  );
}

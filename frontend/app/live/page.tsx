// Read DESIGN.md and CLAUDE.md before modifying.
'use client';

import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useInitialData } from '@/hooks/useInitialData';
import TopBar from '@/components/TopBar';
import ActionQueue from '@/components/ActionQueue';
import EventFeed from '@/components/EventFeed';
import LayerControls from '@/components/LayerControls';
import AgentComms from '@/components/AgentComms';
import CommandOverview from '@/components/CommandOverview';
import DisconnectionBanner from '@/components/overlays/DisconnectionBanner';
import SimulationOverlay from '@/components/overlays/SimulationOverlay';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const MapContainer = dynamic(() => import('./MapView'), { ssr: false });

export default function LiveDashboard() {
  useInitialData();
  useWebSocket();

  return (
    <div className="flex flex-col h-screen w-screen bg-bg overflow-hidden">
      {/* Top bar - 48px */}
      <TopBar />

      {/* Disconnection banner - reads wsState from store internally */}
      <DisconnectionBanner />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar - 280px */}
        <aside className="w-[280px] flex-shrink-0 bg-surface border-r border-border flex flex-col overflow-hidden">
          <Tabs defaultValue="command" className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-3 mt-3 mb-0 flex-shrink-0">
              <TabsTrigger value="command" className="flex-1 text-xs font-ui">
                Command
              </TabsTrigger>
              <TabsTrigger value="comms" className="flex-1 text-xs font-ui">
                Comms
              </TabsTrigger>
            </TabsList>
            <TabsContent value="command" className="flex-1 min-h-0 overflow-auto mt-0 px-1">
              <CommandOverview />
            </TabsContent>
            <TabsContent value="comms" className="flex-1 min-h-0 overflow-auto mt-0 px-1">
              <AgentComms />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center + Right panels */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Map row */}
          <div className="flex flex-1 min-h-0">
            {/* Map area */}
            <div className="relative flex-1 min-w-0 p-2">
              <MapContainer />

              {/* Layer controls floating overlay (self-positions absolute) */}
              <LayerControls />

              {/* Simulation overlay - reads isSimulating from store internally */}
              <SimulationOverlay />
            </div>

            {/* Action Queue - right panel 300px (self-sizes) */}
            <ActionQueue />
          </div>

          {/* Event feed strip - 120px (self-sizes) */}
          <EventFeed />
        </div>
      </div>
    </div>
  );
}

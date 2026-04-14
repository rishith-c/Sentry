'use client';

import dynamic from 'next/dynamic';
import TopBar from '@/components/TopBar';
import LayerControls from '@/components/LayerControls';
import AgentComms from '@/components/AgentComms';
import ActionQueue from '@/components/ActionQueue';
import EventFeed from '@/components/EventFeed';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useInitialData } from '@/hooks/useInitialData';

const MainMap = dynamic(() => import('@/components/MainMap'), { ssr: false });

export default function CommanderDashboard() {
  useWebSocket();
  useInitialData();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      overflow: 'hidden', background: '#000000',
    }}>
      {/* Region 1: Top Bar — 44px */}
      <TopBar />

      {/* Region 2: Layer Controls — 40px */}
      <LayerControls />

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left panel: Agent Comms — 320px collapsible */}
        <AgentComms />

        {/* Map area */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <MainMap />
        </div>

        {/* Right panel: Action Queue — 320px */}
        <ActionQueue />
      </div>

      {/* Bottom: Event Feed — 160px */}
      <EventFeed />
    </div>
  );
}

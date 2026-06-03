'use client';
import { useState } from 'react';
import type { Timeline } from '@/types/timeline';
import { ChatPanel } from './Chat/ChatPanel';
import { PlayerPanel } from './Player/PlayerPanel';
import { HeaderActions } from './HeaderActions';

interface Props {
  initialTimeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function EditorLayout({ initialTimeline, onTimelineChange }: Props) {
  const [timeline, setTimeline] = useState<Timeline>(initialTimeline);

  const handleTimelineChange = (tl: Timeline) => {
    setTimeline(tl);
    onTimelineChange(tl);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="shrink-0 flex items-center justify-between px-5"
        style={{
          height: 44,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          {/* Small grid icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="0" y="0" width="6" height="6" rx="1" fill="var(--accent)" opacity="0.9"/>
            <rect x="8" y="0" width="6" height="6" rx="1" fill="var(--accent)" opacity="0.5"/>
            <rect x="0" y="8" width="6" height="6" rx="1" fill="var(--accent)" opacity="0.5"/>
            <rect x="8" y="8" width="6" height="6" rx="1" fill="var(--accent)" opacity="0.25"/>
          </svg>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--cream)', letterSpacing: '0.02em' }}>
            Craon
          </span>
        </div>

        <HeaderActions timeline={timeline} onTimelineChange={handleTimelineChange} />
      </header>

      {/* Main */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col min-h-0" style={{ width: '38%', minWidth: 280, borderRight: '1px solid var(--border)' }}>
          <ChatPanel timeline={timeline} onTimelineChange={handleTimelineChange} />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <PlayerPanel timeline={timeline} onTimelineChange={handleTimelineChange} />
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import type { Timeline } from '@/types/timeline';
import { ChatPanel } from './Chat/ChatPanel';
import { PlayerPanel } from './Player/PlayerPanel';

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
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-cream-subtle flex items-center justify-between px-6 bg-bg-surface shrink-0">
        <span className="text-cream text-sm font-semibold">Video Timeline Editor</span>
        <span className="text-cream-muted text-xs font-mono">{timeline.name}</span>
        <div className="flex items-center gap-4 text-cream-muted text-xs font-mono">
          <span>Sub: {timeline.subtitles.length}</span>
          <span>Music: {timeline.music.length}</span>
        </div>
      </div>

      {/* Two-column split */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[40%] min-w-[300px] border-r border-cream-subtle flex flex-col min-h-0">
          <ChatPanel timeline={timeline} onTimelineChange={handleTimelineChange} />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <PlayerPanel timeline={timeline} onTimelineChange={handleTimelineChange} />
        </div>
      </div>
    </div>
  );
}

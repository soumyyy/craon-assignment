import type { Timeline } from '@/types/timeline';

export function TimelineInfoBar({ timeline }: { timeline: Timeline }) {
  return (
    <div className="h-8 border-t border-cream-subtle flex items-center gap-4 px-4 bg-bg-surface shrink-0">
      <span className="text-cream-muted text-[11px] font-mono">
        Subtitles: {timeline.subtitles.length}
      </span>
      <span className="text-cream-subtle text-[11px]">·</span>
      <span className="text-cream-muted text-[11px] font-mono">
        Music: {timeline.music.length}
      </span>
      <span className="text-cream-subtle text-[11px]">·</span>
      <span className="text-cream-muted text-[11px] font-mono">
        {Math.round(timeline.duration_ms / 1000)}s
      </span>
    </div>
  );
}

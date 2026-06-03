import { Play, Pause } from 'lucide-react';
import { formatTime } from '@/lib/format';

interface Props {
  isPlaying: boolean;
  currentMs: number;
  durationMs: number;
  onPlayPause: () => void;
  onSeek: (ms: number) => void;
}

export function PlayerControls({ isPlaying, currentMs, durationMs, onPlayPause, onSeek }: Props) {
  const pct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;

  return (
    <div className="h-14 border-t border-cream-subtle flex items-center gap-3 px-4 bg-bg-surface shrink-0">
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="text-cream hover:text-accent transition-colors shrink-0"
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>

      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={durationMs || 1}
          value={currentMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1"
          style={{
            background: `linear-gradient(to right, #C8B89A ${pct}%, #1C1C1C ${pct}%)`,
          }}
          aria-label="Seek"
        />
        <span className="text-cream-muted text-xs font-mono whitespace-nowrap shrink-0">
          {formatTime(currentMs)} / {formatTime(durationMs)}
        </span>
      </div>
    </div>
  );
}

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
    <div style={{
      height: 52,
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 16px',
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid var(--border-mid)',
          background: isPlaying ? 'var(--accent)' : 'var(--bg-elevated)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 120ms ease',
        }}
      >
        {isPlaying ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="2.5" height="7" rx="1" fill={isPlaying ? '#080808' : 'var(--cream)'}/>
            <rect x="6" y="1.5" width="2.5" height="7" rx="1" fill={isPlaying ? '#080808' : 'var(--cream)'}/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2.5 1.5L8.5 5L2.5 8.5V1.5Z" fill="var(--cream)"/>
          </svg>
        )}
      </button>

      {/* Seek track */}
      <div style={{ flex: 1, position: 'relative', height: 16, display: 'flex', alignItems: 'center' }}>
        {/* Track bg */}
        <div style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          height: 2,
          borderRadius: 99,
          background: 'var(--bg-elevated)',
          overflow: 'hidden',
        }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
        </div>
        <input
          type="range"
          min={0}
          max={durationMs || 1}
          value={currentMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
      </div>

      {/* Time */}
      <span style={{
        fontSize: 11,
        fontFamily: 'DM Mono',
        color: 'var(--cream-muted)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}>
        {formatTime(currentMs)}<span style={{ opacity: 0.4, margin: '0 3px' }}>/</span>{formatTime(durationMs)}
      </span>
    </div>
  );
}

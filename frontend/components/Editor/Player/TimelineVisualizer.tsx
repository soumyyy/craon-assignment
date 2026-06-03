'use client';
import { useRef } from 'react';
import type { Timeline } from '@/types/timeline';
import { formatTime } from '@/lib/format';

interface Props {
  timeline: Timeline;
  currentMs: number;
  onSeek: (ms: number) => void;
}

export function TimelineVisualizer({ timeline, currentMs, onSeek }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const dur = timeline.duration_ms || 1;
  const pct = (ms: number) => `${(ms / dur) * 100}%`;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * dur));
  };

  const tickCount = Math.min(8, Math.max(3, Math.floor(dur / 4000)));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((i / tickCount) * dur));

  const TRACK_H = 16;
  const LABEL_W = 52;

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      padding: '8px 0 10px',
    }}>
      {/* Ruler */}
      <div style={{ display: 'flex', paddingLeft: LABEL_W, paddingRight: 16, marginBottom: 6, position: 'relative', height: 14 }}>
        {ticks.map((ms) => (
          <span
            key={ms}
            style={{
              position: 'absolute',
              left: `calc(${LABEL_W}px + ${(ms / dur) * 100}% * ((100% - ${LABEL_W}px - 16px) / 100%))`,
              transform: 'translateX(-50%)',
              fontSize: 9.5,
              fontFamily: 'DM Mono',
              color: 'var(--cream-muted)',
              letterSpacing: '0.02em',
              opacity: 0.7,
            }}
          >
            {formatTime(ms)}
          </span>
        ))}
      </div>

      {/* Tracks */}
      <div ref={railRef} style={{ paddingRight: 16, cursor: 'pointer' }} onClick={handleClick}>

        {/* Music track */}
        <div style={{ display: 'flex', alignItems: 'center', height: TRACK_H + 4, marginBottom: 3 }}>
          <div style={{
            width: LABEL_W,
            paddingLeft: 16,
            fontSize: 9.5,
            fontFamily: 'DM Mono',
            color: 'var(--cream-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.6,
            flexShrink: 0,
          }}>
            Music
          </div>
          <div style={{ flex: 1, position: 'relative', height: TRACK_H, borderRadius: 3, background: 'rgba(255,255,255,0.03)' }}>
            {timeline.music.map((track) => (
              <div
                key={track.id}
                title={track.src.split('/').pop() || 'track'}
                style={{
                  position: 'absolute',
                  top: 2,
                  bottom: 2,
                  left: pct(track.start_ms),
                  width: pct(track.end_ms - track.start_ms),
                  borderRadius: 3,
                  background: 'rgba(77, 124, 95, 0.5)',
                  border: '1px solid rgba(77,124,95,0.7)',
                  boxSizing: 'border-box',
                }}
              />
            ))}
            {/* tick lines */}
            {ticks.slice(1, -1).map((ms) => (
              <div key={ms} style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: pct(ms),
                width: 1,
                background: 'rgba(255,255,255,0.04)',
                pointerEvents: 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Subtitles track */}
        <div style={{ display: 'flex', alignItems: 'center', height: TRACK_H + 4 }}>
          <div style={{
            width: LABEL_W,
            paddingLeft: 16,
            fontSize: 9.5,
            fontFamily: 'DM Mono',
            color: 'var(--cream-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.6,
            flexShrink: 0,
          }}>
            Subs
          </div>
          <div style={{ flex: 1, position: 'relative', height: TRACK_H, borderRadius: 3, background: 'rgba(255,255,255,0.03)' }}>
            {timeline.subtitles.map((cue) => (
              <div
                key={cue.id}
                title={cue.text}
                style={{
                  position: 'absolute',
                  top: 2,
                  bottom: 2,
                  left: pct(cue.start_ms),
                  width: `max(4px, ${((cue.end_ms - cue.start_ms) / dur) * 100}%)`,
                  borderRadius: 3,
                  background: 'rgba(201, 185, 154, 0.38)',
                  border: '1px solid rgba(201,185,154,0.6)',
                  boxSizing: 'border-box',
                }}
              />
            ))}
            {ticks.slice(1, -1).map((ms) => (
              <div key={ms} style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: pct(ms),
                width: 1,
                background: 'rgba(255,255,255,0.04)',
                pointerEvents: 'none',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Playhead — spans full rail height */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `calc(${LABEL_W}px + ${pct(currentMs)} * ((100% - ${LABEL_W}px - 16px) / 100%))`,
        pointerEvents: 'none',
      }} />
    </div>
  );
}

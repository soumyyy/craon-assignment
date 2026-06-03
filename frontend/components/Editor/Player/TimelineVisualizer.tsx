'use client';
import { useRef } from 'react';
import type { Timeline } from '@/types/timeline';
import { formatTime } from '@/lib/format';

interface Props {
  timeline: Timeline;
  currentMs: number;       // source time
  trimStart: number;
  trimEnd: number;
  onSeek: (sourceMs: number) => void;
}

export function TimelineVisualizer({ timeline, currentMs, trimStart, trimEnd, onSeek }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const sourceDur = timeline.duration_ms || 1;

  // When trimmed, display ONLY the active window so the timeline shows the
  // working edit range (not the full source with a dim overlay).
  const isTrimmed = trimStart > 0 || trimEnd < sourceDur;
  const displayStart = isTrimmed ? Math.max(0, trimStart) : 0;
  const displayEnd   = isTrimmed ? Math.min(sourceDur, trimEnd) : sourceDur;
  const displayDur   = Math.max(1, displayEnd - displayStart);

  // Convert source-time ms → fractional position within display window
  const ratio = (ms: number) => Math.max(0, Math.min(1, (ms - displayStart) / displayDur));
  const pct   = (ms: number) => `${ratio(ms) * 100}%`;

  // Width of a block that may be clipped to the display window
  const blockLeft = (startMs: number) =>
    `${Math.max(0, ratio(Math.max(displayStart, startMs))) * 100}%`;
  const blockWidth = (startMs: number, endMs: number) => {
    const s = Math.max(displayStart, startMs);
    const e = Math.min(displayEnd,   endMs);
    if (e <= s) return '0px';
    return `max(5px, ${((e - s) / displayDur) * 100}%)`;
  };

  const TRACK_H = 16;
  const CLIP_H  = 24;
  const LABEL_W = 52;
  const RIGHT_PAD = 16;

  // railLeft accounts for label column + right padding for accurate overlap
  const railLeft = (ms: number) => {
    const r = ratio(ms);
    const pxOffset = LABEL_W - r * (LABEL_W + RIGHT_PAD);
    return `calc(${r * 100}% + ${pxOffset}px)`;
  };

  const clips = timeline.clips.length > 0
    ? timeline.clips
    : timeline.video_src
      ? [{
          id: 'clip_legacy',
          src: timeline.video_src,
          start_ms: 0,
          end_ms: timeline.duration_ms,
          duration_ms: timeline.duration_ms,
          resolution: timeline.resolution,
        }]
      : [];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const trackLeft  = rect.left + LABEL_W;
    const trackWidth = rect.width - LABEL_W - RIGHT_PAD;
    const r = Math.max(0, Math.min(1, (e.clientX - trackLeft) / trackWidth));
    const sourceMs = displayStart + Math.round(r * displayDur);
    onSeek(Math.max(displayStart, Math.min(displayEnd, sourceMs)));
  };

  const tickCount = Math.min(8, Math.max(3, Math.floor(displayDur / 4000)));
  // Ticks as relative ms from displayStart so ruler reads 0 → duration
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((i / tickCount) * displayDur)
  );

  const playheadSourceMs = Math.max(displayStart, Math.min(displayEnd, currentMs));

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      padding: '8px 0 10px',
    }}>
      {/* Ruler — tick labels show relative time (0:00 … clip duration) */}
      <div style={{ display: 'flex', paddingLeft: LABEL_W, paddingRight: RIGHT_PAD, marginBottom: 6, position: 'relative', height: 14 }}>
        {ticks.map((relMs) => (
          <span
            key={relMs}
            style={{
              position: 'absolute',
              left: railLeft(displayStart + relMs),
              transform: 'translateX(-50%)',
              fontSize: 9.5,
              fontFamily: 'DM Mono',
              color: 'var(--cream-muted)',
              letterSpacing: '0.02em',
              opacity: 0.7,
            }}
          >
            {formatTime(relMs)}
          </span>
        ))}
      </div>

      {/* Tracks */}
      <div ref={railRef} style={{ paddingRight: RIGHT_PAD, cursor: 'pointer', position: 'relative' }} onClick={handleClick}>

        {/* Clip track */}
        <div style={{ display: 'flex', alignItems: 'center', height: CLIP_H + 5, marginBottom: 4 }}>
          <div style={{
            width: LABEL_W,
            paddingLeft: 16,
            fontSize: 9.5,
            fontFamily: 'DM Mono',
            color: 'var(--cream-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.72,
            flexShrink: 0,
          }}>
            Clips
          </div>
          <div style={{ flex: 1, position: 'relative', height: CLIP_H, borderRadius: 4, background: 'rgba(255,255,255,0.035)', overflow: 'hidden' }}>
            {clips.map((clip) => {
              const w = blockWidth(clip.start_ms, clip.end_ms);
              if (w === '0px') return null;
              const name = clip.src.split('/').pop() || 'Clip';
              const active = currentMs >= clip.start_ms && currentMs < clip.end_ms;
              return (
                <div
                  key={clip.id}
                  title={`${name} · ${formatTime(clip.duration_ms)}`}
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: blockLeft(clip.start_ms),
                    width: w,
                    borderRadius: 4,
                    background: active
                      ? 'linear-gradient(90deg, rgba(201,185,154,0.78), rgba(114,143,123,0.72))'
                      : 'linear-gradient(90deg, rgba(201,185,154,0.34), rgba(114,143,123,0.28))',
                    border: active ? '1px solid rgba(245,239,224,0.75)' : '1px solid rgba(201,185,154,0.45)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                />
              );
            })}
            {/* Cut lines between clips */}
            {clips.slice(1).map((clip) => {
              if (clip.start_ms <= displayStart || clip.start_ms >= displayEnd) return null;
              return (
                <div
                  key={`cut-${clip.id}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: pct(clip.start_ms),
                    width: 1,
                    background: 'rgba(245,239,224,0.55)',
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

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
            {timeline.music.map((track) => {
              const w = blockWidth(track.start_ms, track.end_ms);
              if (w === '0px') return null;
              const volumePct = Math.round(track.volume * 100);
              const filename = track.src.split('/').pop() || 'track';
              const playable =
                track.src.startsWith('/files/') ||
                track.src.startsWith('/assets/') ||
                track.src.startsWith('http');
              return (
                <div
                  key={track.id}
                  title={`${filename} · ${volumePct}% volume${playable ? '' : ' · file path is not playable'}`}
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: blockLeft(track.start_ms),
                    width: w,
                    borderRadius: 3,
                    background: playable
                      ? `rgba(77, 124, 95, ${Math.max(0.24, Math.min(0.75, track.volume))})`
                      : 'rgba(149, 70, 70, 0.4)',
                    border: playable ? '1px solid rgba(77,124,95,0.7)' : '1px dashed rgba(220,110,110,0.8)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                  }}
                >
                  <span style={{
                    fontFamily: 'DM Mono',
                    fontSize: 8.5,
                    lineHeight: 1,
                    color: playable ? 'rgba(245,239,224,0.9)' : 'rgba(255,220,220,0.9)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    pointerEvents: 'none',
                  }}>
                    {volumePct}%
                  </span>
                </div>
              );
            })}
            {/* Tick lines */}
            {ticks.slice(1, -1).map((relMs) => (
              <div key={relMs} style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: pct(displayStart + relMs),
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
            {timeline.subtitles.map((cue) => {
              const w = blockWidth(cue.start_ms, cue.end_ms);
              if (w === '0px') return null;
              return (
                <div
                  key={cue.id}
                  title={cue.text}
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: blockLeft(cue.start_ms),
                    width: w,
                    borderRadius: 3,
                    background: 'rgba(201, 185, 154, 0.38)',
                    border: '1px solid rgba(201,185,154,0.6)',
                    boxSizing: 'border-box',
                  }}
                />
              );
            })}
            {ticks.slice(1, -1).map((relMs) => (
              <div key={relMs} style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: pct(displayStart + relMs),
                width: 1,
                background: 'rgba(255,255,255,0.04)',
                pointerEvents: 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Playhead */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: railLeft(playheadSourceMs),
          width: 1.5,
          background: 'var(--cream)',
          pointerEvents: 'none',
          zIndex: 6,
        }}>
          <div style={{ position: 'absolute', top: -3, left: -3, width: 7, height: 7, borderRadius: '50%', background: 'var(--cream)' }} />
        </div>
      </div>
    </div>
  );
}

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
  const dur = timeline.duration_ms || 1;
  const clampedCurrentMs = Math.max(0, Math.min(dur, currentMs));
  const clampedTrimStart = Math.max(0, Math.min(dur, trimStart));
  const clampedTrimEnd = Math.max(clampedTrimStart, Math.min(dur, trimEnd));
  const pct = (ms: number) => `${(ms / dur) * 100}%`;
  const blockWidth = (startMs: number, endMs: number) =>
    `max(5px, ${((endMs - startMs) / dur) * 100}%)`;
  const railLeft = (ms: number) => {
    const ratio = Math.max(0, Math.min(1, ms / dur));
    const pxOffset = LABEL_W - ratio * (LABEL_W + RIGHT_PAD);
    return `calc(${ratio * 100}% + ${pxOffset}px)`;
  };
  const isTrimmed = clampedTrimStart > 0 || clampedTrimEnd < dur;

  const TRACK_H = 16;
  const CLIP_H = 24;
  const LABEL_W = 52;
  const RIGHT_PAD = 16;
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
    const trackLeft = rect.left + LABEL_W;
    const trackWidth = rect.width - LABEL_W - RIGHT_PAD;
    const ratio = Math.max(0, Math.min(1, (e.clientX - trackLeft) / trackWidth));
    const target = Math.round(ratio * dur);
    onSeek(Math.max(clampedTrimStart, Math.min(clampedTrimEnd, target)));
  };

  const tickCount = Math.min(8, Math.max(3, Math.floor(dur / 4000)));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((i / tickCount) * dur));

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
              left: railLeft(ms),
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
      <div ref={railRef} style={{ paddingRight: 16, cursor: 'pointer', position: 'relative' }} onClick={handleClick}>

        {/* Trim window shading — dims regions outside [trimStart, trimEnd] */}
        {isTrimmed && (
          <div style={{
            position: 'absolute',
            left: LABEL_W, right: 16, top: 0, bottom: 0,
            pointerEvents: 'none', zIndex: 5,
          }}>
            {clampedTrimStart > 0 && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: pct(clampedTrimStart), background: 'rgba(8,8,8,0.7)', borderRight: '1.5px solid var(--accent)' }} />
            )}
            {clampedTrimEnd < dur && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(clampedTrimEnd), right: 0, background: 'rgba(8,8,8,0.7)', borderLeft: '1.5px solid var(--accent)' }} />
            )}
          </div>
        )}

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
            {clips.map((clip, index) => {
              const name = clip.src.split('/').pop() || `Clip ${index + 1}`;
              const active = clampedCurrentMs >= clip.start_ms && clampedCurrentMs < clip.end_ms;
              return (
                <div
                  key={clip.id}
                  title={`${name} · ${formatTime(clip.duration_ms)}`}
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: pct(clip.start_ms),
                    width: blockWidth(clip.start_ms, clip.end_ms),
                    borderRadius: 4,
                    background: active
                      ? 'linear-gradient(90deg, rgba(201,185,154,0.78), rgba(114,143,123,0.72))'
                      : 'linear-gradient(90deg, rgba(201,185,154,0.34), rgba(114,143,123,0.28))',
                    border: active ? '1px solid rgba(245,239,224,0.75)' : '1px solid rgba(201,185,154,0.45)',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '0 6px',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: active ? 'rgba(8,8,8,0.72)' : 'rgba(8,8,8,0.42)',
                    color: 'var(--cream)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'DM Mono',
                    fontSize: 8,
                    flexShrink: 0,
                  }}>
                    {index + 1}
                  </span>
                  <span style={{
                    fontFamily: 'DM Sans',
                    fontSize: 10,
                    color: active ? '#080808' : 'rgba(245,239,224,0.86)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {name}
                  </span>
                </div>
              );
            })}
            {clips.slice(1).map((clip) => (
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
            ))}
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
                  left: pct(track.start_ms),
                  width: blockWidth(track.start_ms, track.end_ms),
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
                  width: blockWidth(cue.start_ms, cue.end_ms),
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


        {/* Playhead line over the tracks */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: railLeft(clampedCurrentMs),
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

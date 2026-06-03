'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubtitleCue } from '@/types/timeline';

const TOLERANCE_MS = 50;

interface VideoDims { w: number; h: number; }
interface DisplayRect { x: number; y: number; w: number; h: number; }

// Mirrors object-fit:contain — largest rect that preserves aspect ratio within container
function calcDisplayRect(cw: number, ch: number, vw: number, vh: number): DisplayRect {
  const ca = cw / ch;
  const va = vw / vh;
  let dw: number, dh: number;
  if (ca > va) { dh = ch; dw = ch * va; }
  else          { dw = cw; dh = cw / va; }
  return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh };
}

interface Props {
  videoSrc: string;
  subtitles: SubtitleCue[];
  currentMs: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onMetadata: (durationMs: number) => void;
}

export function VideoContainer({ videoSrc, subtitles, currentMs, videoRef, onMetadata }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoDims, setVideoDims] = useState<VideoDims | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  const measureContainer = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    setContainerSize({ w: c.clientWidth, h: c.clientHeight });
  }, []);

  // Observe container size changes
  useEffect(() => {
    measureContainer();
    const ro = new ResizeObserver(measureContainer);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measureContainer]);

  // Get intrinsic video dimensions once metadata loads
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onReady = () => {
      if (el.videoWidth > 0 && el.videoHeight > 0) {
        setVideoDims({ w: el.videoWidth, h: el.videoHeight });
      }
      if (isFinite(el.duration)) onMetadata(Math.round(el.duration * 1000));
      measureContainer();
    };
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('canplay', onReady);
    if (el.readyState >= 1 && el.videoWidth > 0) onReady();
    return () => {
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('canplay', onReady);
    };
  }, [videoRef, onMetadata, measureContainer]);

  // Reset dims on src change
  useEffect(() => { setVideoDims(null); }, [videoSrc]);

  const active = subtitles.filter(
    (s) => currentMs >= s.start_ms - TOLERANCE_MS && currentMs <= s.end_ms + TOLERANCE_MS
  );

  const display: DisplayRect | null =
    videoDims && containerSize
      ? calcDisplayRect(containerSize.w, containerSize.h, videoDims.w, videoDims.h)
      : null;

  if (!videoSrc) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center" style={{ background: '#000' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: 0.35 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="3" y="7" width="34" height="26" rx="4" stroke="var(--cream)" strokeWidth="1.5"/>
            <path d="M16 14l10 6-10 6V14z" fill="var(--cream)"/>
          </svg>
          <span style={{ fontSize: 12, fontFamily: 'DM Sans', color: 'var(--cream-muted)' }}>
            Upload a video to get started
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: '#000' }}>
      {/* Video: absolute inset + object-fit:contain handles all aspect ratios */}
      <video
        ref={videoRef}
        src={videoSrc}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'contain', display: 'block' }}
        aria-label="Timeline preview"
        playsInline
      />

      {/* Subtitles positioned over the actual video display area (inside letterbox) */}
      {display && active.map((s) => {
        const { x, y, w, h } = display;
        const top =
          s.style.position === 'top'    ? y + h * 0.05 :
          s.style.position === 'center' ? y + h * 0.5 - s.style.font_size * 0.7 :
                                          y + h * 0.86; // bottom

        return (
          <div key={s.id} style={{
            position: 'absolute',
            top,
            left: x,
            width: w,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <span style={{
              display: 'inline-block',
              maxWidth: `${w * 0.82}px`,
              fontSize: s.style.font_size,
              color: s.style.color,
              fontFamily: 'DM Sans',
              fontWeight: 500,
              lineHeight: 1.4,
              textAlign: 'center',
              padding: '3px 12px 4px',
              borderRadius: 4,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              letterSpacing: '0.01em',
            }}>
              {s.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

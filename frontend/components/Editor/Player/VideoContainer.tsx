'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SubtitleCue } from '@/types/timeline';

const TOLERANCE_MS = 50;

interface VideoDims { w: number; h: number; }
interface DisplayRect { x: number; y: number; w: number; h: number; }

function parseRatio(r: string): number {
  const [a, b] = r.split(':').map(Number);
  return a / b;
}

// Largest box of `aspect` fitting in container
function calcDisplayRect(cw: number, ch: number, aspect: number): DisplayRect {
  const ca = cw / ch;
  let dw: number, dh: number;
  if (ca > aspect) { dh = ch; dw = ch * aspect; }
  else             { dw = cw; dh = cw / aspect; }
  return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh };
}

interface Props {
  videoSrc: string;
  subtitles: SubtitleCue[];
  currentMs: number;
  cropAspectRatio: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onMetadata: (durationMs: number) => void;
}

export function VideoContainer({ videoSrc, subtitles, currentMs, cropAspectRatio, videoRef, onMetadata }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoDims, setVideoDims] = useState<VideoDims | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  const measureContainer = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    setContainerSize({ w: c.clientWidth, h: c.clientHeight });
  }, []);

  useEffect(() => {
    measureContainer();
    const ro = new ResizeObserver(measureContainer);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measureContainer]);

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

  useEffect(() => { setVideoDims(null); }, [videoSrc]);

  const active = subtitles.filter(
    (s) => currentMs >= s.start_ms - TOLERANCE_MS && currentMs <= s.end_ms + TOLERANCE_MS
  );

  // Display aspect = crop ratio if set, else the video's native ratio
  const displayAspect =
    cropAspectRatio ? parseRatio(cropAspectRatio) :
    videoDims ? videoDims.w / videoDims.h : 16 / 9;

  const display: DisplayRect | null =
    containerSize ? calcDisplayRect(containerSize.w, containerSize.h, displayAspect) : null;

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

  // Video element is ALWAYS mounted (so metadata loads); the wrapper just
  // repositions/resizes once we know the display rect.
  const wrapperStyle: React.CSSProperties = display
    ? { position: 'absolute', left: display.x, top: display.y, width: display.w, height: display.h }
    : { position: 'absolute', inset: 0 };

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: '#000' }}>
      <div style={{ ...wrapperStyle, overflow: 'hidden', borderRadius: 6 }}>
        {/* object-fit:cover so a crop ratio clips the edges (center crop preview) */}
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full"
          style={{ objectFit: 'cover', display: 'block' }}
          aria-label="Timeline preview"
          playsInline
        />

        {/* Subtitles positioned within the visible (possibly cropped) frame */}
        {active.map((s) => {
            const top =
              s.style.position === 'top'    ? '5%' :
              s.style.position === 'center' ? '50%' :
                                              '86%';
            const translateY = s.style.position === 'center' ? 'translateY(-50%)' : 'none';
            return (
              <div key={s.id} style={{
                position: 'absolute',
                top,
                left: 0,
                width: '100%',
                transform: translateY,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 10,
                padding: '0 6%',
              }}>
                <span style={{
                  display: 'inline-block',
                  maxWidth: '90%',
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
    </div>
  );
}

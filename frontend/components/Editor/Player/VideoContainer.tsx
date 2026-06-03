'use client';
import { useEffect } from 'react';
import type { SubtitleCue } from '@/types/timeline';
import { SubtitleOverlay } from './SubtitleOverlay';

interface Props {
  videoSrc: string;
  subtitles: SubtitleCue[];
  currentMs: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onMetadata: (durationMs: number) => void;
}

export function VideoContainer({ videoSrc, subtitles, currentMs, videoRef, onMetadata }: Props) {
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const handler = () => onMetadata(Math.round(el.duration * 1000));
    el.addEventListener('loadedmetadata', handler);
    return () => el.removeEventListener('loadedmetadata', handler);
  }, [videoRef, onMetadata]);

  if (!videoSrc) {
    return (
      <div
        className="w-full border-2 border-dashed border-cream-subtle rounded-lg flex items-center justify-center text-cream-muted text-sm"
        style={{ aspectRatio: '16/9' }}
      >
        Upload a video to get started
      </div>
    );
  }

  return (
    // position:relative so subtitle overlay is anchored here
    // width: 100% so it fills the container; height is driven by the video's intrinsic ratio
    <div className="relative w-full">
      <video
        ref={videoRef}
        src={videoSrc}
        className="block w-full h-auto rounded-lg bg-black"
        aria-label="Timeline preview"
      />
      <div className="absolute inset-0 pointer-events-none">
        <SubtitleOverlay subtitles={subtitles} currentMs={currentMs} />
      </div>
    </div>
  );
}

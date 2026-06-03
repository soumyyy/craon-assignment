'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import type { Timeline } from '@/types/timeline';
import { VideoContainer } from './VideoContainer';
import { MusicEngine } from './MusicEngine';
import { PlayerControls } from './PlayerControls';
import { TimelineInfoBar } from './TimelineInfoBar';
import { TimelineVisualizer } from './TimelineVisualizer';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function resolveVideoUrl(src: string): string {
  if (!src) return '';
  return src.startsWith('http') ? src : `${API_BASE}${src}`;
}

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function PlayerPanel({ timeline }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(timeline.duration_ms);
  const [isPlaying, setIsPlaying] = useState(false);

  // Attach video event listeners once the ref is available (post-mount)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime  = () => setCurrentMs(Math.round(el.currentTime * 1000));
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended',      onEnded);
    el.addEventListener('pause',      onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended',      onEnded);
      el.removeEventListener('pause',      onPause);
    };
  }, []); // runs once; ref is stable after mount

  // Reload video when src changes (e.g. after trim/crop via chat)
  const prevSrcRef = useRef('');
  useEffect(() => {
    const el = videoRef.current;
    const url = resolveVideoUrl(timeline.video_src);
    if (!el || !url || url === prevSrcRef.current) return;
    prevSrcRef.current = url;
    // VideoContainer owns src={videoUrl} prop, but we force a load() call
    // because some browsers don't auto-reload on src attribute change.
    el.load();
    setCurrentMs(0);
    setIsPlaying(false);
  }, [timeline.video_src]);

  // Sync duration from timeline prop (e.g. after trim)
  useEffect(() => {
    setDurationMs(timeline.duration_ms);
  }, [timeline.duration_ms]);

  const onMetadata = useCallback((dur: number) => {
    setDurationMs(dur);
  }, []);

  const playPause = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      try {
        await el.play();
        setIsPlaying(true);
      } catch (e) {
        console.warn('play() rejected:', e);
      }
    }
  };

  const seek = (ms: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    setCurrentMs(ms);
  };

  const videoUrl = resolveVideoUrl(timeline.video_src);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Video area fills all remaining height — no scroll */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <VideoContainer
          videoSrc={videoUrl}
          subtitles={timeline.subtitles}
          currentMs={currentMs}
          videoRef={videoRef}
          onMetadata={onMetadata}
        />
      </div>

      <MusicEngine
        tracks={timeline.music}
        currentMs={currentMs}
        isPlaying={isPlaying}
      />

      <PlayerControls
        isPlaying={isPlaying}
        currentMs={currentMs}
        durationMs={durationMs}
        onPlayPause={playPause}
        onSeek={seek}
      />

      <TimelineVisualizer timeline={timeline} currentMs={currentMs} onSeek={seek} />
      <TimelineInfoBar />
    </div>
  );
}

'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import type { Timeline } from '@/types/timeline';
import { VideoContainer } from './VideoContainer';
import { MusicEngine } from './MusicEngine';
import { PlayerControls } from './PlayerControls';
import { UploadSection } from './UploadSection';
import { TimelineInfoBar } from './TimelineInfoBar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function resolveVideoUrl(src: string): string {
  if (!src) return '';
  return src.startsWith('http') ? src : `${API_BASE}${src}`;
}

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function PlayerPanel({ timeline, onTimelineChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(timeline.duration_ms);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync currentMs from video timeupdate
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const update = () => setCurrentMs(Math.round(el.currentTime * 1000));
    const ended = () => setIsPlaying(false);
    el.addEventListener('timeupdate', update);
    el.addEventListener('ended', ended);
    return () => {
      el.removeEventListener('timeupdate', update);
      el.removeEventListener('ended', ended);
    };
  }, []);

  // Reload video when src changes
  const prevSrcRef = useRef('');
  useEffect(() => {
    const el = videoRef.current;
    const url = resolveVideoUrl(timeline.video_src);
    if (!el || !url || url === prevSrcRef.current) return;
    prevSrcRef.current = url;
    el.src = url;
    el.load();
    setCurrentMs(0);
    setIsPlaying(false);
  }, [timeline.video_src]);

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
      } catch {}
    }
  };

  const seek = (ms: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    setCurrentMs(ms);
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-y-auto">
        <div className="w-full">
          <VideoContainer
            videoSrc={resolveVideoUrl(timeline.video_src)}
            subtitles={timeline.subtitles}
            currentMs={currentMs}
            videoRef={videoRef}
            onMetadata={onMetadata}
          />
        </div>
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

      <UploadSection timeline={timeline} onTimelineChange={onTimelineChange} />
      <TimelineInfoBar timeline={timeline} />
    </div>
  );
}

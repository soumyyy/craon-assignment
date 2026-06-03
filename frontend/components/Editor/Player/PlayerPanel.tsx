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

type ClipLike = Timeline['clips'][number];

export function PlayerPanel({ timeline }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0); // SOURCE time (ms)
  const [sourceDurationMs, setSourceDurationMs] = useState(timeline.duration_ms);
  const [isPlaying, setIsPlaying] = useState(false);

  const clips: ClipLike[] = timeline.clips.length > 0
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

  const activeClip = clips.find((clip) => currentMs >= clip.start_ms && currentMs < clip.end_ms)
    ?? clips.find((clip) => currentMs < clip.end_ms)
    ?? clips[clips.length - 1]
    ?? null;
  const activeClipRef = useRef<ClipLike | null>(activeClip);
  activeClipRef.current = activeClip;
  const clipsRef = useRef<ClipLike[]>(clips);
  clipsRef.current = clips;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  // Preserves "was playing" intent across clip transitions so auto-play survives
  // the brief pause that occurs when the video src changes between clips.
  const advancePlayRef = useRef(false);

  // ── Trim window (source coordinates) ──
  const trimStart = timeline.trim_start_ms || 0;
  const trimEnd = timeline.trim_end_ms ?? sourceDurationMs;
  const trimStartRef = useRef(trimStart);
  const trimEndRef = useRef(trimEnd);
  trimStartRef.current = trimStart;
  trimEndRef.current = trimEnd;

  useEffect(() => {
    setSourceDurationMs(timeline.duration_ms);
    if (!timeline.video_src) {
      setCurrentMs(0);
      setIsPlaying(false);
    }
  }, [timeline.duration_ms, timeline.video_src]);

  // Apply video volume live whenever it changes
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.volume = Math.max(0, Math.min(1, timeline.video_volume ?? 1));
  }, [timeline.video_volume]);

  // Video event listeners (attached once)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const advanceToNextClip = () => {
      const clip = activeClipRef.current;
      if (!clip) return false;
      const next = clipsRef.current.find((candidate) => candidate.start_ms >= clip.end_ms);
      if (!next || next.start_ms >= trimEndRef.current) return false;
      advancePlayRef.current = isPlayingRef.current; // preserve intent before src change
      setCurrentMs(next.start_ms);
      return true;
    };
    const onTime = () => {
      const clip = activeClipRef.current;
      if (!clip) return;
      const ms = clip.start_ms + Math.round(el.currentTime * 1000);
      // Clamp playback to the trim window
      if (ms >= trimEndRef.current) {
        el.pause();
        setCurrentMs(trimEndRef.current);
        setIsPlaying(false);
        return;
      }
      if (ms >= clip.end_ms - 40 && advanceToNextClip()) return;
      setCurrentMs(ms);
    };
    const onEnded = () => {
      if (!advanceToNextClip()) setIsPlaying(false);
    };
    const onPause = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  // Reload + seek to trim start when the primary timeline changes
  const prevSrcRef = useRef('');
  useEffect(() => {
    const signature = `${timeline.video_src}:${timeline.duration_ms}:${timeline.clips.length}`;
    if (!timeline.video_src || signature === prevSrcRef.current) return;
    prevSrcRef.current = signature;
    setIsPlaying(false);
    setCurrentMs(trimStartRef.current);
  }, [timeline.video_src, timeline.duration_ms, timeline.clips.length]);

  // When the active clip changes, load that clip and preserve/continue playback.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeClip) return;
    const localMs = Math.max(0, Math.min(activeClip.duration_ms, currentMs - activeClip.start_ms));

    // Use advancePlayRef if set (clip auto-advance), else fall back to isPlayingRef
    const shouldPlay = advancePlayRef.current || isPlayingRef.current;
    advancePlayRef.current = false;

    const syncTime = async () => {
      el.currentTime = localMs / 1000;
      if (shouldPlay) {
        try {
          await el.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn('play() rejected:', e);
          setIsPlaying(false);
        }
      }
    };

    if (el.readyState >= 1) {
      void syncTime();
      return;
    }
    el.addEventListener('loadedmetadata', syncTime, { once: true });
    return () => el.removeEventListener('loadedmetadata', syncTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id]);

  // When the trim window changes, snap playhead inside it
  useEffect(() => {
    if (currentMs < trimStart || currentMs > trimEnd) {
      setCurrentMs(trimStart);
    }
  }, [currentMs, trimStart, trimEnd]);

  const onMetadata = useCallback((dur: number) => {
    if (clipsRef.current.length === 0) setSourceDurationMs(dur);
  }, []);

  const playPause = async () => {
    const el = videoRef.current;
    if (!el || !activeClip) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      // At/past the trim end or before trim start → restart from trim start
      const atEnd = currentMs >= trimEnd - 50 || el.currentTime * 1000 >= trimEnd - 50;
      const startMs = (atEnd || currentMs < trimStart) ? trimStart : currentMs;
      if (startMs !== currentMs) setCurrentMs(startMs);
      const localMs = Math.max(0, Math.min(activeClip.duration_ms, startMs - activeClip.start_ms));
      el.currentTime = localMs / 1000;
      try {
        await el.play();
        setIsPlaying(true);
      } catch (e) {
        console.warn('play() rejected:', e);
      }
    }
  };

  // seek receives a CLIP-relative ms (0 = trim start)
  const seek = (clipMs: number) => {
    const el = videoRef.current;
    if (!el) return;
    const clampedClipMs = Math.max(0, Math.min(clipDuration, clipMs));
    const sourceMs = trimStart + clampedClipMs;
    const targetClip = clips.find((clip) => sourceMs >= clip.start_ms && sourceMs < clip.end_ms) ?? clips[clips.length - 1];
    if (targetClip && targetClip.id === activeClip?.id) {
      el.currentTime = Math.max(0, sourceMs - targetClip.start_ms) / 1000;
    }
    setCurrentMs(sourceMs);
  };

  const videoUrl = activeClip ? resolveVideoUrl(activeClip.src) : '';

  // Clip-relative values for the controls + visualizer
  const clipDuration = Math.max(1, trimEnd - trimStart);
  const clipCurrent = Math.max(0, Math.min(clipDuration, currentMs - trimStart));

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex-1 min-h-0 overflow-hidden">
        <VideoContainer
          videoSrc={videoUrl}
          subtitles={timeline.subtitles}
          currentMs={currentMs}
          cropAspectRatio={timeline.crop_aspect_ratio}
          nativeResolution={activeClip?.resolution ?? timeline.resolution ?? null}
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
        currentMs={clipCurrent}
        durationMs={clipDuration}
        onPlayPause={playPause}
        onSeek={seek}
      />

      <TimelineVisualizer
        timeline={timeline}
        currentMs={currentMs}
        trimStart={trimStart}
        trimEnd={trimEnd}
        onSeek={(sourceMs) => seek(sourceMs - trimStart)}
      />
      <TimelineInfoBar />
    </div>
  );
}

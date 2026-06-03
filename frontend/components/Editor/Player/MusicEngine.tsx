'use client';
import { useEffect, useRef } from 'react';
import type { MusicTrack } from '@/types/timeline';

interface Props {
  tracks: MusicTrack[];
  currentMs: number;
  isPlaying: boolean;
}

interface ActiveNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
  trackId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function resolveUrl(src: string): string {
  if (!src) return '';
  return src.startsWith('http') ? src : `${API_BASE}${src}`;
}

export function MusicEngine({ tracks, currentMs, isPlaying }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<ActiveNode[]>([]);
  const tracksRef = useRef<MusicTrack[]>(tracks);
  const currentMsRef = useRef(currentMs);
  const isPlayingRef = useRef(isPlaying);
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentMsRef.current = currentMs; }, [currentMs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const tearDown = () => {
    nodesRef.current.forEach(({ source }) => { try { source.stop(); } catch {} });
    nodesRef.current = [];
  };

  const buildGraph = async (posMs: number) => {
    tearDown();
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    for (const track of tracksRef.current) {
      const url = resolveUrl(track.src);
      if (!url) continue;
      if (posMs >= track.end_ms) continue;

      let buffer = bufferCache.current.get(url);
      if (!buffer) {
        try {
          const res = await fetch(url);
          const data = await res.arrayBuffer();
          buffer = await ctx.decodeAudioData(data);
          bufferCache.current.set(url, buffer);
        } catch { continue; }
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);

      const nowCtx = ctx.currentTime;
      const offsetSec = Math.max(0, (posMs - track.start_ms) / 1000);
      const trackDurSec = (track.end_ms - track.start_ms) / 1000;
      const remainingSec = trackDurSec - offsetSec;
      if (remainingSec <= 0) continue;

      // Fade in
      const fadeInSec = track.fade_in_ms / 1000;
      if (offsetSec < fadeInSec) {
        const startVol = fadeInSec > 0 ? (offsetSec / fadeInSec) * track.volume : track.volume;
        gain.gain.setValueAtTime(startVol, nowCtx);
        gain.gain.linearRampToValueAtTime(track.volume, nowCtx + (fadeInSec - offsetSec));
      } else {
        gain.gain.setValueAtTime(track.volume, nowCtx);
      }

      // Fade out
      const fadeOutSec = track.fade_out_ms / 1000;
      const fadeOutStartSec = remainingSec - fadeOutSec;
      if (fadeOutStartSec > 0 && fadeOutSec > 0) {
        gain.gain.setValueAtTime(track.volume, nowCtx + fadeOutStartSec);
        gain.gain.linearRampToValueAtTime(0.0001, nowCtx + remainingSec);
      }

      source.start(0, offsetSec, remainingSec);
      nodesRef.current.push({ source, gain, trackId: track.id });
    }
  };

  // Rebuild on tracks change (after chat action)
  useEffect(() => {
    tracksRef.current = tracks;
    if (isPlayingRef.current) buildGraph(currentMsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tracks)]);

  // Play / pause
  useEffect(() => {
    if (isPlaying) {
      buildGraph(currentMs);
    } else {
      tearDown();
      ctxRef.current?.suspend();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Seek — rebuild when playing
  const prevMsRef = useRef(currentMs);
  useEffect(() => {
    const delta = Math.abs(currentMs - prevMsRef.current);
    prevMsRef.current = currentMs;
    // Only rebuild on a seek (large jump > 500ms), not on normal playback
    if (delta > 500 && isPlayingRef.current) {
      buildGraph(currentMs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMs]);

  useEffect(() => () => {
    tearDown();
    ctxRef.current?.close();
  }, []);

  return null;
}

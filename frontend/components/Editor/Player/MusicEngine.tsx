'use client';
import { useCallback, useEffect, useRef } from 'react';
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

function isLoopingAsset(src: string): boolean {
  return src.startsWith('/assets/audio/') && src.includes('_loop.');
}

export function MusicEngine({ tracks, currentMs, isPlaying }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<ActiveNode[]>([]);
  const tracksRef = useRef<MusicTrack[]>(tracks);
  const currentMsRef = useRef(currentMs);
  const isPlayingRef = useRef(isPlaying);
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  const buildIdRef = useRef(0);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentMsRef.current = currentMs; }, [currentMs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const stopActiveNodes = useCallback(() => {
    nodesRef.current.forEach(({ source, gain }) => {
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    });
    nodesRef.current = [];
  }, []);

  const tearDown = useCallback(() => {
    buildIdRef.current += 1;
    stopActiveNodes();
  }, [stopActiveNodes]);

  const buildGraph = async (posMs: number) => {
    const buildId = buildIdRef.current + 1;
    buildIdRef.current = buildId;
    stopActiveNodes();

    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    if (buildId !== buildIdRef.current || !isPlayingRef.current) return;

    const tracksSnapshot = tracksRef.current;
    for (const track of tracksSnapshot) {
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
      if (buildId !== buildIdRef.current || !isPlayingRef.current) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = isLoopingAsset(track.src);
      if (source.loop) {
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      }
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);

      const nowCtx = ctx.currentTime;
      const startDelaySec = Math.max(0, (track.start_ms - posMs) / 1000);
      const scheduleStart = nowCtx + startDelaySec;
      const offsetSec = Math.max(0, (posMs - track.start_ms) / 1000);
      const trackDurSec = (track.end_ms - track.start_ms) / 1000;
      const remainingSec = trackDurSec - offsetSec;
      if (remainingSec <= 0) continue;
      if (!source.loop && offsetSec >= buffer.duration) continue;

      const sourceOffsetSec = source.loop ? offsetSec % buffer.duration : offsetSec;
      const playDurationSec = source.loop
        ? remainingSec
        : Math.min(remainingSec, Math.max(0, buffer.duration - sourceOffsetSec));
      if (playDurationSec <= 0) continue;

      // Fade in
      const fadeInSec = track.fade_in_ms / 1000;
      if (offsetSec < fadeInSec) {
        const startVol = fadeInSec > 0 ? (offsetSec / fadeInSec) * track.volume : track.volume;
        gain.gain.setValueAtTime(startVol, scheduleStart);
        gain.gain.linearRampToValueAtTime(track.volume, scheduleStart + (fadeInSec - offsetSec));
      } else {
        gain.gain.setValueAtTime(track.volume, scheduleStart);
      }

      // Fade out
      const fadeOutSec = track.fade_out_ms / 1000;
      const fadeOutStartSec = playDurationSec - fadeOutSec;
      if (fadeOutStartSec > 0 && fadeOutSec > 0) {
        gain.gain.setValueAtTime(track.volume, scheduleStart + fadeOutStartSec);
        gain.gain.linearRampToValueAtTime(0.0001, scheduleStart + playDurationSec);
      }

      nodesRef.current.push({ source, gain, trackId: track.id });
      source.onended = () => {
        nodesRef.current = nodesRef.current.filter((node) => node.source !== source);
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
      source.start(scheduleStart, sourceOffsetSec, playDurationSec);
    }
  };

  // Structural signature — everything EXCEPT volume. Volume is applied live below.
  const structuralKey = tracks
    .map((t) => `${t.id}:${t.src}:${t.start_ms}:${t.end_ms}:${t.fade_in_ms}:${t.fade_out_ms}`)
    .join('|');

  // Rebuild only on structural change (src / timing / fades / track add-remove)
  useEffect(() => {
    tracksRef.current = tracks;
    if (isPlayingRef.current) buildGraph(currentMsRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey]);

  // Apply volume changes LIVE to the playing gain nodes — no rebuild, no glitch.
  const volumeKey = tracks.map((t) => `${t.id}:${t.volume}`).join(',');
  useEffect(() => {
    tracksRef.current = tracks;
    const ctx = ctxRef.current;
    if (!ctx) return;
    for (const node of nodesRef.current) {
      const track = tracks.find((t) => t.id === node.trackId);
      if (!track) continue;
      const now = ctx.currentTime;
      node.gain.gain.cancelScheduledValues(now);
      // Smooth glide to the new volume (~60ms) to avoid clicks
      node.gain.gain.setTargetAtTime(Math.max(0.0001, track.volume), now, 0.04);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeKey]);

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
  }, [tearDown]);

  return null;
}

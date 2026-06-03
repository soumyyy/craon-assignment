import axios from 'axios';
import type { Timeline, ChatResponse, UploadVideoResult, UploadAudioResult } from '@/types/timeline';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
});

export async function getTimeline(): Promise<Timeline> {
  const res = await api.get<Timeline>('/timeline');
  return res.data;
}

export async function resetTimeline(): Promise<Timeline> {
  const res = await api.post<Timeline>('/timeline/reset');
  return res.data;
}

export async function sendChat(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ChatResponse> {
  const res = await api.post<ChatResponse>('/chat', { message, history });
  return res.data;
}

export async function uploadVideo(
  file: File,
  durationMs: number | null,
  onProgress?: (pct: number) => void
): Promise<UploadVideoResult> {
  const form = new FormData();
  form.append('file', file);
  if (durationMs) form.append('duration_ms', String(Math.round(durationMs)));
  const res = await api.post<UploadVideoResult>('/upload/video', form, {
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

export async function uploadClip(
  file: File,
  durationMs: number | null,
  onProgress?: (pct: number) => void
): Promise<UploadVideoResult> {
  const form = new FormData();
  form.append('file', file);
  if (durationMs) form.append('duration_ms', String(Math.round(durationMs)));
  const res = await api.post<UploadVideoResult>('/upload/clip', form, {
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

export async function transcribeVideo(): Promise<{ timeline: Timeline; count: number }> {
  const res = await api.post<{ timeline: Timeline; count: number }>('/transcribe');
  return res.data;
}

export async function exportVideo(): Promise<{ url: string }> {
  const res = await api.post<{ url: string }>('/video/export');
  return res.data;
}

export function exportDownloadUrl(url: string): string {
  const params = new URLSearchParams({ url });
  return `${API_BASE}/video/export/download?${params.toString()}`;
}

export async function uploadAudio(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadAudioResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<UploadAudioResult>('/upload/audio', form, {
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

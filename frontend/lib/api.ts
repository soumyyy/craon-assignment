import axios from 'axios';
import type { Timeline, ChatResponse, UploadVideoResult, UploadAudioResult } from '@/types/timeline';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  timeout: 60000,
});

export async function getTimeline(): Promise<Timeline> {
  const res = await api.get<Timeline>('/timeline');
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

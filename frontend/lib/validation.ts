import type { ValidationResult } from '@/types/timeline';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.aac']);
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function ext(filename: string) {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

export function validateVideoFile(file: File): ValidationResult {
  if (!VIDEO_EXTS.has(ext(file.name)))
    return { ok: false, error: 'Unsupported format. Use MP4, MOV, or WEBM.' };
  if (!file.type.startsWith('video/'))
    return { ok: false, error: "This doesn't appear to be a video file." };
  if (file.size > MAX_VIDEO_BYTES)
    return { ok: false, error: 'File is too large. Maximum is 500 MB.' };
  return { ok: true };
}

export function validateAudioFile(file: File, existing: File[]): ValidationResult {
  if (!AUDIO_EXTS.has(ext(file.name)))
    return { ok: false, error: 'Unsupported format. Use MP3, WAV, or AAC.' };
  if (!file.type.startsWith('audio/'))
    return { ok: false, error: "This doesn't appear to be an audio file." };
  if (file.size > MAX_AUDIO_BYTES)
    return { ok: false, error: 'File is too large. Maximum is 50 MB.' };
  if (existing.some((f) => f.name === file.name))
    return { ok: false, error: 'This file is already added.' };
  if (existing.length >= 3)
    return { ok: false, error: 'You can upload up to 3 music tracks.' };
  return { ok: true };
}

export async function extractVideoMeta(
  file: File
): Promise<{ durationMs: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({
        durationMs: Math.round(video.duration * 1000),
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    video.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

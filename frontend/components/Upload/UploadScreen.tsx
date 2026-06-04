'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Dropzone } from './Dropzone';
import { AudioCard } from './AudioCard';
import { validateVideoFile, validateAudioFile, extractVideoMeta } from '@/lib/validation';
import { uploadVideo, uploadAudio } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastProvider';
import type { Timeline } from '@/types/timeline';

type VState = 'idle' | 'validating' | 'uploading' | 'success' | 'error';
interface AudioEntry { file: File; state: 'uploading' | 'done' | 'error'; error?: string; progress?: number; }

export function UploadScreen({ onComplete }: { onComplete: (tl: Timeline) => void }) {
  const { toast } = useToast();
  const [videoState, setVideoState] = useState<VState>('idle');
  const [videoError, setVideoError] = useState<string>();
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoLabel, setVideoLabel] = useState<string>();
  const [finalTimeline, setFinalTimeline] = useState<Timeline | null>(null);
  const [audioEntries, setAudioEntries] = useState<AudioEntry[]>([]);

  const handleVideoFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    if (files.length > 1) toast('Only one video supported. Using the first file.', 'warning');

    setVideoState('validating');
    setVideoError(undefined);

    const validation = validateVideoFile(file);
    if (!validation.ok) { setVideoState('error'); setVideoError(validation.error); return; }

    const meta = await extractVideoMeta(file);
    if (meta && meta.durationMs > 10 * 60 * 1000) toast('Video is over 10 minutes — this may affect performance.', 'warning');

    setVideoState('uploading');
    try {
      const result = await uploadVideo(file, meta?.durationMs ?? null, setVideoProgress);
      const label = meta ? `${file.name}  ·  ${meta.width}×${meta.height}` : file.name;
      setVideoLabel(label);
      setVideoState('success');
      setFinalTimeline(result.timeline);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Upload failed — check your connection and try again.';
      setVideoState('error');
      setVideoError(msg);
    }
  };

  const handleAudioFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const validation = validateAudioFile(file, audioEntries.map((e) => e.file));
      if (!validation.ok) { toast(validation.error!, 'error'); continue; }

      setAudioEntries((prev) => [...prev, { file, state: 'uploading', progress: 0 }]);

      try {
        const result = await uploadAudio(file, (pct) => {
          setAudioEntries((prev) => prev.map((e) => e.file.name === file.name ? { ...e, progress: pct } : e));
        });
        setAudioEntries((prev) => prev.map((e) => e.file.name === file.name ? { ...e, state: 'done' } : e));
        if (result.attached_to) {
          toast(`"${file.name}" attached to music track.`, 'success');
        } else {
          toast(`"${file.name}" uploaded. Say "add a music track" in chat to use it.`, 'warning');
        }
        setFinalTimeline(result.timeline);
      } catch {
        setAudioEntries((prev) => prev.map((e) => e.file.name === file.name ? { ...e, state: 'error', error: 'Upload failed' } : e));
      }
    }
  };

  const removeAudio = (name: string) => setAudioEntries((prev) => prev.filter((e) => e.file.name !== name));
  const audioUploading = audioEntries.some((e) => e.state === 'uploading');
  const canContinue = videoState === 'success' && !audioUploading && finalTimeline;

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <div className="h-12 border-b border-cream-subtle flex items-center px-6 bg-bg-surface">
        <span className="text-cream text-sm font-semibold">Video Timeline Editor</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <h2 className="text-cream text-lg font-semibold mb-1">Upload your media</h2>
          <p className="text-cream-muted text-sm mb-8">
            Add a video to get started. Music is optional — you can add it later via chat.
          </p>

          <div className="mb-6">
            <p className="text-cream-muted text-xs uppercase tracking-widest mb-2">
              Video <span className="text-status-error normal-case">required</span>
            </p>
            <Dropzone
              accept=".mp4,.mov,.webm"
              label="Drag & drop or click to upload"
              hint="MP4, MOV, WEBM · Max 500 MB"
              state={videoState}
              progress={videoProgress}
              error={videoError}
              successLabel={videoLabel}
              onFiles={handleVideoFiles}
            />
          </div>

          <div className="mb-8">
            <p className="text-cream-muted text-xs uppercase tracking-widest mb-2">
              Music <span className="text-cream-subtle normal-case">optional · up to 3 tracks</span>
            </p>
            <Dropzone
              accept=".mp3,.wav,.aac"
              label="Drag & drop or click to upload"
              hint="MP3, WAV, AAC · Max 50 MB per file"
              state="idle"
              onFiles={handleAudioFiles}
              multiple
            />
            {audioEntries.length > 0 && (
              <div className="mt-3 space-y-2">
                {audioEntries.map((e) => (
                  <AudioCard key={e.file.name} filename={e.file.name} onRemove={() => removeAudio(e.file.name)} />
                ))}
              </div>
            )}
          </div>

          <button
            disabled={!canContinue}
            onClick={() => finalTimeline && onComplete(finalTimeline)}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-bg-primary text-sm font-semibold px-6 py-3 rounded-lg transition-all hover:enabled:scale-[1.01] active:enabled:scale-[0.99]"
          >
            {audioUploading ? 'Uploading audio… please wait' : 'Continue to Editor'}
            {!audioUploading && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

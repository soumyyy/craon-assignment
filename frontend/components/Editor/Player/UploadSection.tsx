'use client';
import { useRef, useState } from 'react';
import { Upload, Sparkles, Loader2 } from 'lucide-react';
import { validateVideoFile, validateAudioFile, extractVideoMeta } from '@/lib/validation';
import { uploadVideo, uploadAudio, transcribeVideo } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastProvider';
import type { Timeline } from '@/types/timeline';

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function UploadSection({ timeline, onTimelineChange }: Props) {
  const { toast } = useToast();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const handleVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateVideoFile(file);
    if (!v.ok) { toast(v.error!, 'error'); return; }
    const meta = await extractVideoMeta(file);
    if (!meta) { toast("Couldn't read video metadata — file may be corrupted.", 'error'); return; }
    setVideoProgress(0);
    try {
      const res = await uploadVideo(file, meta.durationMs, setVideoProgress);
      onTimelineChange(res.timeline);
      toast('Video replaced.', 'success');
    } catch {
      toast('Video upload failed. Try again.', 'error');
    } finally { setVideoProgress(null); e.target.value = ''; }
  };

  const handleAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateAudioFile(file, []);
    if (!v.ok) { toast(v.error!, 'error'); return; }
    setAudioProgress(0);
    try {
      const res = await uploadAudio(file, setAudioProgress);
      onTimelineChange(res.timeline);
      if (res.attached_to) {
        toast(`Audio attached to track ${res.attached_to}.`, 'success');
      } else {
        toast('All tracks have files — add a new track via chat first.', 'warning');
      }
    } catch {
      toast('Audio upload failed. Try again.', 'error');
    } finally { setAudioProgress(null); e.target.value = ''; }
  };

  const handleTranscribe = async () => {
    if (!timeline.video_src) { toast('Upload a video first.', 'error'); return; }
    setTranscribing(true);
    try {
      const res = await transcribeVideo();
      onTimelineChange(res.timeline);
      toast(`${res.count} subtitle${res.count === 1 ? '' : 's'} generated from speech.`, 'success');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Transcription failed. Try again.';
      toast(msg, 'error');
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-t border-cream-subtle bg-bg-surface shrink-0">
      {/* Upload buttons row */}
      <div className="flex gap-2">
        <input ref={videoInputRef} type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={handleVideo} />
        <input ref={audioInputRef} type="file" accept=".mp3,.wav,.aac" className="hidden" onChange={handleAudio} />

        {([
          { label: timeline.video_src ? 'Replace Video' : 'Upload Video', ref: videoInputRef, progress: videoProgress },
          { label: 'Upload Music', ref: audioInputRef, progress: audioProgress },
        ] as const).map(({ label, ref, progress }) => (
          <div key={label} className="relative flex-1">
            <button
              onClick={() => ref.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-cream-subtle rounded-lg px-3 py-2 text-cream text-xs hover:bg-bg-hover transition-colors"
            >
              <Upload size={13} />
              {progress !== null ? `${progress}%` : label}
            </button>
            {progress !== null && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bg-hover rounded-b overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Generate Subtitles — full width, accent style */}
      <button
        onClick={handleTranscribe}
        disabled={transcribing || !timeline.video_src}
        className="w-full flex items-center justify-center gap-2 bg-bg-elevated hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed border border-accent/40 rounded-lg px-3 py-2 text-accent text-xs transition-colors"
      >
        {transcribing
          ? <><Loader2 size={13} className="animate-spin" /> Transcribing audio…</>
          : <><Sparkles size={13} /> Generate Subtitles from Speech</>
        }
      </button>
    </div>
  );
}

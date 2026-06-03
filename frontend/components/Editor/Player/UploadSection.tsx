'use client';
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { validateVideoFile, validateAudioFile, extractVideoMeta } from '@/lib/validation';
import { uploadVideo, uploadAudio } from '@/lib/api';
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

  return (
    <div className="flex gap-3 px-4 py-3 border-t border-cream-subtle bg-bg-surface shrink-0">
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
  );
}

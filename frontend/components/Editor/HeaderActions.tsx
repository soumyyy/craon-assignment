'use client';
import { useRef, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { validateVideoFile, validateAudioFile, extractVideoMeta } from '@/lib/validation';
import { exportDownloadUrl, exportVideo, resetTimeline, transcribeVideo, uploadAudio, uploadClip, uploadVideo } from '@/lib/api';
import { useToast } from '@/components/Toast/ToastProvider';
import type { Timeline } from '@/types/timeline';

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

function HeaderBtn({
  onClick, disabled, children, accent
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 28,
        padding: '0 12px',
        borderRadius: 5,
        fontSize: 12,
        fontFamily: 'DM Sans',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 120ms ease, color 120ms ease',
        border: accent ? '1px solid rgba(201,185,154,0.3)' : '1px solid var(--border-mid)',
        background: accent ? 'rgba(201,185,154,0.07)' : 'var(--bg-elevated)',
        color: accent ? 'var(--accent)' : 'var(--cream)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = accent ? 'rgba(201,185,154,0.13)' : 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = accent ? 'rgba(201,185,154,0.07)' : 'var(--bg-elevated)';
      }}
    >
      {children}
    </button>
  );
}

export function HeaderActions({ timeline, onTimelineChange }: Props) {
  const { toast } = useToast();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const clipInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [clipProgress, setClipProgress] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateVideoFile(file);
    if (!v.ok) { toast(v.error!, 'error'); return; }
    const meta = await extractVideoMeta(file);
    if (!meta) { toast("Couldn't read video metadata.", 'error'); return; }
    setVideoProgress(0);
    try {
      const res = await uploadVideo(file, meta.durationMs, setVideoProgress);
      onTimelineChange(res.timeline);
      toast('Video replaced. Timeline reset for the new video.', 'success');
    } catch { toast('Video upload failed.', 'error'); }
    finally { setVideoProgress(null); e.target.value = ''; }
  };

  const handleClip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateVideoFile(file);
    if (!v.ok) { toast(v.error!, 'error'); return; }
    const meta = await extractVideoMeta(file);
    if (!meta) { toast("Couldn't read clip metadata.", 'error'); return; }
    setClipProgress(0);
    try {
      const res = await uploadClip(file, meta.durationMs, setClipProgress);
      onTimelineChange(res.timeline);
      toast('Clip appended to the end.', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Clip upload failed.';
      toast(msg, 'error');
    } finally { setClipProgress(null); e.target.value = ''; }
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
      toast(res.attached_to ? 'Audio attached.' : 'Audio uploaded — add a track via chat.', res.attached_to ? 'success' : 'warning');
    } catch { toast('Audio upload failed.', 'error'); }
    finally { setAudioProgress(null); e.target.value = ''; }
  };

  const handleTranscribe = async () => {
    if (!timeline.video_src) { toast('Upload a video first.', 'error'); return; }
    setTranscribing(true);
    try {
      const res = await transcribeVideo();
      onTimelineChange(res.timeline);
      toast(`${res.count} subtitle${res.count === 1 ? '' : 's'} generated.`, 'success');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Transcription failed.';
      toast(msg, 'error');
    } finally { setTranscribing(false); }
  };

  const handleExport = async () => {
    if (!timeline.video_src) { toast('Upload a video first.', 'error'); return; }
    setExporting(true);
    try {
      const res = await exportVideo();
      window.location.href = exportDownloadUrl(res.url);
      toast('Export saved.', 'success');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Export failed.';
      toast(msg, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const tl = await resetTimeline();
      onTimelineChange(tl);
      toast('Timeline reset. Upload a new video to start again.', 'success');
    } catch {
      toast('Reset failed.', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input ref={videoInputRef} type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={handleVideo} />
      <input ref={clipInputRef} type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={handleClip} />
      <input ref={audioInputRef} type="file" accept=".mp3,.wav,.aac" className="hidden" onChange={handleAudio} />

      {/* Show Upload Video only when no video loaded (e.g. after reset) */}
      {!timeline.video_src && (
        <HeaderBtn onClick={() => videoInputRef.current?.click()}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 8V2M3 5l3-3 3 3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {videoProgress !== null ? `${videoProgress}%` : 'Upload Video'}
        </HeaderBtn>
      )}

      <HeaderBtn onClick={() => clipInputRef.current?.click()} disabled={!timeline.video_src || clipProgress !== null}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 3.5h5M2 8.5h8M8 2v3l2-1.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {clipProgress !== null ? `${clipProgress}%` : 'Add Clip'}
      </HeaderBtn>

      <HeaderBtn onClick={() => audioInputRef.current?.click()}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M9 4.5C9 6.98 7.21 9 5 9s-4-2.02-4-4.5M5 9v2M3 11h4M5 1v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {audioProgress !== null ? `${audioProgress}%` : 'Add Music'}
      </HeaderBtn>

      {/* divider */}
      <div style={{ width: 1, height: 18, background: 'var(--border-mid)', margin: '0 2px' }} />

      <HeaderBtn onClick={handleReset} disabled={resetting || (!timeline.video_src && timeline.music.length === 0 && timeline.subtitles.length === 0)}>
        {resetting ? <><Loader2 size={11} className="animate-spin" />Resetting</> : <><RotateCcw size={11} />Reset</>}
      </HeaderBtn>

      <HeaderBtn
        accent
        onClick={handleTranscribe}
        disabled={transcribing || !timeline.video_src}
      >
        {transcribing
          ? <><Loader2 size={11} className="animate-spin" />Transcribing…</>
          : <>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M6 1l1.2 2.4 2.8.4-2 2 .5 2.7L6 7.2 3.5 8.5l.5-2.7-2-2 2.8-.4L6 1z" fill="currentColor"/>
              </svg>
              Generate Subtitles
            </>
        }
      </HeaderBtn>

      <HeaderBtn
        accent
        onClick={handleExport}
        disabled={exporting || !timeline.video_src}
      >
        {exporting
          ? <><Loader2 size={11} className="animate-spin" />Exporting</>
          : <><Download size={11} />Export</>
        }
      </HeaderBtn>
    </div>
  );
}

# Frontend Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Next.js frontend — onboarding screen, upload flow with validation, and the Chat Lab editor with live video player, subtitle overlay, and Web Audio music engine.

**Architecture:** Three app stages (onboarding → upload → editor) managed in root state. Chat panel (left 40%) communicates with FastAPI `/chat`, receives updated timeline in response, and drives the player panel (right 60%) reactively. No polling — timeline state is always carried in the `/chat` response body.

**Tech Stack:** Next.js 14 App Router · React 18 · TypeScript · Tailwind CSS · axios · lucide-react · Web Audio API

---

## File Map

```
frontend/
├── tailwind.config.ts              MODIFY — add custom colour tokens
├── app/
│   ├── globals.css                 MODIFY — body bg, scrollbar, fonts
│   ├── layout.tsx                  MODIFY — Inter + JetBrains Mono fonts
│   └── page.tsx                    REPLACE — root stage machine
├── types/
│   └── timeline.ts                 CREATE — all shared TS types
├── lib/
│   ├── api.ts                      CREATE — axios instance + typed calls
│   ├── validation.ts               CREATE — file validation utils
│   └── format.ts                   CREATE — time formatting helpers
├── hooks/
│   ├── useTimeline.ts              CREATE — fetch + hold timeline state
│   ├── useChat.ts                  CREATE — message history + send
│   ├── useVideoPlayer.ts           CREATE — video playback state
│   ├── useMusicEngine.ts           CREATE — Web Audio graph manager
│   └── useUpload.ts                CREATE — file upload + progress
├── components/
│   ├── Toast/
│   │   └── ToastProvider.tsx       CREATE — global toast stack
│   ├── Onboarding/
│   │   └── OnboardingScreen.tsx    CREATE — disclaimer + can/cannot
│   ├── Upload/
│   │   ├── UploadScreen.tsx        CREATE — upload stage layout
│   │   ├── Dropzone.tsx            CREATE — drag/drop zone (shared)
│   │   └── AudioCard.tsx           CREATE — uploaded audio file row
│   └── Editor/
│       ├── EditorLayout.tsx        CREATE — header + two-col split
│       ├── Chat/
│       │   ├── ChatPanel.tsx       CREATE — panel wrapper + header
│       │   ├── MessageList.tsx     CREATE — scrollable message list
│       │   ├── MessageBubble.tsx   CREATE — user + agent bubbles
│       │   ├── TypingIndicator.tsx CREATE — three-dot animation
│       │   ├── SuggestionChips.tsx CREATE — first-load prompt chips
│       │   └── ChatInput.tsx       CREATE — textarea + send button
│       └── Player/
│           ├── PlayerPanel.tsx     CREATE — player layout wrapper
│           ├── VideoContainer.tsx  CREATE — video + subtitle overlay
│           ├── SubtitleOverlay.tsx CREATE — active subtitle renderer
│           ├── MusicEngine.tsx     CREATE — invisible Web Audio manager
│           ├── PlayerControls.tsx  CREATE — play/pause + seek bar
│           ├── UploadSection.tsx   CREATE — video/audio upload buttons
│           └── TimelineInfoBar.tsx CREATE — sub/music/duration footer
```

---

## Task 1: Tailwind Config + Global Styles + Fonts

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`

- [ ] **Replace `tailwind.config.ts` with custom palette**

```ts
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  '#0A0A0A',
          surface:  '#141414',
          elevated: '#1C1C1C',
          hover:    '#242424',
        },
        cream: {
          DEFAULT: '#F5F0E8',
          muted:   '#A89F8C',
          subtle:  '#4A4540',
        },
        accent: {
          DEFAULT: '#C8B89A',
          hover:   '#D4C4A8',
        },
        bubble: {
          user: '#2A2520',
        },
        status: {
          success: '#4A7C59',
          warning: '#8A6A2A',
          error:   '#7A3A3A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Replace `globals.css`**

```css
/* frontend/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');

* { box-sizing: border-box; }

body {
  background: #0A0A0A;
  color: #F5F0E8;
  font-family: 'Inter', system-ui, sans-serif;
  margin: 0;
}

/* scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #141414; }
::-webkit-scrollbar-thumb { background: #4A4540; border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: #C8B89A; }

/* focus ring */
*:focus-visible {
  outline: 2px solid #C8B89A;
  outline-offset: 2px;
}

/* range input — seek bar */
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: #1C1C1C;
  cursor: pointer;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #C8B89A;
  cursor: pointer;
  transition: width 150ms ease, height 150ms ease;
}
input[type='range']:hover::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Update `layout.tsx` — remove Next.js default fonts, add metadata**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Timeline Editor",
  description: "AI-powered video timeline editing through natural language",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Verify:** Run `cd frontend && npm run dev`, open `http://localhost:3000` — page background should be `#0A0A0A` (deep black).

---

## Task 2: TypeScript Types + API Client + Utils

**Files:**
- Create: `frontend/types/timeline.ts`
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/validation.ts`
- Create: `frontend/lib/format.ts`

- [ ] **Create `types/timeline.ts`**

```ts
// frontend/types/timeline.ts
export interface SubtitleStyle {
  font_size: number;
  color: string;
  position: 'bottom' | 'top' | 'center';
}

export interface SubtitleCue {
  id: string;
  text: string;
  start_ms: number;
  end_ms: number;
  style: SubtitleStyle;
}

export interface MusicTrack {
  id: string;
  src: string;
  start_ms: number;
  end_ms: number;
  volume: number;
  fade_in_ms: number;
  fade_out_ms: number;
}

export interface Timeline {
  _id: string;
  name: string;
  duration_ms: number;
  fps: number;
  resolution: { width: number; height: number };
  video_src: string;
  clips: unknown[];
  music: MusicTrack[];
  subtitles: SubtitleCue[];
}

export type MessageStatus = 'success' | 'warning' | 'error';
export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  timestamp: string;
}

export interface UploadVideoResult {
  url: string;
  duration_ms: number;
  timeline: Timeline;
}

export interface UploadAudioResult {
  url: string;
  timeline_id: string;
  attached_to: string | null;
  created_track: boolean;
  timeline: Timeline;
}

export interface ChatResponse {
  response: string;
  timeline: Timeline;
  tool_calls: Array<{ tool: string; args: Record<string, unknown> }>;
}

export type AppStage = 'onboarding' | 'upload' | 'editor';

export interface ValidationResult {
  ok: boolean;
  error?: string;
  warning?: string;
}
```

- [ ] **Create `lib/api.ts`**

```ts
// frontend/lib/api.ts
import axios from 'axios';
import type { Timeline, ChatResponse, UploadVideoResult, UploadAudioResult, ChatMessage } from '@/types/timeline';

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
```

- [ ] **Create `lib/validation.ts`**

```ts
// frontend/lib/validation.ts
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

export async function extractVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const timer = setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const ms = Math.round(video.duration * 1000);
      URL.revokeObjectURL(url);
      resolve(isFinite(ms) ? ms : null);
    };
    video.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}

export async function extractVideoMeta(file: File): Promise<{ durationMs: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const timer = setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ durationMs: Math.round(video.duration * 1000), width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}
```

- [ ] **Create `lib/format.ts`**

```ts
// frontend/lib/format.ts
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function detectMessageStatus(text: string): 'success' | 'warning' | 'error' {
  const lower = text.toLowerCase();
  if (/can't|cannot|unable|failed|not supported|doesn't exist|does not exist|no .* found/.test(lower))
    return 'error';
  if (/though|however|may|note that|careful|might|warning|brief|short|overlap/.test(lower))
    return 'warning';
  return 'success';
}

export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
```

- [ ] **Add `.env.local` to frontend**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Task 3: Toast System

**Files:**
- Create: `frontend/components/Toast/ToastProvider.tsx`

- [ ] **Create `ToastProvider.tsx`**

```tsx
// frontend/components/Toast/ToastProvider.tsx
'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { X } from 'lucide-react';

type ToastVariant = 'success' | 'warning' | 'error';
interface Toast { id: string; message: string; variant: ToastVariant; }

interface ToastCtx { toast: (message: string, variant?: ToastVariant) => void; }
const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

const borderColor: Record<ToastVariant, string> = {
  success: 'border-status-success',
  warning: 'border-status-warning',
  error:   'border-status-error',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)),
      variant === 'error' ? 5000 : 3000);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-3 bg-bg-elevated border-l-4 ${borderColor[t.variant]} rounded px-4 py-3 text-cream text-sm max-w-xs shadow-lg`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-cream-muted hover:text-cream mt-0.5">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Wrap root layout in ToastProvider**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast/ToastProvider";

export const metadata: Metadata = {
  title: "Video Timeline Editor",
  description: "AI-powered video timeline editing through natural language",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
```

---

## Task 4: App Root — Stage Machine

**Files:**
- Replace: `frontend/app/page.tsx`

- [ ] **Replace `page.tsx` with stage machine (stub children for now)**

```tsx
// frontend/app/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { getTimeline } from '@/lib/api';
import type { AppStage, Timeline } from '@/types/timeline';
import { OnboardingScreen } from '@/components/Onboarding/OnboardingScreen';
import { UploadScreen } from '@/components/Upload/UploadScreen';
import { EditorLayout } from '@/components/Editor/EditorLayout';

export default function Home() {
  const [stage, setStage] = useState<AppStage | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    getTimeline().then((tl) => {
      setTimeline(tl);
      if (tl.video_src) {
        setStage('editor');
      } else if (localStorage.getItem('seen_onboarding')) {
        setStage('upload');
      } else {
        setStage('onboarding');
      }
    }).catch(() => setStage('onboarding'));
  }, []);

  if (!stage) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const advanceToUpload = () => {
    localStorage.setItem('seen_onboarding', '1');
    setStage('upload');
  };

  const advanceToEditor = (tl: Timeline) => {
    setTimeline(tl);
    setStage('editor');
  };

  return (
    <>
      {stage === 'onboarding' && <OnboardingScreen onComplete={advanceToUpload} />}
      {stage === 'upload' && <UploadScreen onComplete={advanceToEditor} />}
      {stage === 'editor' && timeline && (
        <EditorLayout initialTimeline={timeline} onTimelineChange={setTimeline} />
      )}
    </>
  );
}
```

---

## Task 5: Onboarding Screen

**Files:**
- Create: `frontend/components/Onboarding/OnboardingScreen.tsx`

- [ ] **Create `OnboardingScreen.tsx`**

```tsx
// frontend/components/Onboarding/OnboardingScreen.tsx
'use client';
import { ArrowRight, Check, X } from 'lucide-react';

const CAN = [
  'Add, edit, and delete subtitle cues with custom text, timing, and style',
  'Add, edit, and delete music tracks with volume and fade control',
  'Use natural language: "make it bigger", "move it earlier", "lower the music"',
  'See all changes reflected live in the preview player instantly',
  'Upload a video and music files to use as the timeline source',
];

const CANNOT = [
  'Edit, reorder, or trim video clips — clip editing is not supported',
  'Upload files via chat — use the upload buttons in the player panel',
  'Undo or redo changes — edits are permanent once confirmed',
  'Bulk operations like "delete all subtitles before 10 seconds"',
  'Export or download the final video — not in this version',
];

const EXAMPLES = [
  "Add a subtitle saying 'And we're live!' from 10s to 13s",
  'Lower the background music volume to 30%',
  'Add a 3 second fade out to the music',
  'Change the first subtitle to say "Hello everyone"',
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold text-cream mb-2">Video Timeline Editor</h1>
          <p className="text-cream-muted text-sm">AI-powered editing through natural language</p>
        </div>

        {/* Can / Cannot cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="bg-bg-surface border-l-4 border-status-success rounded-lg p-5">
            <h2 className="text-cream text-sm font-semibold mb-4">What I can do</h2>
            <ul className="space-y-3">
              {CAN.map((item) => (
                <li key={item} className="flex gap-3 text-cream-muted text-sm">
                  <Check size={15} className="text-status-success shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-bg-surface border-l-4 border-status-error rounded-lg p-5">
            <h2 className="text-cream text-sm font-semibold mb-4">What I can't do</h2>
            <ul className="space-y-3">
              {CANNOT.map((item) => (
                <li key={item} className="flex gap-3 text-cream-muted text-sm">
                  <X size={15} className="text-status-error shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Example commands */}
        <div className="mb-10">
          <p className="text-cream-muted text-xs uppercase tracking-widest mb-3">Example commands you can try</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <span key={ex}
                className="bg-bg-elevated text-cream-muted text-xs px-3 py-1.5 rounded-full border border-cream-subtle">
                {ex}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-bg-primary text-sm font-semibold px-6 py-3 rounded-lg transition-all hover:scale-105 active:scale-95">
            Start Editing
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Verify:** navigate to `localhost:3000` (clear localStorage first), onboarding screen should render. Click "Start Editing" — should advance to upload stage (blank for now).

---

## Task 6: Upload Screen

**Files:**
- Create: `frontend/components/Upload/Dropzone.tsx`
- Create: `frontend/components/Upload/AudioCard.tsx`
- Create: `frontend/components/Upload/UploadScreen.tsx`

- [ ] **Create `Dropzone.tsx`**

```tsx
// frontend/components/Upload/Dropzone.tsx
'use client';
import { useRef, useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type DropzoneState = 'idle' | 'dragover' | 'validating' | 'uploading' | 'success' | 'error';

interface Props {
  accept: string;
  label: string;
  hint: string;
  state: DropzoneState;
  progress?: number;
  error?: string;
  successLabel?: string;
  onFiles: (files: FileList) => void;
  multiple?: boolean;
}

export function Dropzone({ accept, label, hint, state, progress, error, successLabel, onFiles, multiple }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const borderClass =
    state === 'success' ? 'border-status-success' :
    state === 'error'   ? 'border-status-error' :
    dragging            ? 'border-accent' :
                          'border-cream-subtle';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        className={`relative border-2 border-dashed ${borderClass} rounded-lg p-8 transition-all cursor-pointer bg-bg-elevated hover:bg-bg-hover`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        tabIndex={0}
        role="button"
        aria-label={label}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          {state === 'validating' || state === 'uploading' ? (
            <Loader2 size={24} className="text-accent animate-spin" />
          ) : state === 'success' ? (
            <CheckCircle size={24} className="text-status-success" />
          ) : state === 'error' ? (
            <AlertCircle size={24} className="text-status-error" />
          ) : (
            <Upload size={24} className="text-cream-muted" />
          )}

          <div>
            <p className="text-cream text-sm font-medium">
              {state === 'validating' ? 'Checking file…' :
               state === 'uploading' ? `Uploading… ${progress ?? 0}%` :
               state === 'success' && successLabel ? successLabel :
               label}
            </p>
            <p className="text-cream-muted text-xs mt-1">{hint}</p>
          </div>
        </div>

        {/* progress bar */}
        {state === 'uploading' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-bg-hover rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
        )}
      </div>

      {state === 'error' && error && (
        <p className="text-status-error text-xs mt-2 ml-1">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Create `AudioCard.tsx`**

```tsx
// frontend/components/Upload/AudioCard.tsx
import { Music, X } from 'lucide-react';

interface Props {
  filename: string;
  onRemove: () => void;
}

export function AudioCard({ filename, onRemove }: Props) {
  return (
    <div className="flex items-center gap-3 bg-bg-elevated border border-cream-subtle rounded-lg px-4 py-3">
      <Music size={16} className="text-accent shrink-0" />
      <span className="text-cream text-sm flex-1 truncate">{filename}</span>
      <button
        onClick={onRemove}
        className="text-cream-muted hover:text-cream transition-colors"
        aria-label={`Remove ${filename}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Create `UploadScreen.tsx`**

```tsx
// frontend/components/Upload/UploadScreen.tsx
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
type AState = 'idle' | 'validating' | 'uploading' | 'error';

interface AudioEntry { file: File; state: AState; error?: string; progress?: number; }

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

    // multiple video warning
    if (files.length > 1) toast('Only one video supported. Using the first file.', 'warning');

    setVideoState('validating');
    setVideoError(undefined);

    const validation = validateVideoFile(file);
    if (!validation.ok) {
      setVideoState('error');
      setVideoError(validation.error);
      return;
    }

    const meta = await extractVideoMeta(file);
    if (!meta) {
      setVideoState('error');
      setVideoError("Couldn't read video metadata — file may be corrupted.");
      return;
    }

    if (meta.durationMs > 10 * 60 * 1000) {
      toast('Video is over 10 minutes — this may affect performance.', 'warning');
    }

    setVideoState('uploading');
    try {
      const result = await uploadVideo(file, meta.durationMs, setVideoProgress);
      setVideoLabel(`${file.name}  ·  ${meta.width}×${meta.height}`);
      setVideoState('success');
      setFinalTimeline(result.timeline);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed — check your connection and try again.';
      setVideoState('error');
      setVideoError(msg);
    }
  };

  const handleAudioFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const validation = validateAudioFile(file, audioEntries.map((e) => e.file));
      if (!validation.ok) {
        toast(validation.error!, 'error');
        continue;
      }

      const entry: AudioEntry = { file, state: 'uploading', progress: 0 };
      setAudioEntries((prev) => [...prev, entry]);

      try {
        const result = await uploadAudio(file, (pct) => {
          setAudioEntries((prev) =>
            prev.map((e) => e.file.name === file.name ? { ...e, progress: pct } : e)
          );
        });
        setAudioEntries((prev) =>
          prev.map((e) => e.file.name === file.name ? { ...e, state: 'idle' } : e)
        );
        if (result.attached_to) {
          toast(`"${file.name}" attached to music track.`, 'success');
        } else {
          toast(`"${file.name}" uploaded. Say "add a music track" in chat to use it.`, 'warning');
        }
        // keep latest timeline
        setFinalTimeline(result.timeline);
      } catch {
        setAudioEntries((prev) =>
          prev.map((e) => e.file.name === file.name ? { ...e, state: 'error', error: 'Upload failed' } : e)
        );
      }
    }
  };

  const removeAudio = (name: string) => setAudioEntries((prev) => prev.filter((e) => e.file.name !== name));

  const audioUploading = audioEntries.some((e) => e.state === 'uploading');
  const canContinue = videoState === 'success' && !audioUploading && finalTimeline;

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* header */}
      <div className="h-12 border-b border-cream-subtle flex items-center px-6">
        <span className="text-cream text-sm font-semibold">Video Timeline Editor</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <h2 className="text-cream text-lg font-semibold mb-1">Upload your media</h2>
          <p className="text-cream-muted text-sm mb-8">Add a video to get started. Music is optional — you can add it later via chat.</p>

          {/* Video */}
          <div className="mb-6">
            <p className="text-cream-muted text-xs uppercase tracking-widest mb-2">Video <span className="text-status-error">required</span></p>
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

          {/* Audio */}
          <div className="mb-8">
            <p className="text-cream-muted text-xs uppercase tracking-widest mb-2">Music <span className="text-cream-subtle">optional · up to 3 tracks</span></p>
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

          {/* Continue */}
          <button
            disabled={!canContinue}
            onClick={() => finalTimeline && onComplete(finalTimeline)}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-bg-primary text-sm font-semibold px-6 py-3 rounded-lg transition-all hover:enabled:scale-[1.01] active:enabled:scale-[0.99]"
          >
            {audioUploading ? 'Uploading audio… please wait' : 'Continue to Editor →'}
            {!audioUploading && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Verify:** Upload screen renders, video dropzone accepts `.mp4`, rejects `.mp3` with error message. Continue button disabled until video uploaded successfully.

---

## Task 7: Editor Layout + Header

**Files:**
- Create: `frontend/components/Editor/EditorLayout.tsx`

- [ ] **Create `EditorLayout.tsx`**

```tsx
// frontend/components/Editor/EditorLayout.tsx
'use client';
import { useState } from 'react';
import type { Timeline } from '@/types/timeline';
import { ChatPanel } from './Chat/ChatPanel';
import { PlayerPanel } from './Player/PlayerPanel';

interface Props {
  initialTimeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function EditorLayout({ initialTimeline, onTimelineChange }: Props) {
  const [timeline, setTimeline] = useState<Timeline>(initialTimeline);

  const handleTimelineChange = (tl: Timeline) => {
    setTimeline(tl);
    onTimelineChange(tl);
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-cream-subtle flex items-center justify-between px-6 bg-bg-surface shrink-0">
        <span className="text-cream text-sm font-semibold">Video Timeline Editor</span>
        <span className="text-cream-muted text-xs font-mono">{timeline.name}</span>
        <div className="flex items-center gap-4 text-cream-muted text-xs font-mono">
          <span>Sub: {timeline.subtitles.length}</span>
          <span>Music: {timeline.music.length}</span>
        </div>
      </div>

      {/* Two-column split */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[40%] min-w-[320px] border-r border-cream-subtle flex flex-col">
          <ChatPanel timeline={timeline} onTimelineChange={handleTimelineChange} />
        </div>
        <div className="flex-1 flex flex-col">
          <PlayerPanel timeline={timeline} onTimelineChange={handleTimelineChange} />
        </div>
      </div>
    </div>
  );
}
```

---

## Task 8: Chat Components

**Files:**
- Create: `frontend/components/Editor/Chat/TypingIndicator.tsx`
- Create: `frontend/components/Editor/Chat/MessageBubble.tsx`
- Create: `frontend/components/Editor/Chat/SuggestionChips.tsx`
- Create: `frontend/components/Editor/Chat/MessageList.tsx`
- Create: `frontend/components/Editor/Chat/ChatInput.tsx`
- Create: `frontend/components/Editor/Chat/ChatPanel.tsx`

- [ ] **Create `TypingIndicator.tsx`**

```tsx
// frontend/components/Editor/Chat/TypingIndicator.tsx
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-bg-elevated rounded-xl rounded-tl-sm w-fit border-l-4 border-cream-subtle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-cream-muted animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Create `MessageBubble.tsx`**

```tsx
// frontend/components/Editor/Chat/MessageBubble.tsx
import type { ChatMessage } from '@/types/timeline';

const statusBorder: Record<string, string> = {
  success: 'border-l-status-success',
  warning: 'border-l-status-warning',
  error:   'border-l-status-error',
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-bubble-user text-cream rounded-tr-sm'
              : `bg-bg-elevated text-cream rounded-tl-sm border-l-4 ${statusBorder[message.status ?? 'success']}`
          }`}
        >
          {message.content}
        </div>
        <span className="text-cream-muted text-[11px] font-mono px-1">{message.timestamp}</span>
      </div>
    </div>
  );
}
```

- [ ] **Create `SuggestionChips.tsx`**

```tsx
// frontend/components/Editor/Chat/SuggestionChips.tsx
const SUGGESTIONS = [
  'Add a subtitle saying "And we\'re live!" from 10s to 13s',
  'Lower the background music volume to 30%',
  'Add a 3 second fade out to the music',
  'Delete the second subtitle',
];

export function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="px-4 py-3">
      <p className="text-cream-muted text-xs mb-2">Try one of these to get started:</p>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-left text-xs text-cream-muted bg-bg-elevated hover:bg-bg-hover border border-cream-subtle rounded-lg px-3 py-2 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Create `MessageList.tsx`**

```tsx
// frontend/components/Editor/Chat/MessageList.tsx
'use client';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types/timeline';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { SuggestionChips } from './SuggestionChips';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  showSuggestions: boolean;
  onSuggestionSelect: (text: string) => void;
}

export function MessageList({ messages, isLoading, showSuggestions, onSuggestionSelect }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      {showSuggestions && messages.length === 0 && (
        <SuggestionChips onSelect={onSuggestionSelect} />
      )}
      {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
      {isLoading && (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Create `ChatInput.tsx`**

```tsx
// frontend/components/Editor/Chat/ChatInput.tsx
'use client';
import { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export function ChatInput({ disabled, onSend, prefill, onPrefillConsumed }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // consume prefill from suggestion chips
  if (prefill && value !== prefill) {
    setValue(prefill);
    onPrefillConsumed?.();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  return (
    <div className="border-t border-cream-subtle p-3 flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Describe what you want to edit…"
        rows={1}
        aria-label="Chat message input"
        className="flex-1 bg-bg-elevated text-cream text-sm placeholder:text-cream-subtle border border-cream-subtle rounded-lg px-3 py-2 resize-none outline-none focus:border-accent transition-colors disabled:opacity-40 min-h-[44px] max-h-[140px] overflow-y-auto"
      />
      <button
        onClick={send}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="w-9 h-9 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:enabled:scale-105 active:enabled:scale-95 shrink-0"
      >
        <ArrowUp size={16} className="text-bg-primary" />
      </button>
    </div>
  );
}
```

- [ ] **Create `ChatPanel.tsx` with `useChat` hook inline**

```tsx
// frontend/components/Editor/Chat/ChatPanel.tsx
'use client';
import { useState, useRef } from 'react';
import { sendChat } from '@/lib/api';
import { detectMessageStatus, nanoid } from '@/lib/format';
import type { ChatMessage, Timeline } from '@/types/timeline';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useToast } from '@/components/Toast/ToastProvider';

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function ChatPanel({ timeline, onTimelineChange }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [prefill, setPrefill] = useState<string | undefined>();
  const queueRef = useRef<string[]>([]);

  const appendMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) =>
    setMessages((prev) => [...prev, { ...msg, id: nanoid(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);

  const processMessage = async (text: string, history: ChatMessage[]) => {
    setIsLoading(true);
    try {
      const apiHistory = history
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChat(text, apiHistory);
      const status = detectMessageStatus(res.response);
      appendMessage({ role: 'assistant', content: res.response || "Something went wrong — please try again.", status });
      onTimelineChange(res.timeline);
    } catch {
      appendMessage({ role: 'assistant', content: "Couldn't reach the server. Check your connection.", status: 'error' });
      toast('Server error — check your connection', 'error');
    } finally {
      setIsLoading(false);
      // drain queue
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        appendMessage({ role: 'user', content: next });
        setMessages((prev) => {
          processMessage(next, prev);
          return prev;
        });
      }
    }
  };

  const sendMessage = (text: string) => {
    if (isLoading) {
      queueRef.current.push(text);
      return;
    }
    appendMessage({ role: 'user', content: text });
    setMessages((prev) => {
      processMessage(text, prev);
      return prev;
    });
  };

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Panel header */}
      <div className="h-10 border-b border-cream-subtle flex items-center justify-between px-4 shrink-0">
        <span className="text-cream text-xs font-semibold">Chat Lab</span>
        {queueRef.current.length > 0 && (
          <span className="text-cream-muted text-[11px] bg-bg-elevated px-2 py-0.5 rounded-full">
            {queueRef.current.length} queued
          </span>
        )}
      </div>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        showSuggestions
        onSuggestionSelect={(t) => setPrefill(t)}
      />

      <ChatInput
        disabled={isLoading}
        onSend={sendMessage}
        prefill={prefill}
        onPrefillConsumed={() => setPrefill(undefined)}
      />
    </div>
  );
}
```

- [ ] **Verify:** Run app, enter editor stage. Chat panel renders with suggestion chips. Click a chip — pre-fills input. Type and send — user bubble appears, typing indicator shows, agent response arrives with coloured left border.

---

## Task 9: Player Controls + Video Container

**Files:**
- Create: `frontend/components/Editor/Player/PlayerControls.tsx`
- Create: `frontend/components/Editor/Player/SubtitleOverlay.tsx`
- Create: `frontend/components/Editor/Player/VideoContainer.tsx`

- [ ] **Create `PlayerControls.tsx`**

```tsx
// frontend/components/Editor/Player/PlayerControls.tsx
import { Play, Pause } from 'lucide-react';
import { formatTime } from '@/lib/format';

interface Props {
  isPlaying: boolean;
  currentMs: number;
  durationMs: number;
  onPlayPause: () => void;
  onSeek: (ms: number) => void;
}

export function PlayerControls({ isPlaying, currentMs, durationMs, onPlayPause, onSeek }: Props) {
  const pct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;

  return (
    <div className="h-14 border-t border-cream-subtle flex items-center gap-3 px-4 bg-bg-surface shrink-0">
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="text-cream hover:text-accent transition-colors shrink-0"
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>

      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={durationMs}
          value={currentMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1"
          style={{
            background: `linear-gradient(to right, #C8B89A ${pct}%, #1C1C1C ${pct}%)`,
          }}
          aria-label="Seek"
        />
        <span className="text-cream-muted text-xs font-mono whitespace-nowrap shrink-0">
          {formatTime(currentMs)} / {formatTime(durationMs)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Create `SubtitleOverlay.tsx`**

```tsx
// frontend/components/Editor/Player/SubtitleOverlay.tsx
import type { SubtitleCue } from '@/types/timeline';

const TOLERANCE_MS = 50;

const positionStyle: Record<string, React.CSSProperties> = {
  bottom: { bottom: '8%', left: '50%', transform: 'translateX(-50%)' },
  top:    { top: '8%',    left: '50%', transform: 'translateX(-50%)' },
  center: { top: '50%',  left: '50%', transform: 'translate(-50%, -50%)' },
};

interface Props {
  subtitles: SubtitleCue[];
  currentMs: number;
}

export function SubtitleOverlay({ subtitles, currentMs }: Props) {
  const active = subtitles.filter(
    (s) => currentMs >= s.start_ms - TOLERANCE_MS && currentMs <= s.end_ms + TOLERANCE_MS
  );

  if (active.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {active.map((s, i) => (
        <p
          key={s.id}
          className="absolute text-center font-semibold leading-snug max-w-[80%]"
          style={{
            ...positionStyle[s.style.position],
            fontSize: s.style.font_size,
            color: s.style.color,
            textShadow: '0 1px 6px rgba(0,0,0,0.85)',
            marginBottom: i > 0 ? `${i * (s.style.font_size + 8)}px` : 0,
          }}
        >
          {s.text}
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Create `VideoContainer.tsx`**

```tsx
// frontend/components/Editor/Player/VideoContainer.tsx
'use client';
import { useEffect, useState, forwardRef } from 'react';
import type { SubtitleCue } from '@/types/timeline';
import { SubtitleOverlay } from './SubtitleOverlay';

interface Props {
  videoSrc: string;
  subtitles: SubtitleCue[];
  currentMs: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onMetadata: (durationMs: number, aspectRatio: number) => void;
}

export function VideoContainer({ videoSrc, subtitles, currentMs, videoRef, onMetadata }: Props) {
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const handler = () => {
      const ms = Math.round(el.duration * 1000);
      const ar = el.videoWidth > 0 ? el.videoWidth / el.videoHeight : 16 / 9;
      setAspectRatio(ar);
      onMetadata(ms, ar);
    };
    el.addEventListener('loadedmetadata', handler);
    return () => el.removeEventListener('loadedmetadata', handler);
  }, [videoRef, onMetadata]);

  if (!videoSrc) {
    return (
      <div
        className="w-full border-2 border-dashed border-cream-subtle rounded-lg flex items-center justify-center text-cream-muted text-sm"
        style={{ aspectRatio: '16/9' }}
      >
        Upload a video to get started
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: String(aspectRatio) }}>
      <video
        ref={videoRef}
        src={videoSrc}
        className="w-full h-full object-contain bg-black rounded-lg"
        aria-label="Timeline preview"
      />
      <SubtitleOverlay subtitles={subtitles} currentMs={currentMs} />
    </div>
  );
}
```

---

## Task 10: Music Engine

**Files:**
- Create: `frontend/components/Editor/Player/MusicEngine.tsx`

- [ ] **Create `MusicEngine.tsx`**

```tsx
// frontend/components/Editor/Player/MusicEngine.tsx
'use client';
import { useEffect, useRef } from 'react';
import type { MusicTrack } from '@/types/timeline';

interface Props {
  tracks: MusicTrack[];
  currentMs: number;
  isPlaying: boolean;
}

interface AudioNode_ {
  source: AudioBufferSourceNode;
  gain: GainNode;
  trackId: string;
}

export function MusicEngine({ tracks, currentMs, isPlaying }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode_[]>([]);
  const tracksRef = useRef<MusicTrack[]>(tracks);
  const currentMsRef = useRef(currentMs);
  const isPlayingRef = useRef(isPlaying);

  // Keep refs in sync
  useEffect(() => { currentMsRef.current = currentMs; }, [currentMs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const tearDown = () => {
    nodesRef.current.forEach(({ source }) => {
      try { source.stop(); } catch {}
    });
    nodesRef.current = [];
  };

  const buildGraph = async (posMs: number) => {
    tearDown();
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    for (const track of tracksRef.current) {
      if (!track.src) continue;
      if (posMs >= track.end_ms || posMs < track.start_ms - track.fade_in_ms) continue;

      let buffer: AudioBuffer;
      try {
        const res = await fetch(track.src);
        const data = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(data);
      } catch { continue; }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);

      const nowCtx = ctx.currentTime;
      const offsetSec = Math.max(0, (posMs - track.start_ms) / 1000);
      const durationSec = (track.end_ms - track.start_ms) / 1000 - offsetSec;
      if (durationSec <= 0) continue;

      // fade in
      const fadeInSec = track.fade_in_ms / 1000;
      const elapsed = offsetSec; // how far into the track we already are
      if (elapsed < fadeInSec) {
        const startVol = (elapsed / fadeInSec) * track.volume;
        gain.gain.setValueAtTime(startVol, nowCtx);
        gain.gain.linearRampToValueAtTime(track.volume, nowCtx + (fadeInSec - elapsed));
      } else {
        gain.gain.setValueAtTime(track.volume, nowCtx);
      }

      // fade out
      const fadeOutSec = track.fade_out_ms / 1000;
      const trackDurSec = (track.end_ms - track.start_ms) / 1000;
      const fadeOutStart = trackDurSec - fadeOutSec - offsetSec;
      if (fadeOutStart > 0) {
        gain.gain.setValueAtTime(track.volume, nowCtx + fadeOutStart);
        gain.gain.linearRampToValueAtTime(0, nowCtx + durationSec);
      }

      source.start(0, offsetSec, durationSec);
      nodesRef.current.push({ source, gain, trackId: track.id });
    }
  };

  // Rebuild graph when tracks change (after chat action)
  useEffect(() => {
    tracksRef.current = tracks;
    if (isPlayingRef.current) {
      buildGraph(currentMsRef.current);
    }
  }, [tracks]);

  // Play / pause
  useEffect(() => {
    if (isPlaying) {
      buildGraph(currentMs);
    } else {
      ctxRef.current?.suspend();
    }
  }, [isPlaying]);

  // Seek — rebuild at new position if playing
  useEffect(() => {
    if (isPlayingRef.current) {
      buildGraph(currentMs);
    }
  }, [currentMs]);

  // Cleanup on unmount
  useEffect(() => () => {
    tearDown();
    ctxRef.current?.close();
  }, []);

  return null;
}
```

---

## Task 11: Upload Section + Timeline Info Bar + Player Panel

**Files:**
- Create: `frontend/components/Editor/Player/UploadSection.tsx`
- Create: `frontend/components/Editor/Player/TimelineInfoBar.tsx`
- Create: `frontend/components/Editor/Player/PlayerPanel.tsx`

- [ ] **Create `UploadSection.tsx`**

```tsx
// frontend/components/Editor/Player/UploadSection.tsx
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
        toast('All tracks already have files — add a track via chat first.', 'warning');
      }
    } catch {
      toast('Audio upload failed. Try again.', 'error');
    } finally { setAudioProgress(null); e.target.value = ''; }
  };

  return (
    <div className="flex gap-3 px-4 py-3 border-t border-cream-subtle bg-bg-surface shrink-0">
      <input ref={videoInputRef} type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={handleVideo} />
      <input ref={audioInputRef} type="file" accept=".mp3,.wav,.aac" className="hidden" onChange={handleAudio} />

      {[
        { label: timeline.video_src ? 'Replace Video' : 'Upload Video', ref: videoInputRef, progress: videoProgress },
        { label: 'Upload Music', ref: audioInputRef, progress: audioProgress },
      ].map(({ label, ref, progress }) => (
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
```

- [ ] **Create `TimelineInfoBar.tsx`**

```tsx
// frontend/components/Editor/Player/TimelineInfoBar.tsx
import type { Timeline } from '@/types/timeline';

export function TimelineInfoBar({ timeline }: { timeline: Timeline }) {
  return (
    <div className="h-8 border-t border-cream-subtle flex items-center gap-4 px-4 bg-bg-surface shrink-0">
      <span className="text-cream-muted text-[11px] font-mono">
        Subtitles: {timeline.subtitles.length}
      </span>
      <span className="text-cream-subtle text-[11px]">·</span>
      <span className="text-cream-muted text-[11px] font-mono">
        Music: {timeline.music.length}
      </span>
      <span className="text-cream-subtle text-[11px]">·</span>
      <span className="text-cream-muted text-[11px] font-mono">
        {Math.round(timeline.duration_ms / 1000)}s
      </span>
    </div>
  );
}
```

- [ ] **Create `PlayerPanel.tsx`**

```tsx
// frontend/components/Editor/Player/PlayerPanel.tsx
'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import type { Timeline } from '@/types/timeline';
import { VideoContainer } from './VideoContainer';
import { MusicEngine } from './MusicEngine';
import { PlayerControls } from './PlayerControls';
import { UploadSection } from './UploadSection';
import { TimelineInfoBar } from './TimelineInfoBar';

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

export function PlayerPanel({ timeline, onTimelineChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(timeline.duration_ms);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync currentMs from video timeupdate
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const update = () => setCurrentMs(Math.round(el.currentTime * 1000));
    const ended = () => setIsPlaying(false);
    el.addEventListener('timeupdate', update);
    el.addEventListener('ended', ended);
    return () => { el.removeEventListener('timeupdate', update); el.removeEventListener('ended', ended); };
  }, []);

  // When timeline video_src changes, reload video
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !timeline.video_src) return;
    const fullUrl = timeline.video_src.startsWith('http')
      ? timeline.video_src
      : `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}${timeline.video_src}`;
    if (el.src !== fullUrl) {
      el.src = fullUrl;
      el.load();
      setCurrentMs(0);
      setIsPlaying(false);
    }
  }, [timeline.video_src]);

  const onMetadata = useCallback((dur: number) => {
    setDurationMs(dur);
  }, []);

  const playPause = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      await el.play();
      setIsPlaying(true);
    }
  };

  const seek = (ms: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    setCurrentMs(ms);
  };

  const videoUrl = timeline.video_src
    ? (timeline.video_src.startsWith('http')
        ? timeline.video_src
        : `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}${timeline.video_src}`)
    : '';

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Video area — flex-1 to fill remaining space */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div className="w-full max-h-full">
          <VideoContainer
            videoSrc={videoUrl}
            subtitles={timeline.subtitles}
            currentMs={currentMs}
            videoRef={videoRef}
            onMetadata={onMetadata}
          />
        </div>
      </div>

      <MusicEngine
        tracks={timeline.music}
        currentMs={currentMs}
        isPlaying={isPlaying}
      />

      <PlayerControls
        isPlaying={isPlaying}
        currentMs={currentMs}
        durationMs={durationMs}
        onPlayPause={playPause}
        onSeek={seek}
      />

      <UploadSection timeline={timeline} onTimelineChange={onTimelineChange} />
      <TimelineInfoBar timeline={timeline} />
    </div>
  );
}
```

- [ ] **Verify end-to-end:**
  1. Run backend: `cd backend && source .venv/bin/activate && uvicorn main:app --port 8000 --reload`
  2. Run frontend: `cd frontend && npm run dev`
  3. Open `http://localhost:3000`
  4. Onboarding → upload a `.mp4` → editor loads
  5. Subtitles appear at correct timestamps during playback
  6. Chat: "Lower the background music volume to 30%" → `Music: 1` stays, agent confirms
  7. Chat: "Add a subtitle saying 'Hello' from 5 to 8 seconds" → subtitle appears in player at 5s
  8. Chat: "Delete the second subtitle" → subtitle disappears from player

---

## Task 12: Add `.env.local` + Final Check

- [ ] **Create `frontend/.env.local`**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

- [ ] **Fix Next.js `next.config.js` to allow external image domains (if needed)**

If any `<Image>` components are used, add domain config. Since we removed the default Next.js `<Image>` usage, this can be skipped.

- [ ] **Commit everything**

```bash
cd /Users/soumya/Desktop/Projects/craon-assignment
git init
git add frontend/ docs/
git commit -m "feat: complete frontend — onboarding, upload, Chat Lab editor with live player"
```

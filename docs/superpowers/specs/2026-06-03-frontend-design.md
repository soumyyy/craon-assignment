# Frontend Spec — Video Timeline Editor

**Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS  
**Dependencies:** axios · lucide-react  
**Date:** 2026-06-03

---

## 1. App Stages

The app has exactly 3 stages, managed in root state. Stage advances are one-way (no going back mid-session):

```
onboarding → upload → editor
```

| Stage | Condition | Persisted |
|---|---|---|
| `onboarding` | First visit ever | `localStorage: "seen_onboarding"` flag |
| `upload` | Onboarding dismissed, no video uploaded yet | Timeline `video_src` is empty |
| `editor` | Video successfully uploaded | Timeline `video_src` is set |

On page load: fetch timeline from `GET /timeline`. If `video_src` is set, skip to `editor`. If `localStorage` flag is set, skip to `upload`. Otherwise start at `onboarding`.

---

## 2. Colour Scheme (Tailwind Config)

All custom tokens wired into `tailwind.config.ts`:

```ts
colors: {
  bg: {
    primary:  '#0A0A0A',   // app background
    surface:  '#141414',   // panels
    elevated: '#1C1C1C',   // cards, bubbles, inputs
    hover:    '#242424',   // hover states
  },
  cream: {
    DEFAULT: '#F5F0E8',    // primary text
    muted:   '#A89F8C',    // timestamps, labels
    subtle:  '#4A4540',    // borders, dividers, placeholder
  },
  accent: {
    DEFAULT: '#C8B89A',    // active elements, send button, focus ring
    hover:   '#D4C4A8',
  },
  bubble: {
    user:    '#2A2520',    // user chat message bg
  },
  status: {
    success: '#4A7C59',
    warning: '#8A6A2A',
    error:   '#7A3A3A',
  },
}

fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
}
```

Global CSS additions to `globals.css`:
- `body { background: #0A0A0A; color: #F5F0E8; }`
- Custom scrollbar: `2px` wide, `#4A4540` track, `#C8B89A` thumb
- Focus ring: `outline: 2px solid #C8B89A; outline-offset: 2px`
- All transitions: `transition: all 150ms ease`

---

## 3. Stage 1 — Onboarding Screen

### Purpose
First-time disclaimer that sets expectations before the user touches anything.

### Layout
Full-screen centered, `bg-bg-primary`. Single scroll on mobile, fits viewport on desktop.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         Video Timeline Editor                       │
│   AI-powered editing through natural language       │
│                                                     │
│  ┌─────────────────┐   ┌─────────────────────────┐ │
│  │  ✓ What I can   │   │  ✗ What I can't do      │ │
│  │    do           │   │                         │ │
│  │                 │   │                         │ │
│  └─────────────────┘   └─────────────────────────┘ │
│                                                     │
│         Example commands you can try                │
│  ┌──────────────────────────────────────────────┐  │
│  │  "Add a subtitle saying '...' from 10s–13s"  │  │
│  │  "Lower the background music to 30%"         │  │
│  │  "Delete the second subtitle"                │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│              [ Start Editing → ]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Can / Cannot Cards

**Can do (left card — `status-success` left border):**
- Add, edit, and delete subtitle cues with custom text, timing, and style
- Add, edit, and delete music tracks with volume and fade control
- Use natural language: "make it bigger", "move it earlier", "lower the music"
- See all changes reflected live in the preview player
- Upload a video and music files to use as the timeline source

**Cannot do (right card — `status-error` left border):**
- Edit, reorder, or trim video clips (clip editing is not supported)
- Upload files via the chat — use the upload buttons in the player panel
- Undo or redo changes (changes are permanent once confirmed)
- Bulk operations like "delete all subtitles before 10 seconds"
- Export or download the final video (not in this version)

### Example Commands
3 pill-shaped tags in `bg-elevated`, `cream-muted` text — visual hint of what to type:
- *"Add a subtitle saying 'And we're live!' from 10s to 13s at the bottom"*
- *"Lower the background music volume to 30%"*
- *"Add a 3 second fade out to the music"*

### CTA
- Primary button: `"Start Editing →"` — filled `accent`, `bg-primary` text, `8px` radius
- Hover: `accent-hover`, `scale(1.02)` transform
- On click: set `localStorage.setItem("seen_onboarding", "1")`, advance to `upload` stage

### Return visits
If `localStorage` has the flag, this screen is skipped entirely on load.

---

## 4. Stage 2 — Upload Screen

### Purpose
Collect the video (required) and audio file(s) (optional) before entering the editor. Validates files client-side before uploading.

### Layout
```
┌─────────────────────────────────────────────────────┐
│  Video Timeline Editor                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Upload your media to get started                  │
│   ─────────────────────────────────────             │
│                                                     │
│   VIDEO (required)                                  │
│   ┌─────────────────────────────────────────────┐  │
│   │                                             │  │
│   │   ↑  Drag & drop or click to upload        │  │
│   │      MP4, MOV, WEBM · Max 500 MB            │  │
│   │                                             │  │
│   └─────────────────────────────────────────────┘  │
│                                                     │
│   MUSIC / AUDIO  (optional — add up to 3 tracks)   │
│   ┌─────────────────────────────────────────────┐  │
│   │                                             │  │
│   │   ↑  Drag & drop or click to upload        │  │
│   │      MP3, WAV, AAC · Max 50 MB per file     │  │
│   │                                             │  │
│   └─────────────────────────────────────────────┘  │
│                                                     │
│              [ Continue to Editor → ]               │
│         (disabled until video uploaded)             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Video Dropzone — States

| State | Visual |
|---|---|
| Idle | Dashed `cream-subtle` border, upload icon, label text |
| Drag over | `accent` dashed border, `bg-elevated` bg brightens |
| Validating | Spinner + "Checking file..." |
| Validation error | `status-error` border, red error message below zone |
| Uploading | Progress bar fills across zone bottom, `"Uploading… 64%"` |
| Upload error | `status-error` border, error message, retry button |
| Success | `status-success` border, video thumbnail (first frame via `<canvas>`), filename, duration, resolution pill |

**Post-success video card:**
```
┌─────────────────────────────────────────┐
│  [thumbnail]  intro.mp4                 │
│               1920 × 1080 · 1:32        │
│                                [✕ Remove]│
└─────────────────────────────────────────┘
```
Clicking Remove resets to idle state (backend `video_src` is cleared).

### Audio Dropzone — States
Same states as video. Multiple files supported (up to 3). Each uploaded file appears as an audio card below the dropzone:

```
┌─────────────────────────────────────────┐
│  ♪  bg_music.mp3     00:03:24  [✕]     │
└─────────────────────────────────────────┘
```

### Client-Side File Validation (runs before upload)

**Video:**
| Check | Rule | Error message |
|---|---|---|
| Extension | `.mp4`, `.mov`, `.webm` | "Unsupported format. Use MP4, MOV, or WEBM." |
| MIME type | `video/*` | "This doesn't appear to be a video file." |
| File size | ≤ 500 MB | "File is too large. Maximum is 500 MB." |
| Duration | Detected after local load; warn if > 10 min | "Video is over 10 minutes — this may affect performance." (warning, not block) |
| Readable | `URL.createObjectURL` + `onloadedmetadata` fires | "Couldn't read video metadata — file may be corrupted." |

**Audio:**
| Check | Rule | Error message |
|---|---|---|
| Extension | `.mp3`, `.wav`, `.aac` | "Unsupported format. Use MP3, WAV, or AAC." |
| MIME type | `audio/*` | "This doesn't appear to be an audio file." |
| File size | ≤ 50 MB | "File is too large. Maximum is 50 MB." |
| Duplicate | Same filename already in list | "This file is already added." |
| Count | Max 3 audio files | "You can upload up to 3 music tracks." |

### Duration Extraction
After the user selects a video, before uploading:
```ts
const video = document.createElement('video')
video.src = URL.createObjectURL(file)
video.onloadedmetadata = () => {
  const durationMs = Math.round(video.duration * 1000)
  URL.revokeObjectURL(video.src)
  // send durationMs with the upload form
}
```
This `durationMs` is sent as a `Form` field with the upload so the backend can update `timeline.duration_ms`.

### Continue Button
- Disabled (opacity 0.4, cursor not-allowed) until at least one video is successfully uploaded
- Label changes to `"Continue to Editor →"` once video is ready
- If audio uploads are in progress, shows `"Uploading audio… please wait"` and stays disabled until all finish
- On click: advance to `editor` stage

### Edge Cases — Upload Screen
- User drags a folder → `"Folders aren't supported — select individual files."`
- User drags multiple videos → only first is used, rest ignored with a toast: `"Only one video is supported. Only the first file was used."`
- Upload interrupted (network drop) → `status-error` border, `"Upload failed — check your connection and try again."`, retry button
- User uploads video, then uploads a second video → replaces the first (with confirmation toast: `"Video replaced."`)
- Backend returns `VALIDATION_ERROR` for extension mismatch → show backend error verbatim below dropzone
- Very slow upload → progress bar stays visible, no timeout until 5 minutes

---

## 5. Stage 3 — Editor

### Layout
Fixed full-viewport height, no page scroll. Two-column split.

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER (48px)  "Video Timeline Editor"    intro.mp4  Sub:2  Music:1 │
├──────────────────────────┬──────────────────────────────────────────┤
│                          │                                          │
│  CHAT PANEL              │  PLAYER PANEL                           │
│  w-[40%] h-full          │  w-[60%] h-full                         │
│  bg-surface              │  bg-primary                             │
│                          │                                          │
│  [message list]          │  [video + subtitle overlay]             │
│                          │  [player controls]                      │
│                          │  [upload section]                       │
│                          │  [timeline info bar]                    │
│                          │                                          │
│  [chat input]            │                                          │
│                          │                                          │
└──────────────────────────┴──────────────────────────────────────────┘
```

### Header Bar (48px, `bg-surface`, bottom border `cream-subtle`)
- Left: App name in `cream` 14px 600 weight
- Centre: Timeline name in `cream-muted` 13px (e.g. "Product Launch Cut")
- Right: `Sub: 2  Music: 1` counters in `cream-muted` 12px mono, update reactively after every chat action

---

## 6. Chat Panel (left, 40%)

### Structure
```
┌──────────────────────────────────────┐
│ CHAT PANEL HEADER (40px)             │
│ "Chat Lab"                 [?] help  │
├──────────────────────────────────────┤
│                                      │
│  MESSAGE LIST (scrollable, flex-1)   │
│                                      │
│  [suggestion chips — first load]     │
│                                      │
│  [message bubbles]                   │
│                                      │
├──────────────────────────────────────┤
│ INPUT AREA (auto-height, max 140px)  │
│ [textarea]              [send btn]   │
└──────────────────────────────────────┘
```

### Chat Panel Header
- Label: `"Chat Lab"` in `cream` 13px 600
- Help icon (`?`) — on click, opens a floating tooltip with 4–5 example commands

### Suggestion Chips (first load only)
Shown in the message list before the user sends anything. 4 pill buttons:
- `"Add a subtitle"`
- `"Change the music volume"`
- `"Delete the first subtitle"`
- `"Add a fade to the music"`

Clicking a chip pre-fills the input with an example prompt. Chips disappear after the first user message is sent.

### Message Bubbles

**User messages:**
- Right-aligned, max-width 80%
- Background: `bubble-user` (`#2A2520`), text `cream`, `12px` border-radius
- Padding: `10px 14px`
- Timestamp: `cream-muted` 11px mono, below bubble, right-aligned

**Agent messages:**
- Left-aligned, max-width 85%
- Background: `bg-elevated`, text `cream`, `12px` border-radius
- Left border `3px solid` colored by status:
  - `status-success` — action completed successfully
  - `status-warning` — completed with a caveat or suggestion
  - `status-error` — failed or rejected
- Timestamp below bubble, left-aligned

**Status detection logic** (frontend):
- If response contains words like "can't", "unable", "failed", "not supported", "doesn't exist" → `error`
- If response contains "though", "however", "may", "note that", "careful", "might" → `warning`
- Otherwise → `success`

**Typing indicator:**
- Shown as an agent bubble while `isAgentLoading: true`
- Three dots: `w-2 h-2 rounded-full bg-cream-muted`, staggered `opacity` animation at `0.6s`

**Auto-scroll:** Message list always scrolls to bottom after new message. Uses `useEffect` on message array length with `scrollIntoView({ behavior: 'smooth' })`.

### Chat Input
- `textarea` element, `bg-elevated`, `cream` text, `cream-subtle` border, `1px`
- Placeholder: `"Describe what you want to edit…"` in `cream-subtle`
- `min-height: 44px`, auto-expands up to `140px` then scrolls
- `Enter` → send; `Shift+Enter` → newline
- Disabled + `opacity-40` while `isAgentLoading: true`
- Character count shown at `cream-muted` 11px right of input when > 200 chars

**Send Button:**
- Right of input, `bg-accent` filled, `bg-primary` icon (arrow up)
- `6px` border-radius, `36px × 36px`
- Hover: `bg-accent-hover`, `scale(1.05)`
- Press: `scale(0.97)`
- Disabled while loading or input is empty

### Message Queue
If the user sends a second message while the agent is processing the first, it is queued and sent automatically once the first response arrives. A small `"1 message queued"` chip appears above the input while queued.

### Edge Cases — Chat
| Scenario | Behaviour |
|---|---|
| Agent returns empty string | Show: `"Something went wrong — please try again."` with `status-error` border |
| Network error on `/chat` | Show: `"Couldn't reach the server. Check your connection."` with retry button |
| Response > 500 chars | Truncate at 500 with `"Show more"` toggle |
| User sends only whitespace | Input trim check — send button stays disabled |
| Agent takes > 15s | Show `"Still thinking…"` below typing indicator after 15s |
| History grows > 20 messages | Oldest 5 messages collapse into `"— 5 earlier messages —"` divider |

---

## 7. Player Panel (right, 60%)

### Structure
```
┌────────────────────────────────────────┐
│                                        │
│  VIDEO CONTAINER                       │
│  (flex-1, centres video vertically)    │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │   <video> intrinsic aspect ratio │  │
│  │                                  │  │
│  │   [SubtitleOverlay]              │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
│                                        │
│  PLAYER CONTROLS (56px)               │
│  [▶] ━━━━━●━━━━━━━━━━━  00:08 / 01:32 │
│                                        │
│  UPLOAD SECTION (auto height)          │
│  [Upload Video]  [Upload Music]        │
│                                        │
│  TIMELINE INFO BAR (32px)             │
│  Subtitles: 2  ·  Music: 1  ·  92s    │
│                                        │
└────────────────────────────────────────┘
```

### Video Container
- `position: relative`, `bg-primary`
- Video element: `width: 100%`, `height: auto` — renders at intrinsic ratio
- Aspect ratio locked to the uploaded video's `videoWidth / videoHeight` via:
  ```ts
  videoEl.onloadedmetadata = () => {
    setAspectRatio(videoEl.videoWidth / videoEl.videoHeight)
  }
  // applied as: style={{ aspectRatio: String(aspectRatio) }}
  ```
- Before upload: placeholder div with dashed `cream-subtle` border, `"Upload a video to get started"` centred in `cream-muted`
- `controls` attribute never set — all controls are custom

### Subtitle Overlay
- `position: absolute`, `inset: 0`, `pointer-events: none` (never intercepts clicks)
- Renders active subtitles filtered by `currentTimeMs`:
  ```ts
  const active = subtitles.filter(s =>
    currentTimeMs >= s.start_ms && currentTimeMs <= s.end_ms
  )
  ```
- Each subtitle is a `<p>` absolutely positioned:
  - `bottom` → `bottom: 8%`, horizontally centred
  - `top` → `top: 8%`, horizontally centred  
  - `center` → `top: 50%; transform: translateY(-50%)`
- Text style from `style` field: `fontSize`, `color`
- Always has `text-shadow: 0 1px 6px rgba(0,0,0,0.85)` for legibility on any background
- Max width: `80%` of video width; text wraps naturally
- Font: `Inter` 600 weight (subtitles always bold for readability)
- Smooth fade: `opacity` transitions `100ms` as subtitles enter/exit

### Player Controls
Fixed `56px` bar below video, `bg-surface`, top border `cream-subtle`.

**Play/Pause Button:**
- Lucide icon: `Play` / `Pause`, `cream` colour, `20px`
- Toggles `videoEl.play()` / `videoEl.pause()`
- Keyboard shortcut: `Space` key (when player panel is focused)

**Seek Bar:**
- `<input type="range">` custom styled:
  - Track: `bg-elevated` with `accent`-coloured fill up to current position
  - Thumb: `12px` circle, `accent` fill, no border
  - Hover thumb: `14px` (CSS transition)
- Updates `currentTimeMs` every `timeupdate` event (fired ~4× per second)
- On drag: video seeks immediately (`videoEl.currentTime = value / 1000`)
- While dragging: temporarily detach `timeupdate` listener to prevent jitter

**Time Display:**
- `cream-muted` 12px mono: `00:08 / 01:32`
- Format: `mm:ss` always; never shows hours unless video > 60 min

### Upload Section (in Player Panel)
Two compact outlined buttons below controls:

**Upload Video button:**
- Label: `"Upload Video"` or `"Replace Video"` (if one already uploaded)
- On click: triggers hidden `<input type="file" accept=".mp4,.mov,.webm">`
- Runs same validation as Stage 2 upload
- Shows inline progress bar beneath the button during upload
- On success: video `src` updates seamlessly (player re-loads, seeks to 0)
- On error: red tooltip below button

**Upload Music button:**
- Label: `"Upload Music"`
- On click: triggers hidden `<input type="file" accept=".mp3,.wav,.aac">`
- Same validation as Stage 2
- On success: audio auto-attaches to existing empty-src track, or creates new track
- Shows `"Attached to track [id]"` toast for 3s on success
- If all tracks already have files: shows toast `"All tracks have files — add a track via chat first."`

### Music Engine (invisible component)
Renders `null`. Manages `AudioContext` lifecycle via `useEffect`.

**Graph per music track:**
```
AudioBufferSourceNode → GainNode → AudioContext.destination
```

**Behaviours:**
- `onplay`: For each music track with a valid `src`, fetch + decode audio, create source + gain node, start at offset matching `video.currentTime - track.start_ms / 1000` (if within track range). Schedule fade in via `gainNode.gain.linearRampToValueAtTime`.
- `onpause`: `audioContext.suspend()`
- `onseek`: Tear down all source nodes, rebuild graph at new position
- `ontimelinechange` (after chat action): Tear down entire graph, rebuild from new timeline state. If playing, immediately restart audio at current position.
- Fade in: ramp from `0` to `track.volume` over `fade_in_ms` from track start
- Fade out: schedule ramp from `track.volume` to `0` starting at `track.end_ms - track.fade_out_ms`
- Track with empty `src`: silently skipped (no error)
- AudioContext suspended until first user gesture (browser autoplay policy)

**Autoplay policy handling:**
On first play button click, if `audioContext.state === 'suspended'`, call `audioContext.resume()` first.

### Timeline Info Bar
`32px` footer below upload section, `bg-surface`, `cream-subtle` top border.
Content: `Subtitles: {n}  ·  Music: {n}  ·  {duration_s}s` in `cream-muted` 11px mono.
Updates reactively after every chat action.

---

## 8. Edge Cases — Editor

| Scenario | Behaviour |
|---|---|
| Video not yet uploaded, play pressed | Show toast: `"Upload a video first"` |
| Music track has no `src`, video plays | Music engine silently skips that track — no error shown |
| `attach_audio_src` returns `attached_to: null` | Show toast: `"All tracks already have files. Say 'add a music track' in chat first."` |
| Video metadata never loads (`onloadedmetadata` never fires) | After 5s timeout: `"Couldn't load video — it may be corrupted or unsupported."` |
| Chat action succeeds but video is mid-play | Timeline state updates silently. Music engine rebuilds at current position without interrupting video playback. |
| Subtitle has very long text | Overlay wraps to multiple lines; max 4 lines, overflow hidden with ellipsis |
| Two subtitles active simultaneously (overlap) | Both render, stacked vertically with `8px` gap |
| Timeline duration changes (new video uploaded) | Player seek bar max updates. Subtitles/music outside new duration are clipped (handled backend). |
| `currentTimeMs` slightly off subtitle boundary | Extend boundary by `±50ms` to prevent flickering at exact timestamps |
| Page refresh mid-session | `GET /timeline` on mount restores full state. Video src re-set if `video_src` is set. |
| Backend returns 500 on `/chat` | Show error bubble: `"Server error — try again in a moment."` with `status-error` border |
| Agent response mentions a subtitle ID | Do not linkify IDs — plain text only |
| Multiple browser tabs | Each tab is independent; no real-time sync across tabs |
| Resize window | Layout is responsive. Below `768px`: stack chat above player (single column). |

---

## 9. Component Tree

```
app/page.tsx
└── <AppRoot>                          stage state machine
    ├── [stage === 'onboarding']
    │   └── <OnboardingScreen>
    │       ├── <CapabilityCard type="can" />
    │       ├── <CapabilityCard type="cannot" />
    │       └── <ExampleChips />
    │
    ├── [stage === 'upload']
    │   └── <UploadScreen>
    │       ├── <VideoDropzone>
    │       │   ├── <FileValidator>      (util, not component)
    │       │   └── <UploadProgress>
    │       ├── <AudioDropzone>
    │       │   ├── <FileValidator>
    │       │   └── <AudioCard> (×n)
    │       └── <ContinueButton>
    │
    └── [stage === 'editor']
        └── <EditorLayout>
            ├── <Header />
            ├── <ChatPanel>              useChat hook
            │   ├── <ChatPanelHeader />
            │   ├── <MessageList>
            │   │   ├── <SuggestionChips />   (first load only)
            │   │   ├── <MessageBubble /> (×n)
            │   │   └── <TypingIndicator />
            │   └── <ChatInput />
            └── <PlayerPanel>            useVideoPlayer + useTimeline
                ├── <VideoContainer>
                │   ├── <video ref>
                │   └── <SubtitleOverlay />
                ├── <MusicEngine />       useMusicEngine hook (renders null)
                ├── <PlayerControls />
                ├── <UploadSection>
                │   ├── <VideoUploadButton />
                │   └── <AudioUploadButton />
                └── <TimelineInfoBar />
```

---

## 10. Hooks

### `useTimeline()`
```ts
{
  timeline: Timeline | null
  isLoading: boolean
  refresh: () => Promise<void>          // re-fetches from GET /timeline
  setTimeline: (t: Timeline) => void    // used after chat response
}
```
Fetches on mount. `setTimeline` is called by `useChat` after each successful `/chat` response — no separate fetch needed.

### `useChat(timeline, setTimeline)`
```ts
{
  messages: ChatMessage[]
  isLoading: boolean
  sendMessage: (text: string) => Promise<void>
  queuedCount: number
}
```
- Keeps message history as `{role, content, status}[]` in local state
- On send: appends user message, sets `isLoading`, POSTs to `/chat` with last 10 turns
- On response: appends assistant message with detected status, calls `setTimeline(response.timeline)`
- On error: appends error message with `status: 'error'`
- Queue: if `isLoading` when send called, push to queue; drain queue after response

### `useVideoPlayer()`
```ts
{
  videoRef: RefObject<HTMLVideoElement>
  currentTimeMs: number
  duration: number
  isPlaying: boolean
  play: () => void
  pause: () => void
  seek: (ms: number) => void
  setVideoSrc: (url: string) => void
}
```

### `useMusicEngine(timeline, currentTimeMs, isPlaying)`
No return value. Manages `AudioContext` and audio graph as a side effect. Rebuilds graph on `timeline.music` reference change.

### `useUpload()`
```ts
{
  uploadVideo: (file: File) => Promise<UploadResult>
  uploadAudio: (file: File) => Promise<UploadResult>
  validateFile: (file: File, type: 'video' | 'audio') => ValidationResult
  progress: number | null
}
```

---

## 11. TypeScript Types

```ts
// mirrors backend Pydantic models exactly

interface SubtitleStyle {
  font_size: number
  color: string
  position: 'bottom' | 'top' | 'center'
}

interface SubtitleCue {
  id: string
  text: string
  start_ms: number
  end_ms: number
  style: SubtitleStyle
}

interface MusicTrack {
  id: string
  src: string
  start_ms: number
  end_ms: number
  volume: number
  fade_in_ms: number
  fade_out_ms: number
}

interface Timeline {
  _id: string
  name: string
  duration_ms: number
  fps: number
  resolution: { width: number; height: number }
  video_src: string
  clips: unknown[]
  music: MusicTrack[]
  subtitles: SubtitleCue[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  status?: 'success' | 'warning' | 'error'  // frontend-only
  timestamp?: string                           // frontend-only
}

interface UploadResult {
  url: string
  timeline: Timeline
}
```

---

## 12. Responsive Behaviour

| Breakpoint | Layout |
|---|---|
| `≥ 1024px` | Chat left 40%, Player right 60% side-by-side |
| `768px – 1023px` | Chat top 45%, Player bottom 55% stacked |
| `< 768px` | Player full width top, Chat full width below — scroll enabled |

---

## 13. Toast Notifications

Global toast system (top-right corner, stacks vertically):
- 3 variants: `success` (green), `warning` (amber), `error` (red)
- Auto-dismiss after `3s` for success/warning, `5s` for error
- Manual dismiss with `✕` button
- Max 3 toasts at once — oldest auto-dismissed on overflow
- Slide in from right, fade out

Used for: video replaced, audio attached, file too large, network errors, any action outside the chat flow.

---

## 14. Accessibility

- All interactive elements have visible focus rings (`2px accent`)
- `<video>` has `aria-label="Timeline preview"`
- Chat input has `aria-label="Chat message input"`
- Send button has `aria-label="Send message"`
- Typing indicator has `aria-live="polite"` so screen readers announce agent response
- Dropzones handle `onKeyDown Enter/Space` for keyboard activation
- `prefers-reduced-motion`: all CSS animations disabled; typing indicator replaced with static `"…"`

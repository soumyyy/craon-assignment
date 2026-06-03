# Video Timeline CRUD Tools — Spec & PRD

**Assignment:** Take-Home · Craon  
**Deadline:** EOD June 3, 2026  
**Stack:** FastAPI · Next.js / React · MongoDB  
**LLM:** OpenAI GPT-4o (function calling)  
**Author:** Soumya Maheshwari

---

## 1. Problem Statement

Build a chat interface where users describe video editing actions in plain English. The app interprets those messages, applies CRUD operations to a video timeline (music tracks and subtitle cues), persists changes in MongoDB, and reflects all edits live in a playback preview — without a page reload.

The key evaluation criteria are:
- Does editing one thing break something else?
- Does the player reflect exactly what was edited?
- Does the chat handle requests — and failures — gracefully?

---

## 2. What We Are Building (In Scope)

| Feature | Description |
|---|---|
| Chat interface | Text input; user types plain English; agent responds with confirmation or error |
| Subtitle CRUD | Add, edit, delete subtitle cues via chat |
| Music CRUD | Add, edit, delete music tracks via chat |
| MongoDB persistence | All timeline changes persisted; fetched fresh after every action |
| Video upload | User uploads a video file (.mp4) via UI; stored on server |
| Audio upload | User uploads audio file (.mp3/.wav) via UI; attached to a music track |
| Playback preview | HTML5 video player with subtitle overlay + Web Audio for music |
| Live sync | Player re-reads timeline after each chat action without page reload |
| Editor intelligence | Agent applies good defaults and warns on bad edits (see Section 6) |

---

## 3. What We Are NOT Building (Out of Scope)

| Item | Reason |
|---|---|
| Clip editing (trim, reorder) | Assignment explicitly scopes to music + subtitles only |
| Video export (FFmpeg) | Bonus feature; deprioritized given deadline |
| Multi-timeline support | Single timeline (tl_001) for this demo |
| User auth / sessions | No login; single-user local demo |
| Undo / redo | Out of scope for this assignment |
| Bulk operations ("delete all subtitles before 10s") | Too unreliable with current LLM agentic loop; excluded |
| File upload via chat message | Files must be uploaded via UI; chat manages properties only |
| Transcript / transcription (Whisper) | Not in the assignment |
| Real-time collaboration | Single user only |
| Timeline scrubbing visual (waveform/clip rail) | Nice-to-have; deprioritized for deadline |

---

## 4. UI Screens

### 4.0 — Design Language

**Color Palette**

| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#0A0A0A` | App background, deep black |
| `--bg-surface` | `#141414` | Panel backgrounds |
| `--bg-elevated` | `#1C1C1C` | Cards, input fields, message bubbles (agent) |
| `--bg-hover` | `#242424` | Hover states |
| `--cream` | `#F5F0E8` | Primary text, headings, icons |
| `--cream-muted` | `#A89F8C` | Secondary text, timestamps, labels |
| `--cream-subtle` | `#4A4540` | Dividers, borders, placeholder text |
| `--accent` | `#C8B89A` | Active states, send button, focus rings — warm cream-gold |
| `--accent-hover` | `#D4C4A8` | Accent hover |
| `--user-bubble` | `#2A2520` | User chat bubble background |
| `--success` | `#4A7C59` | Success indicators (muted green) |
| `--warning` | `#8A6A2A` | Warning indicators (muted amber) |
| `--error` | `#7A3A3A` | Error indicators (muted red) |

**Typography**

| Element | Font | Size | Weight |
|---|---|---|---|
| App name / headings | `Inter` or system-ui | 14px | 600 |
| Body / chat messages | `Inter` | 14px | 400 |
| Timestamps / labels | `Inter` | 11px | 400 |
| Monospace (IDs, times) | `JetBrains Mono` or `monospace` | 12px | 400 |
| Video subtitle overlay | `Inter` | configurable via `font_size` field | 600 |

**Spacing & Radius**

- Base unit: 4px
- Panel padding: 16px
- Message bubble padding: 10px 14px
- Border radius: 8px (panels), 12px (bubbles), 6px (buttons), 4px (inputs)
- No box shadows — depth via background color steps only

**Interaction Standards**

- All interactive elements have a `2px` focus ring in `--accent`
- Hover transitions: `150ms ease`
- Button press: `scale(0.97)` transform
- Disabled state: `opacity: 0.4`, `cursor: not-allowed`
- Typing indicator: three dots, `0.6s` staggered fade animation

---

### 4.1 — App Layout (Single Page)

```
┌─────────────────────────────────────────────────────────────────────┐
│  bg: #0A0A0A                                                        │
│  HEADER  "Video Timeline Editor"  [cream text]     Subtitles: 2  Music: 1  │
├──────────────────────┬──────────────────────────────────────────────┤
│                      │                                               │
│   CHAT PANEL         │   VIDEO PLAYER PANEL                         │
│   (left, ~40% width) │   (right, ~60% width)                        │
│   bg: #141414        │   bg: #0A0A0A                                │
│                      │                                               │
│  ┌──────────────────┐│  ┌────────────────────────────────────────┐  │
│  │  Chat history    ││  │                                        │  │
│  │                  ││  │   <video> — intrinsic aspect ratio     │  │
│  │  [Agent bubble]  ││  │                                        │  │
│  │  Timeline ready. ││  │   subtitle overlay (bottom)            │  │
│  │                  ││  │                                        │  │
│  │  [User bubble]   ││  └────────────────────────────────────────┘  │
│  │  Lower music...  ││  [▶/⏸]  ━━━━━●━━━━━━━━━━  00:08 / 01:32    │
│  │                  ││                                               │
│  │  [Agent bubble]  ││  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Done — 30% set  ││  │ Upload Video │  │   Upload Music       │  │
│  └──────────────────┘│  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐│                                               │
│  │ Type a message.. ││                                               │
│  │            [Send]││                                               │
│  └──────────────────┘│                                               │
│                      │                                               │
└──────────────────────┴──────────────────────────────────────────────┘
```

### 4.2 — Video Player Panel (detail)

- `<video>` element renders at its **intrinsic aspect ratio** — derived from the uploaded file via the `videoWidth` / `videoHeight` properties on the HTMLVideoElement once metadata loads. The container uses `aspect-ratio: auto` so it adapts to any uploaded video (portrait, landscape, square).
- Before upload: placeholder div at a 16:9 fallback ratio showing "Upload a video to get started" in `--cream-muted`
- Subtitle overlay: absolutely positioned `<div>` over the video; text rendered from timeline state, shown/hidden based on `currentTime`
- Subtitle style applied inline: `font-size`, `color`, `position` (`bottom` → `bottom: 8%`, `top` → `top: 8%`, `center` → `top: 50% translateY(-50%)`)
- Subtitle text has a soft `text-shadow: 0 1px 4px rgba(0,0,0,0.8)` for legibility on any background
- Controls bar sits below the video (not overlaid): play/pause icon button, seek bar (range input styled in `--accent`), `00:00 / 01:32` time display in monospace
- No native browser controls (`controls` attribute omitted)
- Upload buttons below controls: outlined style, `--cream-subtle` border, `--cream` text, hover fills with `--bg-elevated`
- Timeline state summary (Subtitles count, Music count) shown in the header — updates reactively

### 4.3 — Chat Panel (detail)

- Background: `--bg-surface` (`#141414`), right border `1px solid --cream-subtle`
- Scrollable message list fills available height; newest message always scrolls into view on update
- **User messages:** right-aligned, bubble bg `--user-bubble` (`#2A2520`), text `--cream`, max-width 80%
- **Agent messages:** left-aligned, bubble bg `--bg-elevated` (`#1C1C1C`), text `--cream`, max-width 85%
- Agent responses have a 3px left border colored by status:
  - `--success` green — action completed
  - `--warning` amber — done but with a caveat
  - `--error` red — request failed or rejected
- Timestamp shown below each bubble in `--cream-muted` 11px
- While agent is processing: three-dot typing indicator in an agent bubble with staggered fade animation
- Input area: `--bg-elevated` background, `1px solid --cream-subtle` border, `--cream` text, placeholder in `--cream-subtle`
- `Enter` sends; `Shift+Enter` inserts newline; textarea auto-expands up to 5 lines then scrolls
- Send button: filled `--accent` background, `--bg-primary` icon, `6px` radius, hover → `--accent-hover`
- Send button and input disabled while agent is processing (opacity 0.4)

### 4.4 — Upload Flow

- **Video upload:** Click "Upload Video" → file picker (accept `.mp4`, `.mov`, `.webm`) → progress bar → on success, `<video>` src updated, player ready
- **Music upload:** Click "Upload Music" → file picker (accept `.mp3`, `.wav`, `.aac`) → progress bar → on success, a music track is created in the timeline OR the file URL is stored ready for the next `add music` chat command
- Only one video at a time; uploading a new video replaces the previous

### 4.5 — Empty / Loading States

| State | UI |
|---|---|
| No video uploaded | Player shows placeholder with "Upload a video to get started" |
| Timeline loading | Skeleton shimmer over player and chat |
| Agent processing | Typing indicator in chat; input disabled |
| Upload in progress | Progress bar under the upload button; button disabled |
| Upload error | Inline error below button: "Upload failed — try again" |
| Agent error | Red assistant bubble: explains what went wrong |

---

## 5. Data Model

### Timeline Document (MongoDB)

```json
{
  "_id": "tl_001",
  "name": "Product Launch Cut",
  "duration_ms": 92000,
  "fps": 30,
  "resolution": { "width": 1920, "height": 1080 },
  "video_src": "uploads/video/intro.mp4",
  "clips": [],
  "music": [
    {
      "id": "music_001",
      "src": "uploads/audio/bg_music.mp3",
      "start_ms": 0,
      "end_ms": 92000,
      "volume": 0.6,
      "fade_in_ms": 1000,
      "fade_out_ms": 2000
    }
  ],
  "subtitles": [
    {
      "id": "sub_001",
      "text": "Welcome to the product launch.",
      "start_ms": 500,
      "end_ms": 3500,
      "style": {
        "font_size": 24,
        "color": "#ffffff",
        "position": "bottom"
      }
    }
  ]
}
```

### Field Constraints

| Field | Type | Constraints |
|---|---|---|
| `start_ms` | int | >= 0, < `end_ms` |
| `end_ms` | int | > `start_ms`, <= `timeline.duration_ms` |
| `volume` | float | 0.0 – 1.0 |
| `fade_in_ms` | int | >= 0 |
| `fade_out_ms` | int | >= 0 |
| `font_size` | int | 8 – 120 |
| `color` | string | valid CSS hex color |
| `position` | string | `"bottom"` \| `"top"` \| `"center"` |
| `id` | string | auto-generated `nanoid()` on create |

---

## 6. Agent Design

### 6.1 Generic CRUD Tools

The agent is given **4 tools only** — not separate tools per resource. The `resource_type` parameter distinguishes music from subtitles.

```python
tools = [
    {
        "name": "list_items",
        "description": "List all music tracks or subtitle cues on the timeline. Call this first when you need to identify a specific item by position (e.g. 'the first subtitle') or when the user references 'the music' and you need to confirm which track.",
        "parameters": {
            "resource_type": { "type": "string", "enum": ["music", "subtitle"] }
        }
    },
    {
        "name": "create_item",
        "description": "Create a new music track or subtitle cue.",
        "parameters": {
            "resource_type": { "type": "string", "enum": ["music", "subtitle"] },
            "data": { "type": "object", "description": "Fields for the new item. See schema for required fields per resource type." }
        }
    },
    {
        "name": "update_item",
        "description": "Update fields on an existing music track or subtitle cue by its ID.",
        "parameters": {
            "resource_type": { "type": "string", "enum": ["music", "subtitle"] },
            "item_id": { "type": "string" },
            "updates": { "type": "object", "description": "Only the fields to change." }
        }
    },
    {
        "name": "delete_item",
        "description": "Delete a music track or subtitle cue by its ID.",
        "parameters": {
            "resource_type": { "type": "string", "enum": ["music", "subtitle"] },
            "item_id": { "type": "string" }
        }
    }
]
```

### 6.2 Multi-Step Agent Loop

The backend runs an agentic loop until the model returns a final text response (no more tool calls):

```
User message received
    → Inject system prompt (with current timeline state)
    → Call GPT-4o
    → If tool_call returned:
        → Execute tool against MongoDB
        → Append tool result to message history
        → Call GPT-4o again
    → Repeat until text response
    → Return final response to frontend
```

Max loop iterations: **5** (prevents runaway loops; returns error if exceeded).

### 6.3 System Prompt (Editor Intelligence)

```
You are an expert video editor assistant. You help users manage music tracks and subtitle cues 
on a video timeline. You have access to 4 tools: list_items, create_item, update_item, delete_item.

CURRENT TIMELINE STATE:
{timeline_json_injected_here}

EDITING RULES (apply these always):
1. Music defaults: If volume is not specified, use 0.6 (background level — music sits under the video audio).
   If no fade is specified, add fade_in_ms: 1000 and fade_out_ms: 2000 automatically and tell the user.
2. Music end time: If end time is not specified, extend to the timeline duration.
3. Subtitle defaults: If position is not specified, use "bottom". If font_size not specified, use 24. 
   If color not specified, use "#ffffff".
4. Reading speed check: A subtitle should be visible for at least 1 second per 7 words. If the 
   user specifies a duration too short for the text, warn them and ask if they want to adjust.
5. Volume sanity: Default is 0.6 (background level). If a user sets volume above 0.85, warn that it may compete with the video's primary audio. If they explicitly want full volume (1.0), apply it — just note it.
6. Overlapping subtitles: If a new subtitle's time range overlaps an existing one, flag it and 
   ask whether to proceed or adjust.
7. ID resolution: If the user says "the first subtitle", "the second track", or "the background 
   music", always call list_items first to get the current state, then resolve by position/name.
8. Time units: Users will say "seconds" — always convert to milliseconds (multiply by 1000).
   Users will say "%" for volume — convert to 0–1 float.

RESPONSE STYLE:
- Confirm what you did in one sentence.
- If you applied a default automatically, mention it briefly.
- If something looks off, say so clearly but without being alarmist.
- Never output raw JSON to the user.
- If a request is ambiguous, ask one clarifying question.
```

### 6.4 Example Agent Flows

**"Lower the background music volume to 30%"**
1. `list_items(resource_type: "music")` → returns `[{id: "music_001", src: "...", volume: 0.6, ...}]`
2. `update_item(resource_type: "music", item_id: "music_001", updates: {volume: 0.3})`
3. Returns: "Done — background music volume set to 30%."

**"Add a subtitle saying 'And we're live!' from 10 to 13 seconds at the bottom"**
1. `create_item(resource_type: "subtitle", data: {text: "And we're live!", start_ms: 10000, end_ms: 13000, style: {font_size: 24, color: "#ffffff", position: "bottom"}})`
2. Returns: "Added the subtitle 'And we're live!' from 10s to 13s at the bottom."

**"Add a new music track starting at 5 seconds"**
1. `create_item(resource_type: "music", data: {start_ms: 5000, end_ms: 92000, volume: 0.6, fade_in_ms: 1000, fade_out_ms: 2000, src: ""})`
2. Returns: "Music track added from 5s to the end of the timeline at 60% volume with a 1s fade in and 2s fade out. Note: no audio file is attached yet — use the 'Upload Music' button to attach a file."

---

## 7. Backend API

### Base URL: `http://localhost:8000`

| Method | Path | Description |
|---|---|---|
| `GET` | `/timeline` | Fetch the full timeline document |
| `POST` | `/chat` | Send a chat message; runs agent loop; returns response + updated timeline |
| `POST` | `/upload/video` | Upload video file; stores to disk; updates `timeline.video_src` |
| `POST` | `/upload/audio` | Upload audio file; stores to disk; returns file URL |
| `GET` | `/files/{filename}` | Serve uploaded files (video + audio) |

### POST /chat — Request

```json
{
  "message": "Lower the background music volume to 30%",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

### POST /chat — Response

```json
{
  "response": "Done — background music volume set to 30%.",
  "timeline": { ...full updated timeline document... },
  "tool_calls": [
    { "tool": "list_items", "args": { "resource_type": "music" } },
    { "tool": "update_item", "args": { "resource_type": "music", "item_id": "music_001", "updates": { "volume": 0.3 } } }
  ]
}
```

The `timeline` in the response is the fresh document post-edit. Frontend replaces its state with this — no separate GET needed.

### POST /upload/video — Response

```json
{
  "url": "/files/video/abc123.mp4",
  "duration_ms": 92000
}
```

### POST /upload/audio — Response

```json
{
  "url": "/files/audio/def456.mp3"
}
```

### Error Response (all endpoints)

```json
{
  "error": "Subtitle end_ms must be greater than start_ms.",
  "code": "VALIDATION_ERROR"
}
```

---

## 8. Frontend Architecture

### 8.1 State

```typescript
type AppState = {
  timeline: Timeline | null       // source of truth, synced from backend
  chatHistory: ChatMessage[]      // displayed in chat panel
  isAgentLoading: boolean         // disables input, shows typing indicator
  currentTimeMs: number           // video player current position
  videoUrl: string | null         // uploaded video src
  uploadProgress: number | null   // 0-100 during upload
}
```

### 8.2 Component Tree

```
<App>
├── <Header />
├── <PlayerPanel>
│   ├── <VideoPlayer>           — <video> ref + custom controls
│   ├── <SubtitleOverlay>       — positioned over video, driven by timeline + currentTimeMs
│   ├── <MusicEngine>           — invisible; Web Audio API manager
│   └── <UploadSection>         — video + audio upload buttons
└── <ChatPanel>
    ├── <MessageList>           — scrollable history
    ├── <TypingIndicator>       — shown when isAgentLoading
    └── <ChatInput>             — textarea + send button
```

### 8.3 Subtitle Overlay Logic

```typescript
// On every video timeupdate event:
const activeSubtitles = timeline.subtitles.filter(
  s => currentTimeMs >= s.start_ms && currentTimeMs <= s.end_ms
)
// Render the active subtitle(s) as styled <p> elements over the video
```

### 8.4 Music Engine (Web Audio API)

The `MusicEngine` component manages an `AudioContext` and one `AudioBufferSourceNode` per music track.

```
AudioContext
└── for each music track:
    AudioBufferSourceNode
        → GainNode (volume + fade ramps)
        → AudioContext.destination (speakers)
```

**On video play:** Start/resume all audio source nodes, offset to match video `currentTime`.  
**On video pause:** Suspend the AudioContext.  
**On video seek:** Stop all source nodes; recreate and restart from the new position with correct offsets.  
**Fade in:** `gainNode.gain.linearRampToValueAtTime(track.volume, audioCtx.currentTime + fadeInSeconds)` starting from gain 0.  
**Fade out:** Schedule a ramp-to-zero starting at `end_ms - fade_out_ms`.

**When timeline updates (after chat action):** Tear down and rebuild the entire audio graph from the fresh timeline state. If video is currently playing, immediately restart audio at current position.

### 8.5 Live Sync (no page reload)

After every successful `/chat` response, the frontend receives the full updated timeline in the response body. It:
1. Updates the React state (`timeline`)
2. The subtitle overlay re-renders automatically (driven by state)
3. The music engine detects timeline change (via `useEffect` dep) and rebuilds the audio graph

No polling. No WebSocket. The response payload carries the new state.

---

## 9. Known Agent Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Bulk operations ("delete all subtitles before 10s") | Agent may attempt multiple deletes in one loop; reliability varies | Excluded from advertised functionality; returns "I can only edit one item at a time" |
| Ambiguous reference ("the music") when 2 tracks exist | Agent lists both and asks which one | User must clarify |
| Audio file not attached to new music track | Track exists in DB with empty `src`; no sound plays | Agent tells user to upload an audio file via the Upload Music button |
| Very long agent loop (5+ tool calls) | Hits max iteration limit | Returns graceful error: "I wasn't able to complete that in time, please try a simpler request" |
| Hallucinated item IDs | Agent invents an ID that doesn't exist in MongoDB | Backend returns 404; agent retries with `list_items` first |
| Model context limit on very long chat history | Old messages get dropped | Frontend sends last 10 turns only |
| Unit ambiguity ("half a minute" vs "30 seconds") | GPT-4o handles well for common phrasings; edge cases may fail | Backend validates before write; agent rephrases if validation fails |

---

## 10. Validation Layer (Backend)

All writes go through a Pydantic validation layer before hitting MongoDB. This catches what the LLM may miss:

- `start_ms < end_ms`
- `end_ms <= timeline.duration_ms`
- `0.0 <= volume <= 1.0`
- `font_size` between 8 and 120
- `position` in `["bottom", "top", "center"]`
- `color` matches `^#[0-9a-fA-F]{6}$`
- `fade_in_ms >= 0`, `fade_out_ms >= 0`

Validation errors are returned as structured error responses; the agent receives them and rephrases a natural-language explanation to the user.

---

## 11. Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| Python | 3.11.11 | Stable, production-proven with all deps; 3.14 too new for this stack |
| Backend framework | FastAPI | Required by assignment; async, fast, Pydantic built-in |
| Database | MongoDB (Motor async driver) | Required; document model fits timeline JSON naturally |
| LLM | OpenAI GPT-4o | Best function calling reliability for agentic loops |
| Frontend framework | Next.js 14 (App Router) | Required; React Server Components for initial load |
| Styling | Tailwind CSS | Fast to build clean UI without a component library overhead |
| Audio | Web Audio API (native browser) | No library needed; full control over fades and sync |
| File storage | Local disk (`/uploads`) | Simple for local demo; path stored in MongoDB |
| HTTP client | Axios (frontend) | Straightforward, interceptors for error handling |

---

## 12. File / Folder Structure

```
craon-assignment/
├── backend/
│   ├── main.py                  — FastAPI app, CORS, static file serving
│   ├── routes/
│   │   ├── chat.py              — POST /chat (agent loop)
│   │   ├── timeline.py          — GET /timeline
│   │   └── upload.py            — POST /upload/video, /upload/audio
│   ├── agent/
│   │   ├── tools.py             — CRUD tool implementations
│   │   ├── loop.py              — GPT-4o agentic loop runner
│   │   └── system_prompt.py     — System prompt builder (injects timeline state)
│   ├── db/
│   │   ├── client.py            — Motor MongoDB client
│   │   └── timeline.py          — Timeline read/write helpers
│   ├── models/
│   │   └── timeline.py          — Pydantic models + validators
│   └── uploads/                 — Uploaded video + audio files
│       ├── video/
│       └── audio/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             — Main single-page layout
│   │   └── layout.tsx
│   ├── components/
│   │   ├── PlayerPanel/
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── SubtitleOverlay.tsx
│   │   │   ├── MusicEngine.tsx
│   │   │   └── UploadSection.tsx
│   │   └── ChatPanel/
│   │       ├── MessageList.tsx
│   │       ├── ChatInput.tsx
│   │       └── TypingIndicator.tsx
│   ├── hooks/
│   │   ├── useTimeline.ts       — fetches + holds timeline state
│   │   └── useChat.ts           — manages message history + POST /chat
│   ├── lib/
│   │   └── api.ts               — Axios instance + typed API calls
│   └── types/
│       └── timeline.ts          — TypeScript types matching Pydantic models
│
├── docs/
│   └── superpowers/specs/
│       └── 2026-06-03-video-timeline-crud-tools-design.md
│
└── README.md
```

---

## 13. Example Prompts That Must Work

These are taken directly from the assignment and must all succeed:

| Prompt | Expected outcome |
|---|---|
| "Add a subtitle saying 'And we're live!' from 10 seconds to 13 seconds at the bottom" | New subtitle created |
| "Change the first subtitle to say 'Hello everyone'" | list_items → identify first → update text |
| "Delete the second subtitle" | list_items → identify second → delete |
| "Add a new music track starting at 5 seconds" | New music track; user told to upload file; defaults applied |
| "Lower the background music volume to 30%" | list_items → identify track → volume: 0.3 |
| "Add a 3 second fade out to the music" | list_items → update fade_out_ms: 3000 |
| "Remove the background music" | list_items → delete |

---

## 14. Seed Data

On first run, the backend seeds the MongoDB timeline with the data from the assignment (tl_001, "Product Launch Cut", 2 subtitles, 1 music track) if no document exists. This gives the evaluator a working state immediately without needing to manually add items.

# Video Timeline CRUD Tools

An AI-powered video editor where you describe edits in plain English and they happen — music, subtitles, trim, crop, and export, all via chat.

**Stack:** FastAPI · Next.js 14 · MongoDB · OpenAI GPT-4o · Whisper · FFmpeg

---

## What it does

- **Chat to edit** — type "lower the music to 30%", "add a subtitle at 5s saying Hello", "trim to the first 20 seconds", "crop to 9:16" and the AI agent makes it happen
- **Live preview** — video player reflects every change instantly, no page reload
- **Music engine** — background music with volume, fade in/out, loops for built-in assets
- **Subtitles** — overlaid at the right timestamp, configurable font size, color, and position
- **Auto-transcription** — generate subtitles from speech via Whisper
- **Non-destructive editing** — trim and crop are metadata only; the original file is never touched until export
- **Export** — bakes all edits (trim + crop + music mix + burned-in subtitles) into a single downloadable MP4

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| MongoDB | 6+ | [mongodb.com](https://mongodb.com/try/download/community) or use Atlas |
| FFmpeg | Any recent | `brew install ffmpeg` · [ffmpeg.org](https://ffmpeg.org) |
| OpenAI API key | — | [platform.openai.com](https://platform.openai.com/api-keys) |

---

## Quick start

```bash
git clone https://github.com/soumyyy/craon-assignment.git
cd craon-assignment
./start.sh
```

The script checks prerequisites, installs dependencies, starts MongoDB, and launches both servers. Open [http://localhost:3000](http://localhost:3000).

**Prerequisites:** Python 3.11+, Node 18+, MongoDB, FFmpeg
- Mac: `brew install mongodb-community ffmpeg`
- Then add your OpenAI key to `backend/.env` when prompted

---

## Manual setup

### 1. Clone

```bash
git clone <repo-url>
cd craon-assignment
```

### 2. Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=craon_assignment
OPENAI_API_KEY=sk-...              # your OpenAI key
OPENAI_MODEL=gpt-4o
FRONTEND_ORIGIN=http://localhost:3000
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Sample media

The app works with any short video file (MP4, MOV, WebM). For best results:

- **Duration:** 10–60 seconds
- **Format:** H.264 MP4 (most compatible with FFmpeg and the browser player)
- **Audio:** include audio if you want Whisper auto-transcription to work

You can record a quick screen capture or use any royalty-free clip. Upload it via the **Upload Video** button in the header.

For background music, upload any MP3 or AAC file via the **Upload Music** button, or ask the AI to add a built-in loop track ("add some background music").

---

## Try these prompts

**Subtitles**
- `Add a subtitle saying "And we're live!" from 10s to 13s`
- `Change the first subtitle to say "Hello everyone"`
- `Delete the second subtitle`
- `Generate subtitles from the video`

**Music**
- `Add some background music`
- `Lower the background music to 30%`
- `Add a 3 second fade out to the music`
- `Remove the background music`

**Video**
- `Trim to the first 20 seconds`
- `Crop to a vertical 9:16 format`
- `Export the final video`

---

## Project structure

```
craon-assignment/
├── backend/
│   ├── agent/          # GPT-4o agent loop, tools, system prompt
│   ├── db/             # MongoDB client + timeline persistence
│   ├── models/         # Pydantic v2 data models
│   ├── routes/         # FastAPI route handlers
│   ├── assets/         # Built-in audio assets
│   ├── uploads/        # User-uploaded files (gitignored)
│   └── main.py
└── frontend/
    ├── app/            # Next.js App Router
    ├── components/
    │   ├── Editor/     # Main editor layout, chat, player
    │   └── Onboarding/ # First-launch screen
    ├── lib/            # API client, formatting utils
    └── types/          # TypeScript interfaces
```

---

## Architecture notes

**Agent:** GPT-4o with function calling. Uses generic CRUD tools (`list_items`, `create_item`, `update_item`, `delete_item`) plus `process_video` for trim/crop/export/transcribe. `parallel_tool_calls=False` and `temperature=0` for deterministic edits. Self-correcting loop up to 6 iterations.

**Non-destructive editing:** Trim and crop write metadata to MongoDB only. FFmpeg runs once at export time, applying all transformations in a single render pass.

**Music engine:** Web Audio API with `AudioBufferSourceNode` + `GainNode`. Supports fade in/out scheduling, looping assets, and live volume updates. Buffers are cached after first load.

**Export:** FFmpeg `filter_complex` combines trim (stream copy or re-encode), crop, music mix with `adelay`/`amix`, and burned-in SRT subtitles into a single MP4.

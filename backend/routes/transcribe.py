import os
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from nanoid import generate
from openai import AsyncOpenAI

from db.timeline import get_timeline, save_timeline
from models.timeline import SubtitleCue, SubtitleStyle, Timeline

load_dotenv()

router = APIRouter()
UPLOADS_ROOT = Path(__file__).resolve().parent.parent / "uploads"
WORDS_PER_CUE = 6


def _video_path(video_src: str) -> Path:
    relative = video_src.removeprefix("/files/")
    return UPLOADS_ROOT / relative


async def _extract_audio(video_path: Path, start_sec: float = 0, duration_sec: float | None = None) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.close()

    cmd = ["ffmpeg"]
    if start_sec > 0:
        cmd += ["-ss", f"{start_sec:.3f}"]
    cmd += ["-i", str(video_path)]
    if duration_sec is not None:
        cmd += ["-t", f"{duration_sec:.3f}"]
    cmd += ["-vn", "-acodec", "mp3", "-ar", "16000", "-ac", "1", "-b:a", "64k", tmp.name, "-y"]

    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
        raise HTTPException(
            status_code=422,
            detail={"error": "Could not extract audio — make sure the video has an audio track.", "code": "AUDIO_EXTRACTION_FAILED"},
        )
    return tmp.name


def _words_to_subtitles(words: list, offset_ms: int, max_end_ms: int) -> list[SubtitleCue]:
    subtitles = []
    i = 0
    while i < len(words):
        chunk = words[i:i + WORDS_PER_CUE]
        text = " ".join(w.word.strip() for w in chunk)
        start_ms = offset_ms + int(chunk[0].start * 1000)
        end_ms = offset_ms + int(chunk[-1].end * 1000)
        if end_ms <= start_ms:
            end_ms = start_ms + max(1500, len(text) * 60)
        end_ms = min(end_ms, max_end_ms)
        subtitles.append(SubtitleCue(
            id=f"sub_{generate(size=8)}",
            text=text,
            start_ms=start_ms,
            end_ms=end_ms,
            style=SubtitleStyle(),
        ))
        i += WORDS_PER_CUE
    return subtitles


def _segments_to_subtitles(segments: list, offset_ms: int, max_end_ms: int) -> list[SubtitleCue]:
    subtitles = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        start_ms = offset_ms + int(seg.start * 1000)
        end_ms = offset_ms + int(seg.end * 1000)
        if end_ms <= start_ms:
            end_ms = start_ms + 2000
        end_ms = min(end_ms, max_end_ms)
        subtitles.append(SubtitleCue(
            id=f"sub_{generate(size=8)}",
            text=text,
            start_ms=start_ms,
            end_ms=end_ms,
            style=SubtitleStyle(),
        ))
    return subtitles


async def _transcribe_segment(
    client: AsyncOpenAI,
    video_path: Path,
    start_sec: float,
    duration_sec: float,
    offset_ms: int,
    max_end_ms: int,
) -> list[SubtitleCue]:
    audio_path = await _extract_audio(video_path, start_sec=start_sec, duration_sec=duration_sec)
    try:
        audio_size = os.path.getsize(audio_path)
        if audio_size < 1000:
            return []

        with open(audio_path, "rb") as f:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
            )

        words = [w for w in (response.words or []) if w.word.strip()]
        if words:
            return _words_to_subtitles(words, offset_ms, max_end_ms)
        return _segments_to_subtitles(response.segments or [], offset_ms, max_end_ms)
    finally:
        try:
            os.unlink(audio_path)
        except OSError:
            pass


@router.post("/transcribe")
async def transcribe_video():
    timeline = await get_timeline()

    clips = timeline.clips if timeline.clips else (
        [{
            "src": timeline.video_src,
            "start_ms": 0,
            "end_ms": timeline.duration_ms,
        }] if timeline.video_src else []
    )

    if not clips:
        raise HTTPException(status_code=400, detail={"error": "No video uploaded yet.", "code": "NO_VIDEO"})

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail={"error": "OpenAI API key not configured.", "code": "CONFIGURATION_ERROR"})

    trim_start_ms = timeline.trim_start_ms or 0
    trim_end_ms = timeline.trim_end_ms if timeline.trim_end_ms is not None else timeline.duration_ms
    client = AsyncOpenAI(api_key=api_key)
    all_subtitles: list[SubtitleCue] = []

    for clip in clips:
        src = clip["src"] if isinstance(clip, dict) else clip.src
        clip_start_ms = clip["start_ms"] if isinstance(clip, dict) else clip.start_ms
        clip_end_ms = clip["end_ms"] if isinstance(clip, dict) else clip.end_ms

        # Skip clips entirely outside the trim window
        if clip_end_ms <= trim_start_ms or clip_start_ms >= trim_end_ms:
            continue

        if not src:
            continue

        video_path = _video_path(src)
        if not video_path.exists():
            continue

        # Clamp to trim window
        active_start_ms = max(clip_start_ms, trim_start_ms)
        active_end_ms = min(clip_end_ms, trim_end_ms)

        # Within the clip file: how far in does the active window start?
        file_start_sec = (active_start_ms - clip_start_ms) / 1000
        file_duration_sec = (active_end_ms - active_start_ms) / 1000

        subtitles = await _transcribe_segment(
            client=client,
            video_path=video_path,
            start_sec=file_start_sec,
            duration_sec=file_duration_sec,
            offset_ms=active_start_ms,   # timestamps offset to source timeline position
            max_end_ms=active_end_ms,
        )
        all_subtitles.extend(subtitles)

    if not all_subtitles:
        raise HTTPException(
            status_code=422,
            detail={"error": "No speech detected in the video.", "code": "NO_SPEECH"},
        )

    state = timeline.model_dump()
    state["subtitles"] = [s.model_dump() for s in all_subtitles]
    updated = Timeline.model_validate(state)
    await save_timeline(updated)

    return {"timeline": updated, "count": len(all_subtitles)}

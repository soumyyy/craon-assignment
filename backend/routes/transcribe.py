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


def _video_path(video_src: str) -> Path:
    # video_src is "/files/video/abc.mp4" → uploads/video/abc.mp4
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
    cmd += [
        "-vn",
        "-acodec", "mp3",
        "-ar", "16000",
        "-ac", "1",
        "-b:a", "64k",
        tmp.name, "-y",
    ]

    result = subprocess.run(cmd, capture_output=True, timeout=120)

    if result.returncode != 0:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Could not extract audio — make sure the video has an audio track.",
                "code": "AUDIO_EXTRACTION_FAILED",
            },
        )

    return tmp.name


@router.post("/transcribe")
async def transcribe_video():
    timeline = await get_timeline()

    if not timeline.video_src:
        raise HTTPException(
            status_code=400,
            detail={"error": "No video uploaded yet.", "code": "NO_VIDEO"},
        )

    video_path = _video_path(timeline.video_src)
    if not video_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": "Video file not found on server.", "code": "FILE_NOT_FOUND"},
        )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail={"error": "OpenAI API key not configured.", "code": "CONFIGURATION_ERROR"},
        )

    # Only transcribe the active trim window so subtitles land in the visible range
    trim_start_ms = timeline.trim_start_ms or 0
    trim_end_ms = timeline.trim_end_ms if timeline.trim_end_ms is not None else timeline.duration_ms
    trim_start_sec = trim_start_ms / 1000
    trim_duration_sec = (trim_end_ms - trim_start_ms) / 1000

    audio_path = await _extract_audio(video_path, start_sec=trim_start_sec, duration_sec=trim_duration_sec)

    try:
        audio_size = os.path.getsize(audio_path)

        if audio_size < 1000:
            raise HTTPException(
                status_code=422,
                detail={"error": "No audio track found in this video.", "code": "NO_AUDIO"},
            )

        if audio_size > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "Audio exceeds Whisper's 25 MB limit. Try a shorter video.",
                    "code": "AUDIO_TOO_LARGE",
                },
            )

        client = AsyncOpenAI(api_key=api_key)
        with open(audio_path, "rb") as f:
            response = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
            )

        # Group words into subtitle cues (~6 words each).
        # Whisper timestamps are relative to the extracted audio (which started at trim_start),
        # so offset by trim_start_ms to get source-video timestamps.
        WORDS_PER_CUE = 6
        words = [w for w in (response.words or []) if w.word.strip()]

        new_subtitles: list[SubtitleCue] = []
        i = 0
        while i < len(words):
            chunk = words[i:i + WORDS_PER_CUE]
            text = " ".join(w.word.strip() for w in chunk)
            start_ms = trim_start_ms + int(chunk[0].start * 1000)
            end_ms = trim_start_ms + int(chunk[-1].end * 1000)

            if end_ms <= start_ms:
                end_ms = start_ms + max(1500, len(text) * 60)
            end_ms = min(end_ms, trim_end_ms)

            new_subtitles.append(
                SubtitleCue(
                    id=f"sub_{generate(size=8)}",
                    text=text,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    style=SubtitleStyle(),
                )
            )
            i += WORDS_PER_CUE

        # Fall back to segments if word-level returned nothing
        if not new_subtitles:
            for seg in response.segments or []:
                text = seg.text.strip()
                if not text:
                    continue
                start_ms = trim_start_ms + int(seg.start * 1000)
                end_ms = trim_start_ms + int(seg.end * 1000)
                if end_ms <= start_ms:
                    end_ms = start_ms + 2000
                end_ms = min(end_ms, trim_end_ms)
                new_subtitles.append(
                    SubtitleCue(
                        id=f"sub_{generate(size=8)}",
                        text=text,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        style=SubtitleStyle(),
                    )
                )

        if not new_subtitles:
            raise HTTPException(
                status_code=422,
                detail={"error": "No speech detected in the video.", "code": "NO_SPEECH"},
            )

        state = timeline.model_dump()
        state["subtitles"] = [s.model_dump() for s in new_subtitles]
        updated = Timeline.model_validate(state)
        await save_timeline(updated)

        return {"timeline": updated, "count": len(new_subtitles)}

    finally:
        try:
            os.unlink(audio_path)
        except OSError:
            pass

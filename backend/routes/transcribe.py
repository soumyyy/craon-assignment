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


async def _extract_audio(video_path: Path) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.close()

    result = subprocess.run(
        [
            "ffmpeg", "-i", str(video_path),
            "-vn",                  # drop video stream
            "-acodec", "mp3",
            "-ar", "16000",         # 16 kHz — Whisper optimal
            "-ac", "1",             # mono
            "-b:a", "64k",
            tmp.name, "-y",
        ],
        capture_output=True,
        timeout=120,
    )

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

    audio_path = await _extract_audio(video_path)

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
                timestamp_granularities=["segment"],
            )

        new_subtitles: list[SubtitleCue] = []
        for seg in response.segments or []:
            text = seg.text.strip()
            if not text:
                continue

            start_ms = int(seg.start * 1000)
            end_ms = int(seg.end * 1000)

            # Sanity — ensure valid range within timeline
            if start_ms >= timeline.duration_ms:
                continue
            if end_ms <= start_ms:
                end_ms = start_ms + 2000
            end_ms = min(end_ms, timeline.duration_ms)

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

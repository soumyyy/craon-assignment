from pathlib import Path
import json
import subprocess

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from nanoid import generate

from db.timeline import append_video_clip, attach_audio_src, update_video_src

router = APIRouter()

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac"}


def _safe_extension(filename: str, allowed: set[str]) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in allowed:
        raise HTTPException(
            status_code=400,
            detail={"error": f"Unsupported file type '{extension}'", "code": "VALIDATION_ERROR"},
        )
    return extension


async def _save_upload(file: UploadFile, folder: str, extension: str) -> str:
    target_dir = UPLOAD_ROOT / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{generate(size=12)}{extension}"
    target = target_dir / filename

    async with aiofiles.open(target, "wb") as output:
        while chunk := await file.read(1024 * 1024):
            await output.write(chunk)

    return f"/files/{folder}/{filename}"


def _upload_path(url: str) -> Path:
    return UPLOAD_ROOT / url.removeprefix("/files/")


def _probe_video_metadata(path: Path) -> tuple[int | None, dict[str, int] | None]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height:stream_tags=rotate:stream_side_data=rotation:format=duration",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        return None, None

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None, None

    duration_ms: int | None = None
    duration = data.get("format", {}).get("duration")
    if duration is not None:
        try:
            duration_ms = max(1, round(float(duration) * 1000))
        except (TypeError, ValueError):
            duration_ms = None

    resolution: dict[str, int] | None = None
    streams = data.get("streams") or []
    if streams:
        stream = streams[0]
        width = stream.get("width")
        height = stream.get("height")
        if isinstance(width, int) and isinstance(height, int) and width > 0 and height > 0:
            rotation = _stream_rotation(stream)
            if abs(rotation) in {90, 270}:
                width, height = height, width
            resolution = {"width": width, "height": height}

    return duration_ms, resolution


def _stream_rotation(stream: dict) -> int:
    for side_data in stream.get("side_data_list") or []:
        rotation = side_data.get("rotation")
        if isinstance(rotation, int):
            return rotation
    rotate_tag = stream.get("tags", {}).get("rotate")
    if rotate_tag is not None:
        try:
            return int(float(rotate_tag))
        except (TypeError, ValueError):
            return 0
    return 0


@router.post("/upload/video")
async def upload_video(file: UploadFile = File(...), duration_ms: int | None = Form(default=None, gt=0)):
    extension = _safe_extension(file.filename or "", VIDEO_EXTENSIONS)
    url = await _save_upload(file, "video", extension)
    probed_duration_ms, resolution = _probe_video_metadata(_upload_path(url))
    timeline = await update_video_src(url, duration_ms or probed_duration_ms, resolution)
    return {"url": url, "duration_ms": timeline.duration_ms, "timeline": timeline}


@router.post("/upload/clip")
async def upload_clip(file: UploadFile = File(...), duration_ms: int | None = Form(default=None, gt=0)):
    extension = _safe_extension(file.filename or "", VIDEO_EXTENSIONS)
    url = await _save_upload(file, "video", extension)
    probed_duration_ms, resolution = _probe_video_metadata(_upload_path(url))
    clip_duration = duration_ms or probed_duration_ms
    if clip_duration is None or clip_duration <= 0 or resolution is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "Could not read clip metadata.", "code": "METADATA_ERROR"},
        )
    timeline = await append_video_clip(url, clip_duration, resolution)
    return {"url": url, "duration_ms": timeline.duration_ms, "timeline": timeline}


@router.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    extension = _safe_extension(file.filename or "", AUDIO_EXTENSIONS)
    url = await _save_upload(file, "audio", extension)
    timeline, attached_to, created_track = await attach_audio_src(url)
    attached = attached_to is not None
    return {
        "url": url,
        "timeline_id": timeline.id,
        "attached": attached,
        "attached_to": attached_to,
        "created_track": created_track,
        "message": (
            f"Audio attached to {attached_to}."
            if attached
            else "Audio uploaded, but no empty music track was available to attach it to. Ask the assistant to add a music track first."
        ),
        "code": None if attached else "NO_EMPTY_MUSIC_TRACK",
        "timeline": timeline,
    }

from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, HTTPException, UploadFile
from nanoid import generate

from db.timeline import get_timeline, update_video_src

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


@router.post("/upload/video")
async def upload_video(file: UploadFile = File(...)):
    extension = _safe_extension(file.filename or "", VIDEO_EXTENSIONS)
    url = await _save_upload(file, "video", extension)
    timeline = await update_video_src(url)
    return {"url": url, "duration_ms": timeline.duration_ms}


@router.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    extension = _safe_extension(file.filename or "", AUDIO_EXTENSIONS)
    url = await _save_upload(file, "audio", extension)
    timeline = await get_timeline()
    return {"url": url, "timeline_id": timeline.id}

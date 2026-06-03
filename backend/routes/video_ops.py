"""
Video processing routes — trim, crop, export via ffmpeg.
All operations produce a new file; the original is never overwritten.
"""

import os
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from nanoid import generate
from pydantic import BaseModel, Field

from db.timeline import get_timeline, save_timeline
from models.timeline import Timeline

load_dotenv()

router = APIRouter(prefix="/video")
UPLOADS_ROOT = Path(__file__).resolve().parent.parent / "uploads"


# ─── helpers ─────────────────────────────────────────────────────────────────

def _src_to_path(video_src: str) -> Path:
    """Convert '/files/video/abc.mp4' → absolute Path on disk."""
    return UPLOADS_ROOT / video_src.removeprefix("/files/")


def _new_video_path(ext: str = ".mp4") -> tuple[Path, str]:
    """Return (absolute_path, url_path) for a fresh output file."""
    name = f"{generate(size=12)}{ext}"
    abs_path = UPLOADS_ROOT / "video" / name
    url_path = f"/files/video/{name}"
    return abs_path, url_path


def _ffmpeg(*args: str, timeout: int = 300) -> None:
    """Run ffmpeg, raise HTTPException on non-zero exit."""
    result = subprocess.run(
        ["ffmpeg", "-y", *args],
        capture_output=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace")[-400:]
        raise HTTPException(
            status_code=500,
            detail={"error": f"ffmpeg failed: {detail}", "code": "FFMPEG_ERROR"},
        )


def _require_video(timeline: Timeline) -> Path:
    if not timeline.video_src:
        raise HTTPException(400, {"error": "No video uploaded yet.", "code": "NO_VIDEO"})
    path = _src_to_path(timeline.video_src)
    if not path.exists():
        raise HTTPException(404, {"error": "Video file not found.", "code": "FILE_NOT_FOUND"})
    return path


def _ms_to_srt_time(ms: int) -> str:
    h = ms // 3_600_000
    ms %= 3_600_000
    m = ms // 60_000
    ms %= 60_000
    s = ms // 1000
    ms %= 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _write_srt(timeline: Timeline, path: str) -> bool:
    """Write a .srt file from timeline subtitles. Returns True if any subs written."""
    subs = timeline.subtitles
    if not subs:
        return False
    with open(path, "w", encoding="utf-8") as f:
        for i, cue in enumerate(subs, 1):
            f.write(f"{i}\n")
            f.write(f"{_ms_to_srt_time(cue.start_ms)} --> {_ms_to_srt_time(cue.end_ms)}\n")
            f.write(f"{cue.text}\n\n")
    return True


# ─── trim ────────────────────────────────────────────────────────────────────

class TrimRequest(BaseModel):
    start_ms: int = Field(default=0, ge=0)
    end_ms: int = Field(gt=0)


@router.post("/trim")
async def trim_video(req: TrimRequest):
    """Cut the video to [start_ms, end_ms]. Stream-copy — fast, no re-encode."""
    if req.end_ms <= req.start_ms:
        raise HTTPException(400, {"error": "end_ms must be greater than start_ms.", "code": "VALIDATION_ERROR"})

    timeline = await get_timeline()
    src_path = _require_video(timeline)

    out_path, out_url = _new_video_path(src_path.suffix or ".mp4")
    _ffmpeg(
        "-i", str(src_path),
        "-ss", f"{req.start_ms / 1000:.3f}",
        "-to", f"{req.end_ms / 1000:.3f}",
        "-c", "copy",
        str(out_path),
    )

    new_duration = req.end_ms - req.start_ms
    state = timeline.model_dump()
    state["video_src"] = out_url
    state["duration_ms"] = new_duration

    # Shift all items by start_ms, drop anything that falls outside
    state["music"] = []
    for t in timeline.music:
        new_start = max(0, t.start_ms - req.start_ms)
        new_end = min(new_duration, t.end_ms - req.start_ms)
        if new_end > new_start:
            state["music"].append({**t.model_dump(), "start_ms": new_start, "end_ms": new_end})

    state["subtitles"] = []
    for cue in timeline.subtitles:
        new_start = max(0, cue.start_ms - req.start_ms)
        new_end = min(new_duration, cue.end_ms - req.start_ms)
        if new_end > new_start:
            state["subtitles"].append({**cue.model_dump(), "start_ms": new_start, "end_ms": new_end})

    updated = Timeline.model_validate(state)
    await save_timeline(updated)
    return {"timeline": updated, "url": out_url}


# ─── crop ────────────────────────────────────────────────────────────────────

CROP_FILTERS: dict[str, str] = {
    "16:9":  "crop=iw:iw*9/16:(iw-iw)/2:(ih-iw*9/16)/2",
    "9:16":  "crop=ih*9/16:ih:(iw-ih*9/16)/2:0",
    "1:1":   "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2",
    "4:3":   "crop=iw:iw*3/4:(iw-iw)/2:(ih-iw*3/4)/2",
    "21:9":  "crop=iw:iw*9/21:(iw-iw)/2:(ih-iw*9/21)/2",
}


class CropRequest(BaseModel):
    aspect_ratio: str = Field(description="Target aspect ratio: '16:9', '9:16', '1:1', '4:3', '21:9'")


@router.post("/crop")
async def crop_video(req: CropRequest):
    """Crop video to a target aspect ratio. Requires re-encode (~10–30s)."""
    ratio = req.aspect_ratio.strip()
    if ratio not in CROP_FILTERS:
        raise HTTPException(400, {
            "error": f"Unsupported aspect ratio '{ratio}'. Options: {', '.join(CROP_FILTERS)}",
            "code": "VALIDATION_ERROR",
        })

    timeline = await get_timeline()
    src_path = _require_video(timeline)
    out_path, out_url = _new_video_path(".mp4")

    _ffmpeg(
        "-i", str(src_path),
        "-vf", CROP_FILTERS[ratio],
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "copy",
        str(out_path),
    )

    state = timeline.model_dump()
    state["video_src"] = out_url
    # Update resolution
    new_w, new_h = _ratio_to_dims(ratio, timeline.resolution.width, timeline.resolution.height)
    state["resolution"] = {"width": new_w, "height": new_h}

    updated = Timeline.model_validate(state)
    await save_timeline(updated)
    return {"timeline": updated, "url": out_url}


def _ratio_to_dims(ratio: str, orig_w: int, orig_h: int) -> tuple[int, int]:
    """Estimate output dimensions after crop."""
    try:
        w_parts, h_parts = ratio.split(":")
        r = int(w_parts) / int(h_parts)
        orig_r = orig_w / orig_h
        if orig_r > r:
            new_h = orig_h
            new_w = int(orig_h * r)
        else:
            new_w = orig_w
            new_h = int(orig_w / r)
        return new_w, new_h
    except Exception:
        return orig_w, orig_h


# ─── export ──────────────────────────────────────────────────────────────────

@router.post("/export")
async def export_video():
    """
    Render final video: mix music tracks (with volume + fades) and burn in subtitles.
    Returns a downloadable file URL.
    """
    timeline = await get_timeline()
    src_path = _require_video(timeline)
    out_path, out_url = _new_video_path(".mp4")

    has_music = any(t.src and _src_to_path(t.src).exists() for t in timeline.music)
    has_subs = bool(timeline.subtitles)

    if not has_music and not has_subs:
        # Nothing to add — just re-encode for clean output
        _ffmpeg("-i", str(src_path), "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-c:a", "aac", str(out_path))
        return {"url": out_url}

    # ── Build filter_complex ──────────────────────────────────────────────────
    inputs = ["-i", str(src_path)]
    filter_parts: list[str] = []
    music_input_index = 1
    audio_output = None

    if has_music:
        track = next(t for t in timeline.music if t.src and _src_to_path(t.src).exists())
        inputs += ["-i", str(_src_to_path(track.src))]

        dur_s = timeline.duration_ms / 1000
        fade_in_s = track.fade_in_ms / 1000
        fade_out_start = max(0, dur_s - track.fade_out_ms / 1000)
        fade_out_s = track.fade_out_ms / 1000
        delay_s = track.start_ms / 1000

        audio_filter = f"[{music_input_index}:a]"
        audio_filter += f"atrim=start=0:end={dur_s}"
        audio_filter += f",adelay={int(delay_s * 1000)}|{int(delay_s * 1000)}"
        audio_filter += f",volume={track.volume}"
        if fade_in_s > 0:
            audio_filter += f",afade=t=in:st={delay_s}:d={fade_in_s}"
        if fade_out_s > 0:
            audio_filter += f",afade=t=out:st={fade_out_start}:d={fade_out_s}"
        audio_filter += "[aout]"

        filter_parts.append(audio_filter)
        audio_output = "[aout]"
        music_input_index += 1

    srt_tmp: str | None = None
    video_output = "[0:v]"

    if has_subs:
        tmp = tempfile.NamedTemporaryFile(suffix=".srt", delete=False, mode="w", encoding="utf-8")
        srt_tmp = tmp.name
        tmp.close()
        _write_srt(timeline, srt_tmp)

        # Escape path for ffmpeg filter
        escaped = srt_tmp.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        vf = (
            f"[0:v]subtitles='{escaped}'"
            ":force_style='FontName=DM Sans,FontSize=24,PrimaryColour=&Hffffff&,"
            "OutlineColour=&H80000000&,Outline=1.5,Shadow=0,Alignment=2,MarginV=32'[vout]"
        )
        filter_parts.append(vf)
        video_output = "[vout]"

    try:
        cmd = [*inputs]
        if filter_parts:
            cmd += ["-filter_complex", ";".join(filter_parts)]

        cmd += ["-map", video_output]
        if audio_output:
            cmd += ["-map", audio_output]
        elif not has_music:
            cmd += ["-map", "0:a?"]   # keep original audio if present

        cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "22"]
        cmd += ["-c:a", "aac", "-b:a", "192k"]
        cmd += [str(out_path)]

        _ffmpeg(*cmd)
    finally:
        if srt_tmp:
            try:
                os.unlink(srt_tmp)
            except OSError:
                pass

    return {"url": out_url}


@router.get("/export/download")
async def download_export(url: str):
    """Serve the exported file as a download attachment."""
    rel = url.removeprefix("/files/")
    path = UPLOADS_ROOT / rel
    if not path.exists():
        raise HTTPException(404, {"error": "Export file not found.", "code": "FILE_NOT_FOUND"})
    return FileResponse(str(path), media_type="video/mp4", filename="export.mp4")

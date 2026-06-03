"""
Video processing routes — non-destructive editing.

Trim and crop ONLY write metadata to the timeline; the source file is never
touched. The frontend player interprets trim_start_ms / trim_end_ms / crop to
preview the edit. The actual ffmpeg render happens once, at /export.
"""

import os
import json
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from nanoid import generate
from pydantic import BaseModel, Field

from db.timeline import get_timeline, save_timeline
from models.timeline import SubtitleCue, Timeline

load_dotenv()

router = APIRouter(prefix="/video")
UPLOADS_ROOT = Path(__file__).resolve().parent.parent / "uploads"
ASSETS_ROOT = Path(__file__).resolve().parent.parent / "assets"

CROP_FILTERS: dict[str, str] = {
    "16:9":  "crop=iw:iw*9/16:0:(ih-iw*9/16)/2",
    "9:16":  "crop=ih*9/16:ih:(iw-ih*9/16)/2:0",
    "1:1":   "crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2",
    "4:3":   "crop=iw:iw*3/4:0:(ih-iw*3/4)/2",
    "21:9":  "crop=iw:iw*9/21:0:(ih-iw*9/21)/2",
}


# ─── helpers ─────────────────────────────────────────────────────────────────

def _src_to_path(video_src: str) -> Path:
    if video_src.startswith("/assets/"):
        return ASSETS_ROOT / video_src.removeprefix("/assets/")
    return UPLOADS_ROOT / video_src.removeprefix("/files/")


def _is_looping_audio_src(src: str) -> bool:
    return src.startswith("/assets/audio/") and "_loop." in src


def _new_video_path(ext: str = ".mp4") -> tuple[Path, str]:
    name = f"{generate(size=12)}{ext}"
    return UPLOADS_ROOT / "video" / name, f"/files/video/{name}"


def _ffmpeg(*args: str, timeout: int = 300) -> None:
    result = subprocess.run(["ffmpeg", "-y", *args], capture_output=True, timeout=timeout)
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace")[-400:]
        raise HTTPException(500, {"error": f"ffmpeg failed: {detail}", "code": "FFMPEG_ERROR"})


def _has_audio_stream(path: Path) -> bool:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-select_streams", "a:0",
            "-show_entries", "stream=index",
            "-of", "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


def _video_rotation(path: Path) -> int:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream_tags=rotate:stream_side_data=rotation",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        return 0

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return 0

    streams = data.get("streams") or []
    if not streams:
        return 0

    stream = streams[0]
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


def _rotation_filter(rotation: int) -> str | None:
    normalized = rotation % 360
    if normalized == 90:
        return "transpose=2"
    if normalized == 270:
        return "transpose=1"
    if normalized == 180:
        return "hflip,vflip"
    return None


def _require_video(timeline: Timeline) -> Path:
    if not timeline.video_src:
        raise HTTPException(400, {"error": "No video uploaded yet.", "code": "NO_VIDEO"})
    path = _src_to_path(timeline.video_src)
    if not path.exists():
        raise HTTPException(404, {"error": "Video file not found.", "code": "FILE_NOT_FOUND"})
    return path


def _ms_to_srt_time(ms: int) -> str:
    ms = max(0, ms)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _ms_to_ass_time(ms: int) -> str:
    ms = max(0, ms)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    cs = ms // 10
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _hex_to_ass_primary_color(hex_color: str) -> str:
    value = hex_color.removeprefix("#")
    if len(value) != 6:
        value = "ffffff"
    rr, gg, bb = value[0:2], value[2:4], value[4:6]
    return f"&H{bb}{gg}{rr}&"


def _ass_escape(text: str) -> str:
    return (
        text.replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\n", r"\N")
    )


def _subtitle_alignment(position: str) -> int:
    if position == "top":
        return 8
    if position == "center":
        return 5
    return 2


def _write_ass_subtitles(path: str, cues: list[SubtitleCue], trim_start: int, trim_end: int) -> bool:
    events: list[str] = []
    clip_duration = trim_end - trim_start
    for cue in cues:
        start_ms = cue.start_ms - trim_start
        end_ms = cue.end_ms - trim_start
        if end_ms <= 0 or start_ms >= clip_duration:
            continue

        start_ms = max(0, start_ms)
        end_ms = min(clip_duration, end_ms)
        style = cue.style
        overrides = (
            rf"{{\fs{style.font_size}"
            rf"\1c{_hex_to_ass_primary_color(style.color)}"
            rf"\an{_subtitle_alignment(style.position)}}}"
        )
        events.append(
            "Dialogue: 0,"
            f"{_ms_to_ass_time(start_ms)},{_ms_to_ass_time(end_ms)},Default,,0,0,0,,"
            f"{overrides}{_ass_escape(cue.text)}"
        )

    if not events:
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write(
            "[Script Info]\n"
            "ScriptType: v4.00+\n"
            "ScaledBorderAndShadow: yes\n"
            "\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
            "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
            "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Default,DejaVu Sans,24,&H00FFFFFF,&H00FFFFFF,&H90000000,&H70000000,"
            "0,0,0,0,100,100,0,0,3,1,0,2,40,40,36,1\n"
            "\n"
            "[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )
        f.write("\n".join(events))
        f.write("\n")

    return True


# ─── trim (metadata only) ──────────────────────────────────────────────────────

class TrimRequest(BaseModel):
    start_ms: int = Field(default=0, ge=0)
    end_ms: int = Field(gt=0)


@router.post("/trim")
async def trim_video(req: TrimRequest):
    """Set the trim in/out window. No ffmpeg — pure metadata, applied at export."""
    timeline = await get_timeline()
    _require_video(timeline)

    if req.end_ms <= req.start_ms:
        raise HTTPException(400, {"error": "end_ms must be greater than start_ms.", "code": "VALIDATION_ERROR"})
    if req.end_ms > timeline.duration_ms:
        raise HTTPException(400, {
            "error": f"end_ms ({req.end_ms}) exceeds video duration ({timeline.duration_ms}).",
            "code": "VALIDATION_ERROR",
        })

    state = timeline.model_dump(by_alias=True)
    state["trim_start_ms"] = req.start_ms
    state["trim_end_ms"] = req.end_ms

    updated = Timeline.model_validate(state)
    await save_timeline(updated)
    return {"timeline": updated}


@router.post("/trim/reset")
async def reset_trim():
    """Clear the trim window — show the full source video again."""
    timeline = await get_timeline()
    state = timeline.model_dump(by_alias=True)
    state["trim_start_ms"] = 0
    state["trim_end_ms"] = None
    updated = Timeline.model_validate(state)
    await save_timeline(updated)
    return {"timeline": updated}


# ─── crop (metadata only) ──────────────────────────────────────────────────────

class CropRequest(BaseModel):
    aspect_ratio: str = Field(description="'16:9', '9:16', '1:1', '4:3', '21:9'")


@router.post("/crop")
async def crop_video(req: CropRequest):
    """Set the crop aspect ratio. No ffmpeg — applied at export, previewed in player."""
    ratio = req.aspect_ratio.strip()
    if ratio not in CROP_FILTERS:
        raise HTTPException(400, {
            "error": f"Unsupported aspect ratio '{ratio}'. Options: {', '.join(CROP_FILTERS)}",
            "code": "VALIDATION_ERROR",
        })

    timeline = await get_timeline()
    _require_video(timeline)

    state = timeline.model_dump(by_alias=True)
    state["crop_aspect_ratio"] = ratio
    updated = Timeline.model_validate(state)
    await save_timeline(updated)
    return {"timeline": updated}


@router.post("/crop/reset")
async def reset_crop():
    """Clear the crop — restore the original aspect ratio in the player."""
    timeline = await get_timeline()
    state = timeline.model_dump(by_alias=True)
    state["crop_aspect_ratio"] = None
    updated = Timeline.model_validate(state)
    await save_timeline(updated)
    return {"timeline": updated}


# ─── export (the only destructive operation) ───────────────────────────────────

@router.post("/export")
async def export_video():
    """
    Render the final video, applying ALL pending edits in one pass:
      trim window → crop → mix music (volume + fades) → burn in subtitles.
    """
    timeline = await get_timeline()
    src_path = _require_video(timeline)
    out_path, out_url = _new_video_path(".mp4")
    source_clips = timeline.clips
    if not source_clips:
        source_clips = [
            type("LegacyClip", (), {
                "id": "clip_legacy",
                "src": timeline.video_src,
                "start_ms": 0,
                "end_ms": timeline.duration_ms,
                "duration_ms": timeline.duration_ms,
            })()
        ]

    clip_paths = [_src_to_path(clip.src) for clip in source_clips]
    missing_clip = next((path for path in clip_paths if not path.exists()), None)
    if missing_clip is not None:
        raise HTTPException(404, {"error": f"Clip file not found: {missing_clip.name}", "code": "FILE_NOT_FOUND"})

    trim_start = timeline.trim_start_ms
    trim_end = timeline.trim_end_ms if timeline.trim_end_ms is not None else timeline.duration_ms
    clip_dur_s = (trim_end - trim_start) / 1000.0

    valid_music = [
        track
        for track in timeline.music
        if track.src and _src_to_path(track.src).exists() and track.end_ms > trim_start and track.start_ms < trim_end
    ]
    has_music = bool(valid_music)
    has_subs = bool(timeline.subtitles)
    crop = timeline.crop_aspect_ratio

    target_w = timeline.resolution.width
    target_h = timeline.resolution.height

    inputs: list[str] = []
    filter_complex_parts: list[str] = []
    concat_labels: list[str] = []
    for index, (clip, path) in enumerate(zip(source_clips, clip_paths)):
        inputs += ["-noautorotate", "-display_rotation", "0", "-i", str(path)]
        rotate_filter = _rotation_filter(_video_rotation(path))
        video_chain = f"[{index}:v]"
        if rotate_filter:
            video_chain += f"{rotate_filter},"
        video_chain += (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2,"
            f"setsar=1,fps={timeline.fps},format=yuv420p[vclip{index}]"
        )
        filter_complex_parts.append(video_chain)

        duration_s = clip.duration_ms / 1000
        if _has_audio_stream(path):
            filter_complex_parts.append(
                f"[{index}:a]atrim=0:{duration_s:.3f},asetpts=PTS-STARTPTS[aclip{index}]"
            )
        else:
            filter_complex_parts.append(
                f"anullsrc=channel_layout=stereo:sample_rate=44100,"
                f"atrim=0:{duration_s:.3f},asetpts=PTS-STARTPTS[aclip{index}]"
            )
        concat_labels.append(f"[vclip{index}][aclip{index}]")

    filter_complex_parts.append(
        f"{''.join(concat_labels)}concat=n={len(source_clips)}:v=1:a=1[basev][basea]"
    )
    filter_complex_parts.append(
        f"[basev]trim=start={trim_start / 1000:.3f}:end={trim_end / 1000:.3f},"
        "setpts=PTS-STARTPTS[vseq]"
    )
    filter_complex_parts.append(
        f"[basea]atrim=start={trim_start / 1000:.3f}:end={trim_end / 1000:.3f},"
        "asetpts=PTS-STARTPTS[a0]"
    )

    # Build final video filter chain: crop → subtitles.
    video_filters: list[str] = []
    if crop and crop in CROP_FILTERS:
        video_filters.append(CROP_FILTERS[crop])
    if crop:
        video_filters.append("setsar=1")

    subtitle_tmp: str | None = None
    if has_subs:
        tmp = tempfile.NamedTemporaryFile(suffix=".ass", delete=False)
        subtitle_tmp = tmp.name
        tmp.close()
        if _write_ass_subtitles(subtitle_tmp, timeline.subtitles, trim_start, trim_end):
            escaped = subtitle_tmp.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
            video_filters.append(f"subtitles='{escaped}'")

    if video_filters:
        filter_complex_parts.append(f"[vseq]{','.join(video_filters)}[vout]")
        video_map = "[vout]"
    else:
        video_map = "[vseq]"

    audio_labels: list[str] = ["[a0]"]
    for offset, track in enumerate(valid_music, start=1):
        input_index = len(source_clips) + offset - 1
        if _is_looping_audio_src(track.src):
            inputs += ["-stream_loop", "-1"]
        inputs += ["-i", str(_src_to_path(track.src))]

        clip_start_ms = max(track.start_ms, trim_start)
        clip_end_ms = min(track.end_ms, trim_end)
        track_dur_s = (clip_end_ms - clip_start_ms) / 1000
        delay_ms = clip_start_ms - trim_start
        source_offset_s = max(0, trim_start - track.start_ms) / 1000
        fade_in_s = track.fade_in_ms / 1000
        fade_out_s = track.fade_out_ms / 1000
        fade_out_start = max(0, track_dur_s - fade_out_s)
        label = f"a{input_index}"

        af = f"[{input_index}:a]atrim=start={source_offset_s:.3f}:duration={track_dur_s:.3f}"
        af += ",asetpts=PTS-STARTPTS"
        af += f",adelay={delay_ms}|{delay_ms}"
        af += f",volume={track.volume}"
        if fade_in_s > 0:
            af += f",afade=t=in:st=0:d={min(fade_in_s, track_dur_s):.3f}"
        if fade_out_s > 0:
            af += f",afade=t=out:st={fade_out_start:.3f}:d={fade_out_s}"
        af += f"[{label}]"
        filter_complex_parts.append(af)
        audio_labels.append(f"[{label}]")

    audio_map: str | None = None
    if len(audio_labels) == 1:
        audio_map = audio_labels[0]
    elif len(audio_labels) > 1:
        filter_complex_parts.append(
            f"{''.join(audio_labels)}amix=inputs={len(audio_labels)}:duration=longest:dropout_transition=0:normalize=0[aout]"
        )
        audio_map = "[aout]"

    cmd = [*inputs]
    if filter_complex_parts:
        cmd += ["-filter_complex", ";".join(filter_complex_parts)]
    cmd += ["-map", video_map]
    if audio_map:
        cmd += ["-map", audio_map]
    else:
        cmd += ["-map", "0:a?"]  # keep source audio if present
    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-map_metadata", "-1",
        "-metadata:s:v:0", "rotate=0",
        "-c:a", "aac",
        "-b:a", "192k",
        str(out_path),
    ]

    try:
        _ffmpeg(*cmd)
    finally:
        if subtitle_tmp:
            try:
                os.unlink(subtitle_tmp)
            except OSError:
                pass

    return {"url": out_url}


@router.get("/export/download")
async def download_export(url: str):
    rel = url.removeprefix("/files/")
    path = UPLOADS_ROOT / rel
    if not path.exists():
        raise HTTPException(404, {"error": "Export file not found.", "code": "FILE_NOT_FOUND"})
    return FileResponse(str(path), media_type="video/mp4", filename="export.mp4")

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ResourceType = Literal["music", "subtitle", "clip"]
SubtitlePosition = Literal["bottom", "top", "center"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class Resolution(StrictModel):
    width: int = Field(ge=1)
    height: int = Field(ge=1)


class SubtitleStyle(StrictModel):
    font_size: int = Field(default=24, ge=8, le=120)
    color: str = Field(default="#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")
    position: SubtitlePosition = "bottom"


class SubtitleStyleUpdate(StrictModel):
    font_size: int | None = Field(default=None, ge=8, le=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    position: SubtitlePosition | None = None


class TimedItem(StrictModel):
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_ms <= self.start_ms:
            raise ValueError("end_ms must be greater than start_ms")
        return self


class MusicCreate(TimedItem):
    src: str = ""
    volume: float = Field(default=0.6, ge=0.0, le=1.0)
    fade_in_ms: int = Field(default=1000, ge=0)
    fade_out_ms: int = Field(default=2000, ge=0)


class MusicTrack(MusicCreate):
    id: str


class VideoClip(TimedItem):
    id: str
    src: str
    duration_ms: int = Field(gt=0)
    resolution: Resolution


class MusicUpdate(StrictModel):
    src: str | None = None
    start_ms: int | None = Field(default=None, ge=0)
    end_ms: int | None = Field(default=None, gt=0)
    volume: float | None = Field(default=None, ge=0.0, le=1.0)
    fade_in_ms: int | None = Field(default=None, ge=0)
    fade_out_ms: int | None = Field(default=None, ge=0)


class SubtitleCreate(TimedItem):
    text: str = Field(min_length=1)
    style: SubtitleStyle = Field(default_factory=SubtitleStyle)


class SubtitleCue(SubtitleCreate):
    id: str


class SubtitleUpdate(StrictModel):
    text: str | None = Field(default=None, min_length=1)
    start_ms: int | None = Field(default=None, ge=0)
    end_ms: int | None = Field(default=None, gt=0)
    style: SubtitleStyleUpdate | None = None


CropAspectRatio = Literal["16:9", "9:16", "1:1", "4:3", "21:9"]


class Timeline(StrictModel):
    id: str = Field(default="tl_001", alias="_id")
    name: str
    duration_ms: int = Field(gt=0)  # full source video duration — never changes on trim
    fps: int = Field(gt=0)
    resolution: Resolution
    video_src: str = ""
    clips: list[VideoClip] = Field(default_factory=list)
    music: list[MusicTrack] = Field(default_factory=list)
    subtitles: list[SubtitleCue] = Field(default_factory=list)

    # ── Non-destructive edits — applied only at export ──
    trim_start_ms: int = Field(default=0, ge=0)
    trim_end_ms: int | None = Field(default=None)   # None = end of source
    crop_aspect_ratio: CropAspectRatio | None = None
    video_volume: float = Field(default=1.0, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def validate_items_fit_timeline(self):
        for item in [*self.clips, *self.music, *self.subtitles]:
            if item.end_ms > self.duration_ms:
                raise ValueError(
                    f"{item.id} end_ms ({item.end_ms}) exceeds timeline duration_ms ({self.duration_ms})"
                )
        for index, clip in enumerate(self.clips):
            if clip.duration_ms != clip.end_ms - clip.start_ms:
                raise ValueError(f"{clip.id} duration_ms must equal end_ms - start_ms")
            if index > 0 and clip.start_ms != self.clips[index - 1].end_ms:
                raise ValueError(f"{clip.id} must start when the previous clip ends")
        if self.trim_end_ms is not None:
            if self.trim_end_ms > self.duration_ms:
                raise ValueError(
                    f"trim_end_ms ({self.trim_end_ms}) exceeds source duration ({self.duration_ms})"
                )
            if self.trim_end_ms <= self.trim_start_ms:
                raise ValueError("trim_end_ms must be greater than trim_start_ms")
        return self


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"] = "user"
    content: str


class ChatRequest(StrictModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(StrictModel):
    response: str
    timeline: Timeline
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


class ErrorResponse(StrictModel):
    error: str
    code: str

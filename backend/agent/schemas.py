from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.timeline import MusicCreate, MusicUpdate, ResourceType, SubtitleCreate, SubtitleUpdate


class ToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ListItemsArgs(ToolArgs):
    resource_type: ResourceType


class CreateItemArgs(ToolArgs):
    resource_type: ResourceType
    data: MusicCreate | SubtitleCreate

    @model_validator(mode="before")
    @classmethod
    def coerce_data_for_resource(cls, values: Any):
        if not isinstance(values, dict) or not isinstance(values.get("data"), dict):
            return values
        if values.get("resource_type") == "music":
            return {**values, "data": MusicCreate.model_validate(values["data"])}
        if values.get("resource_type") == "subtitle":
            return {**values, "data": SubtitleCreate.model_validate(values["data"])}
        return values

    @model_validator(mode="after")
    def validate_data_matches_resource(self):
        if self.resource_type == "music" and not isinstance(self.data, MusicCreate):
            raise ValueError("data must match MusicCreate for resource_type='music'")
        if self.resource_type == "subtitle" and not isinstance(self.data, SubtitleCreate):
            raise ValueError("data must match SubtitleCreate for resource_type='subtitle'")
        return self


class UpdateItemArgs(ToolArgs):
    resource_type: ResourceType
    item_id: str = Field(description="Must be an ID from the current timeline state")
    updates: MusicUpdate | SubtitleUpdate

    @model_validator(mode="before")
    @classmethod
    def coerce_updates_for_resource(cls, values: Any):
        if not isinstance(values, dict) or not isinstance(values.get("updates"), dict):
            return values
        if values.get("resource_type") == "music":
            return {**values, "updates": MusicUpdate.model_validate(values["updates"])}
        if values.get("resource_type") == "subtitle":
            return {**values, "updates": SubtitleUpdate.model_validate(values["updates"])}
        return values

    @model_validator(mode="after")
    def validate_updates_match_resource(self):
        if self.resource_type == "music" and not isinstance(self.updates, MusicUpdate):
            raise ValueError("updates must match MusicUpdate for resource_type='music'")
        if self.resource_type == "subtitle" and not isinstance(self.updates, SubtitleUpdate):
            raise ValueError("updates must match SubtitleUpdate for resource_type='subtitle'")
        return self


class DeleteItemArgs(ToolArgs):
    resource_type: ResourceType
    item_id: str = Field(description="Must be an ID from the current timeline state")


class ReplaceSubtitleTextArgs(ToolArgs):
    find_text: str = Field(
        min_length=1,
        description="Exact word or phrase currently present in subtitle text.",
    )
    replace_text: str = Field(
        min_length=1,
        description="Replacement word or phrase. Existing cue timing and style are preserved.",
    )
    item_id: str | None = Field(
        default=None,
        description="Optional subtitle cue ID. Omit to replace every matching subtitle cue.",
    )
    case_sensitive: bool = False


class ListAudioAssetsArgs(ToolArgs):
    kind: Literal["music", "sfx"] | None = Field(
        default=None,
        description="Optional filter. Use music for background tracks and sfx for short sound effects.",
    )


class AddAudioAssetArgs(ToolArgs):
    asset_id: str = Field(description="ID returned by list_audio_assets.")
    start_ms: int | None = Field(
        default=None,
        ge=0,
        description="Start time in milliseconds. Defaults to 0 for music and timeline midpoint for sfx.",
    )
    end_ms: int | None = Field(
        default=None,
        gt=0,
        description="Optional end time in milliseconds. Music defaults to the timeline end; sfx defaults to asset duration.",
    )
    volume: float | None = Field(default=None, ge=0.0, le=1.0)


class ProcessVideoArgs(ToolArgs):
    operation: Literal["trim", "crop", "export", "transcribe"] = Field(
        description="trim: set a time range. crop: change aspect ratio. export: render final video. transcribe: generate subtitles from the uploaded video's audio."
    )
    start_ms: int | None = Field(
        default=None,
        description="For trim only — start time in milliseconds. Defaults to 0.",
    )
    end_ms: int | None = Field(
        default=None,
        description="For trim only — end time in milliseconds.",
    )
    aspect_ratio: str | None = Field(
        default=None,
        description="For crop only — target aspect ratio. Options: '16:9', '9:16', '1:1', '4:3', '21:9'.",
    )


ToolName = Literal[
    "list_items",
    "create_item",
    "update_item",
    "delete_item",
    "replace_subtitle_text",
    "list_audio_assets",
    "add_audio_asset",
    "process_video",
]

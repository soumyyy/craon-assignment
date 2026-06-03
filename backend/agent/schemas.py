from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.timeline import MusicCreate, MusicUpdate, ResourceType, SubtitleCreate, SubtitleUpdate


class ToolArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ListItemsArgs(ToolArgs):
    resource_type: ResourceType


class CreateItemArgs(ToolArgs):
    resource_type: ResourceType
    data: MusicCreate | SubtitleCreate

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


class ProcessVideoArgs(ToolArgs):
    operation: Literal["trim", "crop", "export"] = Field(
        description="trim: cut to a time range. crop: change aspect ratio. export: render final video with music + subtitles."
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


ToolName = Literal["list_items", "create_item", "update_item", "delete_item", "process_video"]

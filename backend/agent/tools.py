from typing import Any

from nanoid import generate
from pydantic import ValidationError

from agent.schemas import CreateItemArgs, DeleteItemArgs, ListItemsArgs, ToolName, UpdateItemArgs
from db.timeline import get_timeline, save_timeline
from models.timeline import MusicTrack, SubtitleCue, Timeline


MODEL_BY_TOOL: dict[str, type[ListItemsArgs | CreateItemArgs | UpdateItemArgs | DeleteItemArgs]] = {
    "list_items": ListItemsArgs,
    "create_item": CreateItemArgs,
    "update_item": UpdateItemArgs,
    "delete_item": DeleteItemArgs,
}


def ok_result(**values: Any) -> dict[str, Any]:
    return {"ok": True, **values}


def error_result(error: str, code: str) -> dict[str, Any]:
    return {"ok": False, "error": error, "code": code}


def pre_validate(tool_name: str, raw_args: dict[str, Any]) -> tuple[bool, Any]:
    model = MODEL_BY_TOOL.get(tool_name)
    if model is None:
        return False, error_result(f"Unknown tool '{tool_name}'", "UNKNOWN_TOOL")
    try:
        return True, model.model_validate(raw_args)
    except ValidationError as exc:
        return False, error_result(str(exc), "VALIDATION_ERROR")


def _items_for_resource(timeline: Timeline, resource_type: str):
    return timeline.music if resource_type == "music" else timeline.subtitles


def _collection_key(resource_type: str) -> str:
    return "music" if resource_type == "music" else "subtitles"


def _validate_timeline_update(timeline: Timeline, resource_type: str, item_id: str, updates: dict[str, Any]) -> Timeline:
    state = timeline.model_dump()
    key = _collection_key(resource_type)
    items = state[key]

    for index, item in enumerate(items):
        if item["id"] == item_id:
            if resource_type == "subtitle" and "style" in updates and updates["style"] is not None:
                updates = {**updates, "style": {**item.get("style", {}), **updates["style"]}}
            next_item = {**item, **{key: value for key, value in updates.items() if value is not None}}
            items[index] = next_item
            return Timeline.model_validate(state)

    raise KeyError(item_id)


async def list_items(args: ListItemsArgs) -> dict[str, Any]:
    timeline = await get_timeline()
    items = [item.model_dump() for item in _items_for_resource(timeline, args.resource_type)]
    return ok_result(items=items, message=f"listed {len(items)} {args.resource_type} item(s)")


async def create_item(args: CreateItemArgs) -> dict[str, Any]:
    timeline = await get_timeline()
    state = timeline.model_dump()

    if args.resource_type == "music":
        item = MusicTrack(id=f"music_{generate(size=8)}", **args.data.model_dump())
        state["music"].append(item.model_dump())
        message = f"music {item.id} created"
    else:
        item = SubtitleCue(id=f"sub_{generate(size=8)}", **args.data.model_dump())
        state["subtitles"].append(item.model_dump())
        message = f"subtitle {item.id} created"

    try:
        next_timeline = Timeline.model_validate(state)
    except ValidationError as exc:
        return error_result(str(exc), "VALIDATION_ERROR")

    await save_timeline(next_timeline)
    return ok_result(item=item.model_dump(), message=message)


async def update_item(args: UpdateItemArgs) -> dict[str, Any]:
    timeline = await get_timeline()
    updates = args.updates.model_dump(exclude_none=True)
    if not updates:
        return error_result("No update fields were provided", "VALIDATION_ERROR")

    try:
        next_timeline = _validate_timeline_update(
            timeline,
            args.resource_type,
            args.item_id,
            updates,
        )
    except KeyError:
        return error_result(
            f"No {args.resource_type} with id '{args.item_id}' exists on this timeline",
            "NOT_FOUND",
        )
    except ValidationError as exc:
        return error_result(str(exc), "VALIDATION_ERROR")

    await save_timeline(next_timeline)
    items = _items_for_resource(next_timeline, args.resource_type)
    updated = next(item for item in items if item.id == args.item_id)
    return ok_result(item=updated.model_dump(), message=f"{args.resource_type} {args.item_id} updated")


async def delete_item(args: DeleteItemArgs) -> dict[str, Any]:
    timeline = await get_timeline()
    state = timeline.model_dump()
    key = _collection_key(args.resource_type)
    before = len(state[key])
    state[key] = [item for item in state[key] if item["id"] != args.item_id]

    if len(state[key]) == before:
        return error_result(
            f"No {args.resource_type} with id '{args.item_id}' exists on this timeline",
            "NOT_FOUND",
        )

    next_timeline = Timeline.model_validate(state)
    await save_timeline(next_timeline)
    return ok_result(message=f"{args.resource_type} {args.item_id} deleted")


async def execute_tool(tool_name: ToolName, raw_args: dict[str, Any]) -> dict[str, Any]:
    valid, args_or_error = pre_validate(tool_name, raw_args)
    if not valid:
        return args_or_error

    if tool_name == "list_items":
        return await list_items(args_or_error)
    if tool_name == "create_item":
        return await create_item(args_or_error)
    if tool_name == "update_item":
        return await update_item(args_or_error)
    if tool_name == "delete_item":
        return await delete_item(args_or_error)

    return error_result(f"Unknown tool '{tool_name}'", "UNKNOWN_TOOL")

from typing import Any

from nanoid import generate
from pydantic import ValidationError

import httpx

from agent.audio_assets import get_audio_asset, list_audio_assets as catalog_audio_assets
from agent.schemas import (
    AddAudioAssetArgs,
    CreateItemArgs,
    DeleteItemArgs,
    ListAudioAssetsArgs,
    ListItemsArgs,
    ProcessVideoArgs,
    ReplaceSubtitleTextArgs,
    ToolName,
    UpdateItemArgs,
)
from db.timeline import get_timeline, save_timeline
from models.timeline import MusicTrack, SubtitleCue, Timeline

MODEL_BY_TOOL: dict[str, Any] = {
    "list_items":     ListItemsArgs,
    "create_item":    CreateItemArgs,
    "update_item":    UpdateItemArgs,
    "delete_item":    DeleteItemArgs,
    "replace_subtitle_text": ReplaceSubtitleTextArgs,
    "list_audio_assets": ListAudioAssetsArgs,
    "add_audio_asset": AddAudioAssetArgs,
    "process_video":  ProcessVideoArgs,
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
    if resource_type == "music":
        return timeline.music
    if resource_type == "clip":
        return timeline.clips
    return timeline.subtitles


def _collection_key(resource_type: str) -> str:
    if resource_type == "music":
        return "music"
    if resource_type == "clip":
        return "clips"
    return "subtitles"


def _valid_audio_src(src: str) -> bool:
    return not src or src.startswith("/files/audio/") or src.startswith("/assets/audio/")


def _validate_timeline_update(timeline: Timeline, resource_type: str, item_id: str, updates: dict[str, Any]) -> Timeline:
    if resource_type == "music" and "src" in updates and not _valid_audio_src(updates["src"]):
        raise ValueError("Music src must be empty, an uploaded /files/audio/... URL, or a built-in /assets/audio/... URL.")

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
        if not _valid_audio_src(args.data.src):
            return error_result(
                "Music src must be empty, an uploaded /files/audio/... URL, or a built-in /assets/audio/... URL.",
                "VALIDATION_ERROR",
            )
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
    except ValueError as exc:
        return error_result(str(exc), "VALIDATION_ERROR")
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

    # Clips must stay contiguous — re-stitch start/end and update duration_ms.
    if args.resource_type == "clip":
        if not state["clips"]:
            # All clips removed — reset timeline to empty state.
            state["duration_ms"] = 1000
            state["video_src"] = ""
            state["trim_start_ms"] = 0
            state["trim_end_ms"] = None
        else:
            cursor = 0
            for clip in state["clips"]:
                dur = clip["duration_ms"]
                clip["start_ms"] = cursor
                clip["end_ms"] = cursor + dur
                cursor += dur
            state["duration_ms"] = cursor

    next_timeline = Timeline.model_validate(state)
    await save_timeline(next_timeline)
    return ok_result(message=f"{args.resource_type} {args.item_id} deleted")


def _replace_text(text: str, find_text: str, replace_text: str, case_sensitive: bool) -> tuple[str, int]:
    if case_sensitive:
        return text.replace(find_text, replace_text), text.count(find_text)

    lower_text = text.lower()
    lower_find = find_text.lower()
    find_len = len(find_text)
    cursor = 0
    count = 0
    chunks: list[str] = []

    while True:
        index = lower_text.find(lower_find, cursor)
        if index == -1:
            chunks.append(text[cursor:])
            break
        chunks.append(text[cursor:index])
        chunks.append(replace_text)
        cursor = index + find_len
        count += 1

    return "".join(chunks), count


async def replace_subtitle_text(args: ReplaceSubtitleTextArgs) -> dict[str, Any]:
    timeline = await get_timeline()
    state = timeline.model_dump()
    changed_ids: list[str] = []
    replacements = 0

    for cue in state["subtitles"]:
        if args.item_id is not None and cue["id"] != args.item_id:
            continue

        next_text, count = _replace_text(
            cue["text"],
            args.find_text,
            args.replace_text,
            args.case_sensitive,
        )
        if count:
            cue["text"] = next_text
            changed_ids.append(cue["id"])
            replacements += count

    if args.item_id is not None and not any(cue["id"] == args.item_id for cue in state["subtitles"]):
        return error_result(f"No subtitle with id '{args.item_id}' exists on this timeline", "NOT_FOUND")

    if not changed_ids:
        scope = f" in {args.item_id}" if args.item_id else ""
        return error_result(f"Could not find '{args.find_text}'{scope}.", "NOT_FOUND")

    next_timeline = Timeline.model_validate(state)
    await save_timeline(next_timeline)

    return ok_result(
        changed_ids=changed_ids,
        replacements=replacements,
        message=(
            f"replaced '{args.find_text}' with '{args.replace_text}' "
            f"in {len(changed_ids)} subtitle cue(s)"
        ),
    )


async def list_audio_assets(args: ListAudioAssetsArgs) -> dict[str, Any]:
    assets = catalog_audio_assets(args.kind)
    return ok_result(
        assets=assets,
        message=f"listed {len(assets)} built-in audio asset(s)",
    )


async def add_audio_asset(args: AddAudioAssetArgs) -> dict[str, Any]:
    asset = get_audio_asset(args.asset_id)
    if asset is None:
        return error_result(f"No built-in audio asset with id '{args.asset_id}' exists", "NOT_FOUND")

    timeline = await get_timeline()
    start_ms = args.start_ms
    if start_ms is None:
        start_ms = 0 if asset["kind"] == "music" else max(0, timeline.duration_ms // 2)

    if start_ms >= timeline.duration_ms:
        return error_result("Audio asset start_ms must be inside the timeline.", "VALIDATION_ERROR")

    if args.end_ms is not None:
        end_ms = args.end_ms
    elif asset["kind"] == "music":
        end_ms = timeline.duration_ms
    else:
        end_ms = min(timeline.duration_ms, start_ms + asset["duration_ms"])

    if end_ms <= start_ms:
        return error_result("Audio asset end_ms must be greater than start_ms.", "VALIDATION_ERROR")

    track = MusicTrack(
        id=f"music_{generate(size=8)}",
        src=asset["src"],
        start_ms=start_ms,
        end_ms=end_ms,
        volume=args.volume if args.volume is not None else asset["default_volume"],
        fade_in_ms=asset["fade_in_ms"],
        fade_out_ms=asset["fade_out_ms"],
    )

    state = timeline.model_dump()
    state["music"].append(track.model_dump())
    next_timeline = Timeline.model_validate(state)
    await save_timeline(next_timeline)

    return ok_result(
        item=track.model_dump(),
        asset=asset,
        message=f"added {asset['label']} from {start_ms / 1000:g}s to {end_ms / 1000:g}s",
    )


async def process_video(args: ProcessVideoArgs) -> dict[str, Any]:
    """Proxy to the /video/* REST endpoints, which run ffmpeg."""
    op = args.operation
    try:
        async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=300) as client:
            if op == "trim":
                if args.end_ms is None:
                    return error_result("end_ms is required for trim.", "VALIDATION_ERROR")
                resp = await client.post("/video/trim", json={
                    "start_ms": args.start_ms or 0,
                    "end_ms": args.end_ms,
                })
            elif op == "crop":
                if not args.aspect_ratio:
                    return error_result("aspect_ratio is required for crop.", "VALIDATION_ERROR")
                resp = await client.post("/video/crop", json={"aspect_ratio": args.aspect_ratio})
            elif op == "export":
                resp = await client.post("/video/export")
            elif op == "transcribe":
                resp = await client.post("/transcribe")
            else:
                return error_result(f"Unknown operation '{op}'", "VALIDATION_ERROR")

        if resp.status_code != 200:
            detail = resp.json().get("detail", {})
            err = detail.get("error", resp.text) if isinstance(detail, dict) else str(detail)
            return error_result(err, "FFMPEG_ERROR")

        data = resp.json()
        # Don't echo the full timeline back to the model — wastes tokens.
        if op == "trim":
            clip_len = (args.end_ms - (args.start_ms or 0)) / 1000
            return ok_result(message=f"trim window set: {(args.start_ms or 0)/1000:g}s to {args.end_ms/1000:g}s (clip is {clip_len:g}s). Preview updated; not yet rendered.")
        if op == "crop":
            return ok_result(message=f"crop preview set to {args.aspect_ratio}. Player reframed; not yet rendered.")
        if op == "export":
            return ok_result(message="final video rendered", url=data.get("url"))
        if op == "transcribe":
            return ok_result(
                message=f"generated {data.get('count', 0)} subtitle(s) from the video's audio.",
                count=data.get("count", 0),
            )
        return ok_result(message="done")

    except httpx.TimeoutException:
        return error_result("Video processing timed out — try a shorter clip.", "TIMEOUT")
    except Exception as exc:
        return error_result(str(exc), "INTERNAL_ERROR")


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
    if tool_name == "replace_subtitle_text":
        return await replace_subtitle_text(args_or_error)
    if tool_name == "list_audio_assets":
        return await list_audio_assets(args_or_error)
    if tool_name == "add_audio_asset":
        return await add_audio_asset(args_or_error)
    if tool_name == "process_video":
        return await process_video(args_or_error)

    return error_result(f"Unknown tool '{tool_name}'", "UNKNOWN_TOOL")

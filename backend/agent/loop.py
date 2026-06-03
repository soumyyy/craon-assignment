import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from openai import AsyncOpenAI, pydantic_function_tool

from agent.schemas import (
    AddAudioAssetArgs,
    CreateItemArgs,
    DeleteItemArgs,
    ListAudioAssetsArgs,
    ListItemsArgs,
    ProcessVideoArgs,
    ReplaceSubtitleTextArgs,
    UpdateItemArgs,
)
from agent.system_prompt import build_system_prompt
from agent.tools import execute_tool
from db.timeline import get_timeline, save_timeline
from models.timeline import ChatMessage, Timeline

load_dotenv()

MAX_ITERATIONS = 6


def _parse_absolute_music_volume(message: str) -> float | None:
    text = message.lower()
    if "volume" not in text:
        return None
    if re.search(r"\bby\s+\d+(?:\.\d+)?\s*%", text):
        return None

    match = re.search(r"\bvolume\b.*?\b(?:to|at)\s*(\d+(?:\.\d+)?)\s*%", text)
    if match is None:
        match = re.search(
            r"\b(?:set|change|make|adjust|lower|reduce|turn)\b.*?\bvolume\b.*?(\d+(?:\.\d+)?)\s*%",
            text,
        )
    if match is None:
        return None

    pct = float(match.group(1))
    if pct < 0 or pct > 100:
        return None
    return pct / 100


def _mentioned_music_ids(message: str, timeline: Timeline) -> set[str]:
    text = message.lower()
    return {track.id for track in timeline.music if track.id.lower() in text}


async def _handle_music_volume_request(message: str) -> tuple[str, list[dict[str, Any]]] | None:
    volume = _parse_absolute_music_volume(message)
    if volume is None:
        return None

    timeline = await get_timeline()
    if not timeline.music:
        return "There are no music tracks to update.", []

    mentioned_ids = _mentioned_music_ids(message, timeline)
    target_ids = mentioned_ids or {track.id for track in timeline.music}
    state = timeline.model_dump()
    updated_ids: list[str] = []

    for track in state["music"]:
        if track["id"] in target_ids:
            track["volume"] = volume
            updated_ids.append(track["id"])

    if not updated_ids:
        return "I couldn't find the requested music track to update.", []

    next_timeline = Timeline.model_validate(state)
    await save_timeline(next_timeline)

    volume_pct = round(volume * 100)
    if len(updated_ids) == 1:
        message_text = f"Background music volume set to {volume_pct}%."
    elif len(updated_ids) == len(timeline.music):
        message_text = f"All music tracks set to {volume_pct}% volume."
    else:
        message_text = f"Updated {len(updated_ids)} music tracks to {volume_pct}% volume."

    return message_text, [
        {
            "tool": "update_item",
            "args": {
                "resource_type": "music",
                "item_ids": updated_ids,
                "updates": {"volume": volume},
            },
            "result": {"ok": True, "updated_ids": updated_ids},
        }
    ]


def _tool_definitions():
    return [
        pydantic_function_tool(
            ListItemsArgs,
            name="list_items",
            description=(
                "List all music tracks or subtitle cues. Call this first for positional "
                "or name references such as 'the first subtitle' or 'background music'."
            ),
        ),
        pydantic_function_tool(
            CreateItemArgs,
            name="create_item",
            description=(
                "Create one music track or subtitle cue. Music fields: src, start_ms, "
                "end_ms, volume, fade_in_ms, fade_out_ms. Subtitle fields: text, "
                "start_ms, end_ms, style.font_size, style.color, style.position."
            ),
        ),
        pydantic_function_tool(
            UpdateItemArgs,
            name="update_item",
            description=(
                "Update one existing music track or subtitle cue by ID. Include only "
                "the fields to change. Partial updates are supported."
            ),
        ),
        pydantic_function_tool(
            DeleteItemArgs,
            name="delete_item",
            description="Delete one existing music track or subtitle cue by ID.",
        ),
        pydantic_function_tool(
            ReplaceSubtitleTextArgs,
            name="replace_subtitle_text",
            description=(
                "Replace an exact word or phrase inside existing subtitle cue text. "
                "Use this for spelling, casing, name, typo, and correction requests like "
                "'not Hexolith, it is Hexalith'. It preserves every cue's timing and style."
            ),
        ),
        pydantic_function_tool(
            ListAudioAssetsArgs,
            name="list_audio_assets",
            description="List built-in audio assets for random background music or sound effects.",
        ),
        pydantic_function_tool(
            AddAudioAssetArgs,
            name="add_audio_asset",
            description=(
                "Add one built-in audio asset to the timeline. Use an asset_id returned by "
                "list_audio_assets. Useful for random music or short sound effects."
            ),
        ),
        pydantic_function_tool(
            ProcessVideoArgs,
            name="process_video",
            description=(
                "Run an ffmpeg video operation on the uploaded video file. "
                "Operations: "
                "'trim' — cut the video to a time range (provide start_ms and end_ms); "
                "'crop' — change the aspect ratio of the video (provide aspect_ratio: '16:9', '9:16', '1:1', '4:3', '21:9'); "
                "'export' — render the final video with music mixed in and subtitles burned in (no extra params needed); "
                "'transcribe' — generate subtitles from the uploaded video's speech. "
                "IMPORTANT: Only call this when the user explicitly asks to cut/trim the video, crop/resize it, export/download the final result, or generate subtitles from speech. "
                "Do NOT call this for subtitle or music edits — use the CRUD tools for those."
            ),
        ),
    ]


def _strip_history(history: list[ChatMessage]) -> list[dict[str, str]]:
    clean = []
    for message in history[-20:]:
        clean.append({"role": message.role, "content": message.content})
    return clean


def _client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return AsyncOpenAI(api_key=api_key)


async def run_agent(message: str, history: list[ChatMessage]) -> tuple[str, list[dict[str, Any]]]:
    handled = await _handle_music_volume_request(message)
    if handled is not None:
        return handled

    timeline = await get_timeline()
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": build_system_prompt(timeline)},
        *_strip_history(history),
        {"role": "user", "content": message},
    ]
    tool_calls_log: list[dict[str, Any]] = []
    tools = _tool_definitions()
    client = _client()
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    failed_tool_calls = 0
    successful_tool_calls = 0
    last_tool_error: str | None = None

    for _ in range(MAX_ITERATIONS):
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,
            temperature=0,
            parallel_tool_calls=False,
        )
        assistant_message = response.choices[0].message

        if not assistant_message.tool_calls:
            if failed_tool_calls and successful_tool_calls == 0:
                return f"I couldn't apply that change: {last_tool_error or 'the tool call failed.'}", tool_calls_log
            return assistant_message.content or "Done.", tool_calls_log

        messages.append(assistant_message.model_dump(exclude_none=True))

        for tool_call in assistant_message.tool_calls:
            tool_name = tool_call.function.name
            try:
                args = json.loads(tool_call.function.arguments or "{}")
            except json.JSONDecodeError as exc:
                result = {
                    "ok": False,
                    "error": f"Invalid tool JSON: {exc}",
                    "code": "VALIDATION_ERROR",
                }
            else:
                result = await execute_tool(tool_name, args)

            tool_calls_log.append({"tool": tool_name, "args": args, "result": result})
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                }
            )

            if not result.get("ok"):
                last_tool_error = result.get("error", "The tool call failed.")
                if failed_tool_calls >= 1:
                    return result.get("error", "The tool call failed."), tool_calls_log
                failed_tool_calls += 1
            else:
                successful_tool_calls += 1

    return "I wasn't able to complete that in one go - try rephrasing or simplifying the request.", tool_calls_log

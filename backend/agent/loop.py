import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import AsyncOpenAI, pydantic_function_tool

from agent.schemas import CreateItemArgs, DeleteItemArgs, ListItemsArgs, UpdateItemArgs
from agent.system_prompt import build_system_prompt
from agent.tools import execute_tool
from db.timeline import get_timeline
from models.timeline import ChatMessage

load_dotenv()

MAX_ITERATIONS = 6


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
                if failed_tool_calls >= 1:
                    return result.get("error", "The tool call failed."), tool_calls_log
                failed_tool_calls += 1

    return "I wasn't able to complete that in one go - try rephrasing or simplifying the request.", tool_calls_log

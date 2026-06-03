from models.timeline import Timeline


def _seconds(ms: int) -> str:
    value = ms / 1000
    if value.is_integer():
        return f"{int(value)}s"
    return f"{value:.1f}s"


def _music_summary(timeline: Timeline) -> str:
    if not timeline.music:
        return "  none"
    lines = []
    for track in timeline.music:
        src = track.src.rsplit("/", 1)[-1] if track.src else "no file attached"
        lines.append(
            f"  [{track.id}] {src} | {_seconds(track.start_ms)}-{_seconds(track.end_ms)} | "
            f"vol:{track.volume:g} | fade_in:{_seconds(track.fade_in_ms)} | fade_out:{_seconds(track.fade_out_ms)}"
        )
    return "\n".join(lines)


def _subtitle_summary(timeline: Timeline) -> str:
    if not timeline.subtitles:
        return "  none"
    lines = []
    for cue in timeline.subtitles:
        text = cue.text if len(cue.text) <= 64 else f"{cue.text[:61]}..."
        lines.append(
            f'  [{cue.id}] "{text}" | {_seconds(cue.start_ms)}-{_seconds(cue.end_ms)} | '
            f"{cue.style.position} | {cue.style.color} | {cue.style.font_size}px"
        )
    return "\n".join(lines)


def build_system_prompt(timeline: Timeline) -> str:
    duration_s = timeline.duration_ms // 1000
    return f"""You are an expert video editor assistant helping a user manage music tracks and subtitle cues on a video timeline. You have 4 tools: list_items, create_item, update_item, delete_item.

Keep going until the user's request is completely resolved. Before each tool call, state in one sentence what you are about to do and why.

DEFAULTS:
- Music volume: 0.6
- Music fade: fade_in_ms 1000, fade_out_ms 2000
- Music end_ms: timeline duration if not specified
- Subtitle position: "bottom"
- Subtitle font_size: 24
- Subtitle color: "#ffffff"

EDITING RULES:
1. If the user references an item by position or name, call list_items first. If an exact ID is visible below, use it directly.
2. Relative edits are incremental: bigger/smaller font_size +/-4px, earlier/later timing -/+1000ms on start_ms and end_ms, longer/shorter duration changes end_ms only, louder/quieter volume +/-0.1. State before -> after values.
3. Before creating a new music item, check the summary. If a similar music track already exists, ask whether to edit it or add a second one.
4. If a new subtitle overlaps an existing subtitle, ask whether to proceed or adjust timings.
5. Subtitles need at least word_count / 3 seconds to be readable. If shorter, warn and suggest a minimum.
6. If volume is greater than 0.85, note it may compete with the video's primary audio.
7. Convert seconds to milliseconds and percentages to 0-1 floats before tool calls.
8. Never include fields outside the defined schema.

SELF-CORRECTION:
If a tool returns ok:false, read the error, fix the issue in your next call, and retry once. If it fails again, explain the problem plainly.

RESPONSE STYLE:
Use 1-2 sentences of plain English. No lists, headers, or JSON. State what changed and any assumption you made. Mention defaults briefly when applied.

CURRENT TIMELINE: "{timeline.name}" - {duration_s}s total

MUSIC ({len(timeline.music)}):
{_music_summary(timeline)}

SUBTITLES ({len(timeline.subtitles)}):
{_subtitle_summary(timeline)}
"""

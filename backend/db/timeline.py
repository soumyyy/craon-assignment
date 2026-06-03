from copy import deepcopy
from typing import Any

from nanoid import generate

from models.timeline import Resolution, Timeline, VideoClip

from .client import get_db

TIMELINE_ID = "tl_001"
COLLECTION = "timelines"


SEED_DOCUMENT: dict[str, Any] = {
    "_id": TIMELINE_ID,
    "name": "Product Launch Cut",
    "duration_ms": 92000,
    "fps": 30,
    "resolution": {"width": 1920, "height": 1080},
    "video_src": "",
    "clips": [],
    "music": [
        {
            "id": "music_001",
            "src": "",
            "start_ms": 0,
            "end_ms": 92000,
            "volume": 0.6,
            "fade_in_ms": 1000,
            "fade_out_ms": 2000,
        }
    ],
    "subtitles": [
        {
            "id": "sub_001",
            "text": "Welcome to the product launch.",
            "start_ms": 500,
            "end_ms": 3500,
            "style": {
                "font_size": 24,
                "color": "#ffffff",
                "position": "bottom",
            },
        },
        {
            "id": "sub_002",
            "text": "Here's what we've built.",
            "start_ms": 4000,
            "end_ms": 7000,
            "style": {
                "font_size": 24,
                "color": "#ffffff",
                "position": "bottom",
            },
        },
    ],
}


def _collection():
    return get_db()[COLLECTION]


def serialize_timeline(timeline: Timeline) -> dict[str, Any]:
    return timeline.model_dump(by_alias=True)


async def seed_timeline(force: bool = False) -> Timeline:
    collection = _collection()
    if force:
        await collection.delete_one({"_id": TIMELINE_ID})

    existing = await collection.find_one({"_id": TIMELINE_ID})
    if existing is None:
        document = deepcopy(SEED_DOCUMENT)
        timeline = Timeline.model_validate(document)
        await collection.insert_one(serialize_timeline(timeline))
        return timeline

    return Timeline.model_validate(existing)


async def get_timeline() -> Timeline:
    document = await _collection().find_one({"_id": TIMELINE_ID})
    if document is None:
        return await seed_timeline()
    return Timeline.model_validate(document)


async def save_timeline(timeline: Timeline) -> Timeline:
    await _collection().replace_one(
        {"_id": timeline.id},
        serialize_timeline(timeline),
        upsert=True,
    )
    return timeline


async def update_video_src(
    video_src: str,
    duration_ms: int | None = None,
    resolution: dict[str, int] | None = None,
) -> Timeline:
    timeline = await get_timeline()
    updates = timeline.model_dump()
    updates["video_src"] = video_src
    updates["trim_start_ms"] = 0
    updates["trim_end_ms"] = None
    updates["crop_aspect_ratio"] = None
    next_duration_ms = duration_ms if duration_ms is not None and duration_ms > 0 else timeline.duration_ms
    next_resolution = resolution or timeline.resolution.model_dump()
    updates["clips"] = [
        VideoClip(
            id=f"clip_{generate(size=8)}",
            src=video_src,
            start_ms=0,
            end_ms=next_duration_ms,
            duration_ms=next_duration_ms,
            resolution=Resolution.model_validate(next_resolution),
        ).model_dump()
    ]
    updates["music"] = []
    updates["subtitles"] = []
    updates["duration_ms"] = next_duration_ms
    updates["resolution"] = next_resolution

    return await save_timeline(Timeline.model_validate(updates))


async def reset_media_timeline() -> Timeline:
    timeline = await get_timeline()
    state = timeline.model_dump()
    state["video_src"] = ""
    state["duration_ms"] = 1
    state["resolution"] = {"width": 1920, "height": 1080}
    state["clips"] = []
    state["music"] = []
    state["subtitles"] = []
    state["trim_start_ms"] = 0
    state["trim_end_ms"] = None
    state["crop_aspect_ratio"] = None
    return await save_timeline(Timeline.model_validate(state))


async def append_video_clip(video_src: str, duration_ms: int, resolution: dict[str, int]) -> Timeline:
    timeline = await get_timeline()
    state = timeline.model_dump()
    if not state["clips"] and timeline.video_src:
        state["clips"].append(
            VideoClip(
                id=f"clip_{generate(size=8)}",
                src=timeline.video_src,
                start_ms=0,
                end_ms=timeline.duration_ms,
                duration_ms=timeline.duration_ms,
                resolution=timeline.resolution,
            ).model_dump()
        )

    start_ms = timeline.duration_ms
    end_ms = start_ms + duration_ms

    state["clips"].append(
        VideoClip(
            id=f"clip_{generate(size=8)}",
            src=video_src,
            start_ms=start_ms,
            end_ms=end_ms,
            duration_ms=duration_ms,
            resolution=Resolution.model_validate(resolution),
        ).model_dump()
    )
    state["duration_ms"] = end_ms
    state["trim_start_ms"] = 0
    state["trim_end_ms"] = None
    state["crop_aspect_ratio"] = None

    return await save_timeline(Timeline.model_validate(state))


async def attach_audio_src(audio_src: str) -> tuple[Timeline, str | None, bool]:
    timeline = await get_timeline()
    updates = timeline.model_dump()

    for track in updates["music"]:
        if not track.get("src"):
            track["src"] = audio_src
            next_timeline = Timeline.model_validate(updates)
            await save_timeline(next_timeline)
            return next_timeline, track["id"], False

    if not updates["music"]:
        track_id = f"music_{generate(size=8)}"
        updates["music"].append(
            {
                "id": track_id,
                "src": audio_src,
                "start_ms": 0,
                "end_ms": timeline.duration_ms,
                "volume": 0.6,
                "fade_in_ms": 1000,
                "fade_out_ms": 2000,
            }
        )
        next_timeline = Timeline.model_validate(updates)
        await save_timeline(next_timeline)
        return next_timeline, track_id, True

    return timeline, None, False

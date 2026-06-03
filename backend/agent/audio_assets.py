from typing import Literal, TypedDict


class AudioAsset(TypedDict):
    id: str
    label: str
    kind: Literal["music", "sfx"]
    mood: str
    src: str
    duration_ms: int
    default_volume: float
    fade_in_ms: int
    fade_out_ms: int


AUDIO_ASSETS: list[AudioAsset] = [
    {
        "id": "ambient_loop",
        "label": "Ambient loop",
        "kind": "music",
        "mood": "soft ambient background",
        "src": "/assets/audio/ambient_loop.mp3",
        "duration_ms": 8000,
        "default_volume": 0.42,
        "fade_in_ms": 1200,
        "fade_out_ms": 1200,
    },
    {
        "id": "pulse_loop",
        "label": "Pulse loop",
        "kind": "music",
        "mood": "upbeat rhythmic background",
        "src": "/assets/audio/pulse_loop.mp3",
        "duration_ms": 8000,
        "default_volume": 0.38,
        "fade_in_ms": 400,
        "fade_out_ms": 800,
    },
    {
        "id": "transition_whoosh",
        "label": "Transition whoosh",
        "kind": "sfx",
        "mood": "transition movement",
        "src": "/assets/audio/transition_whoosh.wav",
        "duration_ms": 1200,
        "default_volume": 0.55,
        "fade_in_ms": 20,
        "fade_out_ms": 400,
    },
    {
        "id": "cinematic_hit",
        "label": "Cinematic hit",
        "kind": "sfx",
        "mood": "dramatic impact",
        "src": "/assets/audio/cinematic_hit.wav",
        "duration_ms": 900,
        "default_volume": 0.65,
        "fade_in_ms": 0,
        "fade_out_ms": 350,
    },
]


def list_audio_assets(kind: str | None = None) -> list[AudioAsset]:
    if kind is None:
        return AUDIO_ASSETS
    return [asset for asset in AUDIO_ASSETS if asset["kind"] == kind]


def get_audio_asset(asset_id: str) -> AudioAsset | None:
    return next((asset for asset in AUDIO_ASSETS if asset["id"] == asset_id), None)

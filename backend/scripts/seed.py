import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from db.client import close_client
from db.timeline import seed_timeline


async def main() -> None:
    timeline = await seed_timeline(force="--force" in sys.argv)
    print(f"seeded {timeline.id}: {len(timeline.subtitles)} subtitles, {len(timeline.music)} music tracks")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        close_client()

from fastapi import APIRouter

from db.timeline import get_timeline
from models.timeline import Timeline

router = APIRouter()


@router.get("/timeline", response_model=Timeline)
async def read_timeline() -> Timeline:
    return await get_timeline()

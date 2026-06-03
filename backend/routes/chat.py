from fastapi import APIRouter, HTTPException

from agent.loop import run_agent
from db.timeline import get_timeline
from models.timeline import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        response, tool_calls = await run_agent(request.message, request.history)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"error": str(exc), "code": "CONFIGURATION_ERROR"}) from exc

    timeline = await get_timeline()
    return ChatResponse(response=response, timeline=timeline, tool_calls=tool_calls)

from fastapi import APIRouter, HTTPException
from openai import APIConnectionError, APIStatusError, AuthenticationError, OpenAIError, RateLimitError

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
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "OpenAI API key was rejected. Check backend/.env and replace OPENAI_API_KEY with a valid key.",
                "code": "OPENAI_AUTH_ERROR",
            },
        ) from exc
    except RateLimitError as exc:
        raise HTTPException(
            status_code=429,
            detail={"error": "OpenAI rate limit exceeded. Try again shortly.", "code": "OPENAI_RATE_LIMIT"},
        ) from exc
    except APIConnectionError as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": "Could not connect to OpenAI. Check network connectivity.", "code": "OPENAI_CONNECTION_ERROR"},
        ) from exc
    except APIStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": f"OpenAI request failed with status {exc.status_code}.", "code": "OPENAI_API_ERROR"},
        ) from exc
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": "OpenAI request failed.", "code": "OPENAI_API_ERROR"},
        ) from exc

    timeline = await get_timeline()
    return ChatResponse(response=response, timeline=timeline, tool_calls=tool_calls)

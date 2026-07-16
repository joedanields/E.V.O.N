"""
Chat router — handles text chat, streaming responses, and conversation management.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.models import (
    ChatRequest,
    ChatResponse,
    Conversation,
    ConversationListItem,
    ConversationSchema,
    FeedbackRequest,
    Message,
    MessageSchema,
    ModelListResponse,
    ModelSwitchRequest,
)
async def get_or_create_conversation(
    db: AsyncSession, conversation_id: Optional[str]
) -> Conversation:
    """Get an existing conversation or create a new one."""
    if conversation_id:
        # BUG-008: Validate UUID format before querying
        if not is_valid_uuid(conversation_id):
            logger.warning("Invalid conversation_id format: '%s', creating new conversation", conversation_id)
        else:
            conv = await db.get(Conversation, conversation_id)
            if conv:
                return conv
            logger.info("conversation_id '%s' not found, creating new conversation", conversation_id)
    conv = Conversation(id=str(uuid.uuid4()))
    db.add(conv)
    await db.flush()
    return conv


async def get_history(
    db: AsyncSession,
    conversation_id: str,
    limit: Optional[int] = None,
    exclude_last: bool = False,
) -> list[dict]:
    """Fetch recent messages formatted for the LLM."""
    if limit is None:
        limit = settings.HISTORY_LIMIT

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(limit + (1 if exclude_last else 0))
    )
    rows = (await db.execute(stmt)).scalars().all()
    rows = list(reversed(rows))
    if exclude_last and rows:
        rows = rows[:-1]
    return [{"role": m.role, "content": m.content} for m in rows if m.role != "system"]
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


# ══════════════════════════════════════════════════════════
#  Chat endpoint (non-streaming)
# ══════════════════════════════════════════════════════════
@router.post("/", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a message and receive a complete response."""
    conversation = await get_or_create_conversation(db, req.conversation_id)

    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="user",
        content=req.message,
        input_mode=req.input_mode,
    )
    db.add(user_msg)
    await db.flush()

    history = await get_history(db, conversation.id)
    messages = llm_service.build_messages(req.message, history=history, images=req.images or None)

    try:
        response_text = await llm_service.chat(messages)
    except Exception as exc:
        logger.error("LLM error: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}")

    assistant_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
        input_mode="text",
    )
    db.add(assistant_msg)

    if len(history) == 0:
        conversation.title = req.message[:100]
    conversation.updated_at = datetime.now(timezone.utc)

    await db.flush()

    return ChatResponse(
        conversation_id=conversation.id,
        message=MessageSchema.model_validate(user_msg),
        response=MessageSchema.model_validate(assistant_msg),
    )


# ══════════════════════════════════════════════════════════
#  Chat endpoint (streaming via SSE)
# BUG-001 FIX: All DB writes happen BEFORE StreamingResponse
# ══════════════════════════════════════════════════════════
@router.post("/stream")
async def chat_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Stream response tokens via Server-Sent Events."""
    conversation = await get_or_create_conversation(db, req.conversation_id)

    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role="user",
        content=req.message,
        input_mode=req.input_mode,
    )
    db.add(user_msg)
    await db.flush()

    history = await get_history(db, conversation.id, exclude_last=True)
    messages = llm_service.build_messages(req.message, history=history, images=req.images or None)

    if len(history) == 0:
        conversation.title = req.message[:100]
    conversation.updated_at = datetime.now(timezone.utc)

    assistant_msg_id = str(uuid.uuid4())

    async def event_stream():
        full_response: list[str] = []
        yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conversation.id, 'message_id': assistant_msg_id})}\n\n"

        try:
            async for token in llm_service.chat_stream(messages):
                full_response.append(token)
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            complete_text = "".join(full_response)
            yield f"data: {json.dumps({'type': 'done', 'content': complete_text})}\n\n"

            # BUG-001 FIX: Use a fresh session to persist after streaming
            async with async_session() as persist_db:
                async with persist_db.begin():
                    asst_msg = Message(
                        id=assistant_msg_id,
                        conversation_id=conversation.id,
                        role="assistant",
                        content=complete_text,
                        input_mode="text",
                    )
                    persist_db.add(asst_msg)

        except Exception as exc:
            logger.error("Stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ══════════════════════════════════════════════════════════
#  Conversations CRUD
# ══════════════════════════════════════════════════════════
@router.get("/conversations", response_model=list[ConversationListItem])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    """List all conversations with message count, newest first."""
    stmt = (
        select(
            Conversation,
            func.count(Message.id).label("msg_count"),
        )
        .outerjoin(Message)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        ConversationListItem(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=count,
        )
        for conv, count in rows
    ]


@router.get("/conversations/{conversation_id}", response_model=ConversationSchema)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Get a conversation with all its messages."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    messages = (await db.execute(stmt)).scalars().all()
    conv_schema = ConversationSchema.model_validate(conv)
    conv_schema.messages = [MessageSchema.model_validate(m) for m in messages]
    return conv_schema


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a conversation and all its messages."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conv)
    return {"status": "deleted", "id": conversation_id}


@router.delete("/conversations")
async def clear_all_conversations(db: AsyncSession = Depends(get_db)):
    """Delete all conversations."""
    result = await db.execute(select(Conversation))
    convs = result.scalars().all()
    for conv in convs:
        await db.delete(conv)
    return {"status": "cleared", "count": len(convs)}


# ══════════════════════════════════════════════════════════
#  FEAT-009: Response Feedback
# ══════════════════════════════════════════════════════════
@router.post("/messages/{message_id}/feedback")
async def set_message_feedback(
    message_id: str,
    req: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Set thumbs up/down feedback on an assistant message."""
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.feedback = None if req.feedback == "none" else req.feedback
    await db.flush()
    return {"status": "ok", "message_id": message_id, "feedback": msg.feedback}


# ══════════════════════════════════════════════════════════
#  PERF-003: Conversations with Pagination
# ══════════════════════════════════════════════════════════
@router.get("/conversations", response_model=list[ConversationListItem])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
    """List conversations with pagination, newest first."""
    stmt = (
        select(
            Conversation,
            func.count(Message.id).label("msg_count"),
        )
        .outerjoin(Message)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        ConversationListItem(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=count,
        )
        for conv, count in rows
    ]


# ══════════════════════════════════════════════════════════
#  MISS-010: Model Listing & Switching
# ══════════════════════════════════════════════════════════
@router.get("/models", response_model=ModelListResponse)
async def list_models():
    """List available Ollama models and the current one."""
    models = await llm_service.list_models()
    return ModelListResponse(models=models, current=llm_service.current_model)


@router.post("/models/switch")
async def switch_model(req: ModelSwitchRequest):
    """Switch the active Ollama model."""
    llm_service.set_model(req.model)
    return {"status": "ok", "model": req.model}

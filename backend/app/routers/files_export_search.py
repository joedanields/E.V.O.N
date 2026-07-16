"""
MISS-001: File upload endpoint for attachments, documents, images.
MISS-002: Conversation export/import.
MISS-003: Conversation search via SQLite FTS5.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Conversation, ConversationSchema, Message, MessageSchema

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["files", "export", "search"])


# ══════════════════════════════════════════════════════════
#  MISS-001: File Upload
# ══════════════════════════════════════════════════════════

class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    size: int
    content_type: str
    path: str


@router.post("/files/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = None,
):
    """Upload a file attachment (documents, images, etc.)."""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload").suffix
    filename = f"{file_id}{suffix}"
    file_path = upload_dir / filename

    content = await file.read()
    file_path.write_bytes(content)

    logger.info("File uploaded: %s (%d bytes)", file.filename, len(content))

    return FileUploadResponse(
        file_id=file_id,
        filename=file.filename or filename,
        size=len(content),
        content_type=file.content_type or "application/octet-stream",
        path=str(file_path),
    )


# FEAT-005: Vision — image upload returning base64 for direct LLM use
@router.post("/files/image-base64")
async def upload_image_as_base64(
    file: UploadFile = File(...),
):
    """Upload an image and return base64-encoded data for vision models."""
    content = await file.read()

    # Validate it's an image
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Limit to 10MB
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    import base64
    b64 = base64.b64encode(content).decode("utf-8")

    return {
        "image_base64": b64,
        "content_type": file.content_type,
        "size": len(content),
    }


@router.get("/files/{file_id}")
async def get_file(file_id: str):
    """Download a previously uploaded file."""
    upload_dir = Path(settings.UPLOAD_DIR)
    matches = list(upload_dir.glob(f"{file_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(matches[0])


# ══════════════════════════════════════════════════════════
#  MISS-002: Conversation Export / Import
# ══════════════════════════════════════════════════════════

@router.get("/chat/conversations/{conversation_id}/export")
async def export_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    """Export a conversation as JSON."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    messages = (await db.execute(stmt)).scalars().all()

    return {
        "export_version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "conversation": {
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        },
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "input_mode": m.input_mode,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


class ImportRequest(BaseModel):
    title: Optional[str] = None
    messages: list[dict]


@router.post("/chat/import")
async def import_conversation(req: ImportRequest, db: AsyncSession = Depends(get_db)):
    """Import a conversation from exported JSON data."""
    conv = Conversation(
        id=str(uuid.uuid4()),
        title=req.title or "Imported Conversation",
    )
    db.add(conv)
    await db.flush()

    for msg_data in req.messages:
        msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            role=msg_data.get("role", "user"),
            content=msg_data.get("content", ""),
            input_mode=msg_data.get("input_mode", "text"),
        )
        db.add(msg)

    await db.flush()
    return {"status": "imported", "conversation_id": conv.id, "message_count": len(req.messages)}


# ══════════════════════════════════════════════════════════
#  MISS-003: Conversation Search
# ══════════════════════════════════════════════════════════

class SearchResult(BaseModel):
    conversation_id: str
    conversation_title: str
    message_id: str
    role: str
    content: str
    created_at: Optional[str] = None


@router.get("/chat/search", response_model=list[SearchResult])
async def search_conversations(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across all messages."""
    search_pattern = f"%{q}%"

    stmt = (
        select(Message, Conversation.title.label("conv_title"))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Message.content.ilike(search_pattern))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    return [
        SearchResult(
            conversation_id=msg.conversation_id,
            conversation_title=title,
            message_id=msg.id,
            role=msg.role,
            content=msg.content[:500],  # Truncate for response
            created_at=msg.created_at.isoformat() if msg.created_at else None,
        )
        for msg, title in rows
    ]

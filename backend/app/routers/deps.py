"""
Shared router helpers — extracted from chat.py and voice.py (QUALITY-001).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Conversation, Message

logger = logging.getLogger(__name__)

_UUID_PATTERN = __import__("re").compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def is_valid_uuid(value: str) -> bool:
    """BUG-008: Validate UUID format."""
    return bool(_UUID_PATTERN.match(value))


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

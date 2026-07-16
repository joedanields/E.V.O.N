"""
FEAT-006: Real-time voice chat via WebSocket.
Streams audio bidirectionally: user audio → STT → LLM → TTS → audio response.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.database import async_session
from app.models import Conversation, Message
from app.services.llm_service import llm_service
from app.services.stt_service import stt_service
from app.services.tts_service import tts_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["voice-ws"])


@router.websocket("/ws/voice")
async def voice_chat_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time voice chat.

    Protocol:
      Client → Server: binary (raw PCM audio chunks) or JSON control messages
      Server → Client: binary (WAV audio chunks) or JSON status messages

    Control messages (client → server):
      {"type": "start", "conversation_id": "optional"}
      {"type": "stop"}
      {"type": "text", "message": "optional text override"}

    Status messages (server → client):
      {"type": "status", "state": "listening|processing|speaking|idle"}
      {"type": "transcript", "text": "..."}
      {"type": "error", "message": "..."}
    """
    await websocket.accept()
    logger.info("Voice WebSocket connected")

    conversation_id: str | None = None
    audio_buffer = bytearray()
    is_recording = False

    async def send_status(state: str):
        await websocket.send_json({"type": "status", "state": state})

    async def send_error(msg: str):
        await websocket.send_json({"type": "error", "message": msg})

    try:
        while True:
            data = await websocket.receive()

            if data.get("type") == "websocket.receive":
                # Binary frame = audio data
                if "bytes" in data and data["bytes"]:
                    if is_recording:
                        audio_buffer.extend(data["bytes"])
                    continue

                # Text frame = JSON control message
                if "text" in data:
                    try:
                        msg = json.loads(data["text"])
                    except json.JSONDecodeError:
                        await send_error("Invalid JSON")
                        continue

                    msg_type = msg.get("type", "")

                    if msg_type == "start":
                        is_recording = True
                        audio_buffer.clear()
                        conversation_id = msg.get("conversation_id")
                        await send_status("listening")
                        logger.info("Voice WS: recording started")

                    elif msg_type == "stop":
                        is_recording = False
                        await send_status("processing")

                        if len(audio_buffer) < 1000:
                            await send_error("Audio too short")
                            await send_status("idle")
                            continue

                        # Run STT
                        try:
                            pcm_bytes = bytes(audio_buffer)
                            audio_buffer.clear()
                            stt_result = await stt_service.transcribe_bytes(pcm_bytes)
                            transcript = stt_result.get("text", "")
                        except Exception as exc:
                            logger.error("STT failed: %s", exc)
                            await send_error(f"STT failed: {exc}")
                            await send_status("idle")
                            continue

                        if not transcript or not transcript.strip():
                            await send_error("No speech detected")
                            await send_status("idle")
                            continue

                        await websocket.send_json({"type": "transcript", "text": transcript})
                        await send_status("processing")

                        # Save to DB
                        async with async_session() as db:
                            async with db.begin():
                                if not conversation_id:
                                    conv = Conversation(
                                        id=str(uuid.uuid4()),
                                        title=transcript[:100],
                                    )
                                    db.add(conv)
                                    await db.flush()
                                    conversation_id = conv.id
                                else:
                                    conv = await db.get(Conversation, conversation_id)
                                    if not conv:
                                        conv = Conversation(
                                            id=conversation_id,
                                            title=transcript[:100],
                                        )
                                        db.add(conv)
                                        await db.flush()

                                user_msg = Message(
                                    id=str(uuid.uuid4()),
                                    conversation_id=conversation_id,
                                    role="user",
                                    content=transcript,
                                    input_mode="voice",
                                )
                                db.add(user_msg)

                        # Run LLM
                        try:
                            async with async_session() as db:
                                stmt = (
                                    select(Message)
                                    .where(Message.conversation_id == conversation_id)
                                    .order_by(Message.created_at)
                                    .limit(20)
                                )
                                rows = (await db.execute(stmt)).scalars().all()
                                history = [{"role": r.role, "content": r.content} for r in rows[:-1]]

                            messages = llm_service.build_messages(transcript, history=history)
                            response_text = await llm_service.chat(messages)
                        except Exception as exc:
                            logger.error("LLM failed: %s", exc)
                            await send_error(f"LLM failed: {exc}")
                            await send_status("idle")
                            continue

                        # Save assistant response
                        async with async_session() as db:
                            async with db.begin():
                                asst_msg = Message(
                                    id=str(uuid.uuid4()),
                                    conversation_id=conversation_id,
                                    role="assistant",
                                    content=response_text,
                                    input_mode="voice",
                                )
                                db.add(asst_msg)

                        # Run TTS
                        await send_status("speaking")
                        try:
                            wav_bytes = await tts_service.synthesize(response_text)
                            if wav_bytes:
                                await websocket.send_bytes(wav_bytes)
                        except Exception as exc:
                            logger.error("TTS failed: %s", exc)
                            await send_error(f"TTS failed: {exc}")

                        await send_status("idle")

                    elif msg_type == "text":
                        # Text override — skip STT
                        text = msg.get("message", "").strip()
                        if not text:
                            await send_error("Empty text")
                            continue
                        await send_status("processing")

                        try:
                            messages = llm_service.build_messages(text)
                            response_text = await llm_service.chat(messages)
                            await send_status("speaking")
                            wav_bytes = await tts_service.synthesize(response_text)
                            if wav_bytes:
                                await websocket.send_bytes(wav_bytes)
                        except Exception as exc:
                            logger.error("Text chat failed: %s", exc)
                            await send_error(str(exc))

                        await send_status("idle")

            elif data.get("type") == "websocket.disconnect":
                break

    except WebSocketDisconnect:
        logger.info("Voice WebSocket disconnected")
    except Exception as exc:
        logger.error("Voice WebSocket error: %s", exc)
    finally:
        logger.info("Voice WebSocket closed")

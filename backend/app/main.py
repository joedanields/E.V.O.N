"""
E.V.O.N. — Enhanced Voice-Operated Nexus
FastAPI application entry point.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine
from app.models import Base
from app.rate_limit import RateLimitMiddleware
from app.routers import chat, system, voice
from app.routers.personas import router as personas_router
from app.routers.files_export_search import router as files_router
from app.routers.tools import router as tools_router
from app.routers.voice_ws import router as voice_ws_router
from app.services.llm_service import llm_service
from app.services.persona_service import persona_manager
from app.services.stt_service import stt_service
from app.services.tts_service import tts_service

# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("evon")


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / Shutdown lifecycle."""
    logger.info("═" * 60)
    logger.info("  E.V.O.N. — Starting up …")
    logger.info("═" * 60)

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database ready.")

    # Initialize services
    try:
        await stt_service.load_model()
    except Exception as exc:
        logger.warning("STT model load failed (will retry on first use): %s", exc)

    await llm_service.initialize()
    await tts_service.initialize()
    await persona_manager.initialize()  # FEAT-007: Load personas

    # Check Ollama health
    if await llm_service.health_check():
        models = await llm_service.list_models()
        logger.info("Ollama connected — models: %s", models)
    else:
        logger.warning("Ollama not reachable at %s", settings.OLLAMA_BASE_URL)

    logger.info("═" * 60)
    logger.info("  E.V.O.N. — Online and ready.")
    logger.info("═" * 60)

    yield  # ← Application runs here

    # Shutdown
    logger.info("E.V.O.N. shutting down …")
    await llm_service.shutdown()


# ── App ──────────────────────────────────────────────────
app = FastAPI(
    title="E.V.O.N. — Enhanced Voice-Operated Nexus",
    description="Offline AI assistant powered by Whisper + Ollama + Piper TTS",
    version="1.0.0",
    lifespan=lifespan,
)

# SEC-004: Restricted CORS — only needed methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# SEC-005: Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Static files for TTS output
app.mount("/static/tts", StaticFiles(directory=settings.TTS_OUTPUT_DIR), name="tts")

# Routers
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(system.router)
app.include_router(personas_router)   # FEAT-007: Personas API
app.include_router(files_router)      # MISS-001/002/003: Files, Export, Search
app.include_router(tools_router)      # FEAT-004: Tool System
app.include_router(voice_ws_router)   # FEAT-006: Real-time voice WebSocket


# ── Root ─────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": "E.V.O.N.",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    """Public health check — returns minimal info for external consumers."""
    ollama_ok = await llm_service.health_check()
    return {
        "status": "healthy" if ollama_ok else "degraded",
        "services": {
            "llm": "connected" if ollama_ok else "disconnected",
        },
    }


@app.get("/api/health/detail")
async def health_detail():
    """Internal detailed health check — for admin/monitoring use."""
    ollama_ok = await llm_service.health_check()
    models = await llm_service.list_models() if ollama_ok else []
    return {
        "status": "healthy" if ollama_ok else "degraded",
        "ollama": {
            "status": "connected" if ollama_ok else "disconnected",
            "url": settings.OLLAMA_BASE_URL,
            "available_models": models,
        },
        "stt": "loaded" if stt_service._model is not None else "not loaded",
        "tts": "available" if tts_service._piper_available else "pyttsx3 fallback",
    }

"""
Text-to-Speech service.

Primary: Piper TTS (fast, local, ONNX-based).
Fallback: pyttsx3 (system voices, zero setup).
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Generates speech audio from text, fully offline."""

    def __init__(self) -> None:
        self._piper_available: bool = False
        self._pyttsx3_engine: object | None = None
        self._cache: dict[str, bytes] = {}
        self._cache_max: int = 100

    # ──────────────────────────────────────────────────────
    #  Lifecycle
    # ──────────────────────────────────────────────────────
    async def initialize(self) -> None:
        """Probe for Piper binary / model. Fall back to pyttsx3."""
        piper_model = Path(settings.PIPER_MODEL_PATH)
        piper_config = Path(settings.PIPER_CONFIG_PATH)

        if piper_model.exists() and piper_config.exists():
            # Verify piper binary is accessible
            try:
                result = subprocess.run(
                    ["piper", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                self._piper_available = result.returncode == 0
            except (FileNotFoundError, subprocess.TimeoutExpired):
                self._piper_available = False

        if self._piper_available:
            logger.info("Piper TTS available — model: %s", piper_model.name)
        else:
            logger.warning("Piper TTS not available. Falling back to pyttsx3.")
            self._init_pyttsx3()

    def _init_pyttsx3(self) -> None:
        try:
            import pyttsx3
            self._pyttsx3_engine = pyttsx3.init()
            # Slightly faster, natural-sounding rate
            self._pyttsx3_engine.setProperty("rate", 175)  # type: ignore[union-attr]
            logger.info("pyttsx3 TTS engine initialized.")
        except Exception as exc:
            logger.error("Failed to initialize pyttsx3: %s", exc)

    # ──────────────────────────────────────────────────────
    #  Synthesis
    # ──────────────────────────────────────────────────────
    async def synthesize(self, text: str) -> bytes:
        """
        Convert text → WAV bytes.
        Returns raw WAV audio suitable for streaming to the client.
        Uses MD5-keyed cache to avoid re-synthesizing identical text.
        """
        if not text.strip():
            return b""

        # PERF-002: Check cache first
        cache_key = hashlib.md5(text.encode("utf-8")).hexdigest()
        if cache_key in self._cache:
            logger.debug("TTS cache hit for text (len=%d)", len(text))
            return self._cache[cache_key]

        if self._piper_available:
            wav = await self._synthesize_piper(text)
        elif self._pyttsx3_engine is not None:
            wav = await self._synthesize_pyttsx3(text)
        else:
            raise RuntimeError("No TTS engine available.")

        # PERF-002: Store in cache (evict oldest if full)
        if wav and len(self._cache) >= self._cache_max:
            self._cache.pop(next(iter(self._cache)))
        if wav:
            self._cache[cache_key] = wav

        return wav

    async def _synthesize_piper(self, text: str) -> bytes:
        """Run Piper TTS as an async subprocess, return WAV bytes."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "piper",
                "--model", settings.PIPER_MODEL_PATH,
                "--config", settings.PIPER_CONFIG_PATH,
                "--output-raw",
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=text.encode("utf-8")),
                timeout=60,
            )
            if proc.returncode != 0:
                logger.error("Piper error: %s", stderr.decode())
                return await self._synthesize_pyttsx3(text)

            raw_pcm = stdout
            return self._pcm_to_wav(raw_pcm, sample_rate=settings.TTS_SAMPLE_RATE, channels=1, sample_width=2)

        except asyncio.TimeoutError:
            logger.error("Piper TTS timed out.")
            return await self._synthesize_pyttsx3(text)

    async def _synthesize_pyttsx3(self, text: str) -> bytes:
        """Use pyttsx3 to generate WAV via asyncio.to_thread (non-blocking)."""
        if self._pyttsx3_engine is None:
            await asyncio.to_thread(self._init_pyttsx3)
        if self._pyttsx3_engine is None:
            raise RuntimeError("pyttsx3 engine not available.")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            await asyncio.to_thread(
                self._pyttsx3_engine.save_to_file, text, tmp_path  # type: ignore[union-attr]
            )
            await asyncio.to_thread(
                self._pyttsx3_engine.runAndWait  # type: ignore[union-attr]
            )
            return Path(tmp_path).read_bytes()
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    # ──────────────────────────────────────────────────────
    #  Helpers
    # ──────────────────────────────────────────────────────
    @staticmethod
    def _pcm_to_wav(
        pcm_data: bytes,
        sample_rate: int = 22050,
        channels: int = 1,
        sample_width: int = 2,
    ) -> bytes:
        """Wrap raw PCM data in a WAV header."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(sample_width)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_data)
        return buf.getvalue()

    async def synthesize_to_file(self, text: str, output_path: str | Path) -> Path:
        """Synthesize and write to a file. Returns the output path."""
        wav_bytes = await self.synthesize(text)
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(wav_bytes)
        return out


# Module-level singleton
tts_service = TTSService()

"""
FEAT-007: Custom Personas — predefined and user-created AI personalities.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

from app.config import BASE_DIR

logger = logging.getLogger(__name__)

PERSONAS_FILE = BASE_DIR / "data" / "personas.json"


class Persona(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    icon: str = "🤖"
    voice: Optional[str] = None  # TTS voice override


# Built-in personas
BUILTIN_PERSONAS: list[Persona] = [
    Persona(
        id="default",
        name="E.V.O.N.",
        description="Your default helpful AI assistant",
        system_prompt=(
            "You are E.V.O.N. (Enhanced Voice-Operated Nexus), an advanced AI "
            "assistant that runs entirely offline. You are helpful, witty, precise, and "
            "knowledgeable. You respond concisely. When explaining code, you are thorough "
            "but clear. You can help manage system tasks, answer questions, and engage in "
            "natural conversation. Address the user respectfully."
        ),
        icon="⚡",
    ),
    Persona(
        id="code-tutor",
        name="Code Tutor",
        description="Patient coding teacher who explains step-by-step",
        system_prompt=(
            "You are a patient and experienced code tutor. You explain programming "
            "concepts clearly with examples. You break down complex topics into simple steps. "
            "You encourage learning by asking questions and suggesting exercises. "
            "You cover all languages but specialize in Python, JavaScript, and systems programming."
        ),
        icon="👩‍🏫",
    ),
    Persona(
        id="creative-writer",
        name="Creative Writer",
        description="Imaginative storyteller and writing assistant",
        system_prompt=(
            "You are a creative writing assistant with a vivid imagination. "
            "You help with stories, poems, scripts, and creative brainstorming. "
            "You use evocative language and offer multiple creative directions. "
            "You can write in any genre and style. Be imaginative but constructive in feedback."
        ),
        icon="✍️",
    ),
    Persona(
        id="devops-helper",
        name="DevOps Helper",
        description="Infrastructure and deployment specialist",
        system_prompt=(
            "You are a DevOps and infrastructure expert. You help with Docker, "
            "Kubernetes, CI/CD pipelines, cloud services, monitoring, and system administration. "
            "You provide production-ready configurations and follow security best practices. "
            "You explain the 'why' behind infrastructure decisions."
        ),
        icon="🔧",
    ),
    Persona(
        id="data-analyst",
        name="Data Analyst",
        description="Data science and visualization expert",
        system_prompt=(
            "You are a data analyst and data science expert. You help with data analysis, "
            "visualization, statistics, SQL queries, Python pandas, and machine learning concepts. "
            "You explain statistical methods clearly and suggest appropriate visualizations. "
            "You focus on actionable insights from data."
        ),
        icon="📊",
    ),
]


class PersonaManager:
    """Manage built-in and custom personas."""

    def __init__(self) -> None:
        self._custom_personas: list[Persona] = []

    async def initialize(self) -> None:
        """Load custom personas from disk."""
        if PERSONAS_FILE.exists():
            try:
                data = json.loads(PERSONAS_FILE.read_text(encoding="utf-8"))
                self._custom_personas = [Persona(**p) for p in data]
                logger.info("Loaded %d custom personas", len(self._custom_personas))
            except Exception as exc:
                logger.error("Failed to load personas: %s", exc)

    async def _save_custom(self) -> None:
        PERSONAS_FILE.parent.mkdir(parents=True, exist_ok=True)
        PERSONAS_FILE.write_text(
            json.dumps([p.model_dump() for p in self._custom_personas], indent=2),
            encoding="utf-8",
        )

    def list_all(self) -> list[Persona]:
        return BUILTIN_PERSONAS + self._custom_personas

    def get(self, persona_id: str) -> Optional[Persona]:
        for p in self.list_all():
            if p.id == persona_id:
                return p
        return None

    async def create(self, persona: Persona) -> Persona:
        # Prevent overwriting built-in personas
        if any(p.id == persona.id for p in BUILTIN_PERSONAS):
            raise ValueError(f"Cannot overwrite built-in persona: {persona.id}")
        self._custom_personas.append(persona)
        await self._save_custom()
        return persona

    async def delete(self, persona_id: str) -> bool:
        original_len = len(self._custom_personas)
        self._custom_personas = [p for p in self._custom_personas if p.id != persona_id]
        if len(self._custom_personas) < original_len:
            await self._save_custom()
            return True
        return False


persona_manager = PersonaManager()

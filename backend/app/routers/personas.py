"""
FEAT-007: Personas router — list, get, create, delete AI personas.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.persona_service import Persona, persona_manager

router = APIRouter(prefix="/api/personas", tags=["personas"])


class PersonaCreateRequest(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    icon: str = "🤖"


@router.get("/", response_model=list[Persona])
async def list_personas():
    """List all available personas (built-in + custom)."""
    return persona_manager.list_all()


@router.get("/{persona_id}", response_model=Persona)
async def get_persona(persona_id: str):
    """Get a specific persona by ID."""
    persona = persona_manager.get(persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found")
    return persona


@router.post("/", response_model=Persona)
async def create_persona(req: PersonaCreateRequest):
    """Create a custom persona."""
    try:
        persona = Persona(
            id=req.id,
            name=req.name,
            description=req.description,
            system_prompt=req.system_prompt,
            icon=req.icon,
        )
        return await persona_manager.create(persona)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{persona_id}")
async def delete_persona(persona_id: str):
    """Delete a custom persona (cannot delete built-in)."""
    deleted = await persona_manager.delete(persona_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found or is built-in")
    return {"status": "deleted", "id": persona_id}

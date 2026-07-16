"""
FEAT-004: Tools router — list and execute LLM tools.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.tool_service import tool_executor

router = APIRouter(prefix="/api/tools", tags=["tools"])


class ToolExecuteRequest(BaseModel):
    tool: str
    arguments: dict = {}


@router.get("/")
async def list_tools():
    """List all available tools the LLM can use."""
    return {"tools": tool_executor.list_tools()}


@router.post("/execute")
async def execute_tool(req: ToolExecuteRequest):
    """Execute a tool by name with given arguments."""
    result = await tool_executor.execute(req.tool, req.arguments)
    return {"tool": req.tool, "result": result}

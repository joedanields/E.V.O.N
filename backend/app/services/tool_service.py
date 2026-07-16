"""
FEAT-004: Plugin / Tool System skeleton.
Allows the LLM to call external tools: calculator, system info, web lookup.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import platform
from datetime import datetime
from typing import Any, Callable

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════
#  Tool Registry
# ══════════════════════════════════════════════════════════

class Tool:
    """Represents a callable tool the LLM can use."""

    def __init__(self, name: str, description: str, parameters: dict, handler: Callable):
        self.name = name
        self.description = description
        self.parameters = parameters  # JSON Schema for parameters
        self.handler = handler

    def to_schema(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


# ── Built-in tools ──────────────────────────────────────

async def calculator_handler(expression: str) -> str:
    """Safe math evaluator — only allows math operations."""
    allowed_names = {
        "abs": abs, "round": round, "min": min, "max": max,
        "sum": sum, "pow": pow, "sqrt": math.sqrt,
        "pi": math.pi, "e": math.e,
        "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "log": math.log, "log10": math.log10,
        "floor": math.floor, "ceil": math.ceil,
    }
    try:
        # Only allow safe math expressions
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return str(result)
    except Exception as exc:
        return f"Calculator error: {exc}"


async def current_time_handler(timezone_offset: int = 0) -> str:
    """Get the current date and time."""
    now = datetime.utcnow()
    return now.strftime("%Y-%m-%d %H:%M:%S UTC")


async def system_info_handler(category: str = "all") -> str:
    """Get basic system information."""
    info = {
        "os": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
        "machine": platform.machine(),
    }
    return json.dumps(info, indent=2)


# ── Tool Registry ────────────────────────────────────────

TOOL_REGISTRY: dict[str, Tool] = {
    "calculator": Tool(
        name="calculator",
        description="Evaluate a mathematical expression. Supports basic arithmetic, powers, trigonometry, logarithms.",
        parameters={
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression to evaluate, e.g. '2**10', 'sqrt(144)', 'sin(pi/2)'",
                }
            },
            "required": ["expression"],
        },
        handler=calculator_handler,
    ),
    "current_time": Tool(
        name="current_time",
        description="Get the current date and time.",
        parameters={"type": "object", "properties": {}},
        handler=current_time_handler,
    ),
    "system_info": Tool(
        name="system_info",
        description="Get basic system information (OS, Python version, architecture).",
        parameters={
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["all", "os", "python"],
                    "description": "What info to return",
                }
            },
        },
        handler=system_info_handler,
    ),
}


class ToolExecutor:
    """Execute registered tools."""

    def __init__(self):
        self._tools = TOOL_REGISTRY.copy()

    def list_tools(self) -> list[dict]:
        return [t.to_schema() for t in self._tools.values()]

    async def execute(self, tool_name: str, arguments: dict) -> str:
        tool = self._tools.get(tool_name)
        if not tool:
            return f"Unknown tool: {tool_name}"

        logger.info("Executing tool: %s(%s)", tool_name, arguments)
        try:
            result = await tool.handler(**arguments)
            return result
        except Exception as exc:
            return f"Tool execution error: {exc}"


# Module-level executor
tool_executor = ToolExecutor()

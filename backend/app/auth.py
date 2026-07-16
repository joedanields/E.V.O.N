"""
SEC-002: API Key authentication middleware for E.V.O.N.
Provides optional API key protection for all endpoints.
When API_KEY is not set, auth is disabled (for local development).
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader

from app.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(
    request: Request,
    api_key: Optional[str] = Depends(_api_key_header),
) -> Optional[str]:
    """
    Verify API key if one is configured.
    If settings.API_KEY is empty/None, auth is bypassed (local dev mode).
    Returns the validated key or None.
    """
    configured_key = settings.API_KEY
    if not configured_key:
        # No API key configured — open access (local development)
        return None

    if api_key is None:
        raise HTTPException(
            status_code=401,
            detail="Missing X-API-Key header. Set API_KEY in .env to enable auth.",
        )

    if api_key != configured_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key.",
        )

    return api_key

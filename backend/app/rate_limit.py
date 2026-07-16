"""
SEC-005: Rate limiting middleware for E.V.O.N.
Uses a simple in-memory token bucket — no external dependencies needed.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Default rate limits: requests per window_seconds
DEFAULT_RATE_LIMIT = 60        # requests
DEFAULT_WINDOW_SECONDS = 60    # 1 minute

# Stricter limits for voice/LLM endpoints
STRICT_RATE_LIMIT = 15
STRICT_WINDOW_SECONDS = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding-window rate limiter.
    Tracks request counts per client IP.
    """

    def __init__(self, app, default_limit: int = DEFAULT_RATE_LIMIT,
                 default_window: int = DEFAULT_WINDOW_SECONDS):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self._requests: dict[str, list[float]] = defaultdict(list)
        # Paths that get stricter limits
        self._strict_paths = {"/api/voice/", "/api/chat/stream", "/api/chat/"}

    def _get_limits(self, path: str) -> tuple[int, int]:
        for strict_path in self._strict_paths:
            if path.startswith(strict_path):
                return STRICT_RATE_LIMIT, STRICT_WINDOW_SECONDS
        return self.default_limit, self.default_window

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        now = time.time()
        limit, window = self._get_limits(request.url.path)

        # Clean old entries
        cutoff = now - window
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if t > cutoff
        ]

        if len(self._requests[client_ip]) >= limit:
            retry_after = int(self._requests[client_ip][0] + window - now) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Max {limit} requests per {window}s.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        self._requests[client_ip].append(now)
        response = await call_next(request)
        return response

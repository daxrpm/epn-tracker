"""Redis-based rate limiting (ERS §25.2).

Uses a counter with a per-window expiry. If Redis is unavailable it fails open (does not block) so
local development without Redis keeps working.
"""

from __future__ import annotations

from app.common.exception.errors import RateLimitError
from app.core.logging import get_logger
from app.database.redis import redis_client

logger = get_logger("app.rate_limit")


async def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Incrementa el contador de ``key``; lanza ``RateLimitError`` si supera ``limit``."""
    try:
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, window_seconds)
    except Exception as exc:  # pragma: no cover - degrade gracefully without Redis
        logger.warning("Rate limit disabled (Redis unavailable): %s", exc)
        return

    if current > limit:
        raise RateLimitError("Demasiados intentos. Intenta más tarde.")

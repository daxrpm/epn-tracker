"""Redis-based rate limiting (ERS §25.2).

Uses a counter with a per-window expiry. If Redis is unavailable it fails open (does not block) so
local development without Redis keeps working.
"""

from __future__ import annotations

from app.common.exception.errors import RateLimitError
from app.core.conf import settings
from app.core.logging import get_logger
from app.database.redis import redis_client

logger = get_logger("app.rate_limit")


async def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Increment the counter for ``key``; raise ``RateLimitError`` past ``limit``.

    Redis being unreachable is only survivable in development. Outside dev the throttle is a
    security control, so a broken counter must fail closed and be loud rather than silently
    removing login and verification-code limits.
    """
    try:
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, window_seconds)
    except Exception as exc:
        if settings.is_dev:
            logger.warning("Rate limit disabled (Redis unavailable in dev): %s", exc)
            return
        logger.error("Rate limit backend unavailable; refusing the request: %s", exc)
        raise RateLimitError(
            "El servicio no está disponible en este momento. Intenta más tarde."
        ) from exc

    if current > limit:
        raise RateLimitError("Demasiados intentos. Intenta más tarde.")

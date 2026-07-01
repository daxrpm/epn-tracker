"""Rate limiting basado en Redis (ERS §25.2).

Usa un contador con expiración por ventana. Si Redis no está disponible, falla de forma abierta
(no bloquea) para no romper el desarrollo local sin Redis.
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
    except Exception as exc:  # pragma: no cover - degradación si no hay Redis
        logger.warning("Rate limit deshabilitado (Redis no disponible): %s", exc)
        return

    if current > limit:
        raise RateLimitError("Demasiados intentos. Intenta más tarde.")

"""Redis-backed refresh-token registry enabling rotation, revocation and reuse detection.

Each issued refresh token's ``jti`` is stored in an allowlist keyed by user. Refreshing consumes the
old ``jti`` and stores a new one (rotation). Presenting a ``jti`` that is not in the allowlist means
the token was already used or revoked, which is treated as a security event.
"""

from __future__ import annotations

from app.core.conf import settings
from app.database.redis import redis_client

_TTL_SECONDS = settings.refresh_token_expire_days * 24 * 3600


def _key(user_id: str, jti: str) -> str:
    return f"auth:refresh:{user_id}:{jti}"


def _pattern(user_id: str) -> str:
    return f"auth:refresh:{user_id}:*"


async def remember(user_id: str, jti: str) -> None:
    await redis_client.set(_key(user_id, jti), "1", ex=_TTL_SECONDS)


async def is_active(user_id: str, jti: str) -> bool:
    return bool(await redis_client.exists(_key(user_id, jti)))


async def revoke(user_id: str, jti: str) -> None:
    await redis_client.delete(_key(user_id, jti))


async def revoke_all(user_id: str) -> None:
    """Revoke every refresh token for a user (e.g. on reuse detection or password reset)."""
    keys = [key async for key in redis_client.scan_iter(match=_pattern(user_id))]
    if keys:
        await redis_client.delete(*keys)

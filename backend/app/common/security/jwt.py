"""JWT issuing and verification (short-lived access + rotating refresh tokens)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt

from app.common.exception.errors import AuthError
from app.core.conf import settings

TokenType = Literal["access", "refresh"]


def new_jti() -> str:
    """Return a fresh unique token identifier."""
    return uuid.uuid4().hex


def _encode(subject: str, token_type: TokenType, expires: timedelta, jti: str, **extra: Any) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "nbf": now,
        "exp": now + expires,
        "jti": jti,
        **extra,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, **extra: Any) -> str:
    return _encode(
        subject,
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
        new_jti(),
        **extra,
    )


def create_refresh_token(subject: str, jti: str, **extra: Any) -> str:
    """Create a refresh token with a caller-supplied ``jti`` so it can be tracked for rotation."""
    return _encode(
        subject,
        "refresh",
        timedelta(days=settings.refresh_token_expire_days),
        jti,
        **extra,
    )


def decode_token(token: str, expected_type: TokenType | None = None) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "type", "jti"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("El token expiró.") from exc
    except jwt.PyJWTError as exc:
        raise AuthError("Token inválido.") from exc

    if expected_type is not None and payload.get("type") != expected_type:
        raise AuthError("Tipo de token incorrecto.")
    return payload

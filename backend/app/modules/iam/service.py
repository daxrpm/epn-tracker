"""Authentication and EPN email-code registration (ERS §RF-001, §RF-002, §25).

Business rules only; persistence is delegated to ``crud`` and token bookkeeping to ``token_store``.
User-facing messages are in Spanish (product locale).
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import UserStatus
from app.common.exception.errors import AuthError, ForbiddenError, RateLimitError
from app.common.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    new_jti,
)
from app.common.security.password import hash_password, verify_password
from app.core.conf import settings
from app.core.email import get_email_sender
from app.core.rate_limit import enforce_rate_limit
from app.database.redis import redis_client
from app.modules.iam import crud, token_store
from app.modules.iam.model import User
from app.modules.iam.schema import TokenOut


def _generate_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def _code_key(email: str) -> str:
    return f"verify:code:{email}"


def _attempts_key(email: str) -> str:
    return f"verify:attempts:{email}"


def _resend_key(email: str) -> str:
    return f"verify:resend:{email}"


async def request_verification_code(db: AsyncSession, email: str, client_ip: str) -> None:
    """Generate and email a code. Never reveals whether the account exists (neutral response).

    Throttled per address *and* per origin: an email-only counter lets anyone burn a victim's
    quota, and an origin-only counter lets one attacker spray many addresses.
    """
    email = email.lower()

    await enforce_rate_limit(f"rate:register:{email}", settings.email_codes_per_hour, 3600)
    await enforce_rate_limit(
        f"rate:register:ip:{client_ip}", settings.email_codes_per_hour_per_ip, 3600
    )

    if await redis_client.exists(_resend_key(email)):
        raise RateLimitError(
            f"Debes esperar {settings.email_code_resend_seconds}s antes de reenviar el código."
        )

    code = _generate_code()
    await redis_client.set(_code_key(email), code, ex=settings.email_code_ttl_seconds)
    await redis_client.delete(_attempts_key(email))
    await redis_client.set(_resend_key(email), "1", ex=settings.email_code_resend_seconds)

    try:
        await get_email_sender().send(
            to=email,
            subject="Tu código de verificación EPN",
            body=(
                f"Tu código es {code}. "
                f"Expira en {settings.email_code_ttl_seconds // 60} minutos.\n"
                "Si no solicitaste esto, ignora este correo."
            ),
        )
    except Exception:
        # A delivery failure must not leave an unusable code or resend lock behind.
        await redis_client.delete(_code_key(email), _attempts_key(email), _resend_key(email))
        raise


async def verify_code_and_register(
    db: AsyncSession, email: str, code: str, password: str
) -> TokenOut:
    """Validate the code and activate the account, creating the user on first verification."""
    email = email.lower()
    await _consume_verification_code(email, code)

    user = await crud.get_user_by_email(db, email)
    if user is None:
        user = await crud.create_user(db, email=email, password_hash=hash_password(password))
    else:
        # Re-verification doubles as a password reset once the code is proven. Changing the
        # password must end every other session, otherwise a stolen refresh token survives the
        # reset for its full lifetime (ERS §25.3).
        user.password_hash = hash_password(password)
        await token_store.revoke_all(str(user.id))
    if user.status != UserStatus.ACTIVE:
        raise ForbiddenError("Esta cuenta no está activa. Contacta al administrador.")
    user.email_verified_at = datetime.now(UTC)
    await db.flush()

    return await _issue_tokens(user)


async def login(db: AsyncSession, email: str, password: str, client_ip: str) -> TokenOut:
    """Authenticate, throttling by both address and origin (ERS §25.2).

    Two counters on purpose: the per-address one stops credential stuffing against one account,
    the per-origin one stops a single attacker from locking out many accounts in turn.
    """
    email = email.lower()
    await enforce_rate_limit(
        f"rate:login:{email}", settings.login_max_attempts, settings.login_window_seconds
    )
    await enforce_rate_limit(
        f"rate:login:ip:{client_ip}",
        settings.login_max_attempts_per_ip,
        settings.login_window_seconds,
    )
    user = await crud.get_user_by_email(db, email)
    # Verify against a hash even when the user is missing to keep timing uniform.
    stored_hash = user.password_hash if user and user.password_hash else _DUMMY_HASH
    password_ok = verify_password(password, stored_hash)
    if user is None or user.password_hash is None or not password_ok:
        raise AuthError("Credenciales inválidas.")
    if user.status != UserStatus.ACTIVE:
        # Same message as bad credentials: whether an account is suspended is not public.
        raise AuthError("Credenciales inválidas.")
    if not user.is_verified:
        raise AuthError("Debes verificar tu correo antes de iniciar sesión.")
    return await _issue_tokens(user)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenOut:
    """Rotate a refresh token: consume the presented ``jti`` and issue a fresh pair.

    The account is re-checked on every rotation: a suspended or deleted user must stop getting
    new tokens immediately, not merely be blocked at the next protected request.
    """
    payload = decode_token(refresh_token, expected_type="refresh")
    subject = payload["sub"]
    jti = payload["jti"]

    if not await token_store.is_active(subject, jti):
        # The token is unknown: already rotated or revoked. Treat as reuse and revoke everything.
        await token_store.revoke_all(subject)
        raise AuthError("La sesión expiró o fue revocada. Inicia sesión nuevamente.")

    user = await _active_user(db, subject)
    await token_store.revoke(subject, jti)
    return await _issue_tokens(user)


async def _active_user(db: AsyncSession, subject: str) -> User:
    try:
        user_id = uuid.UUID(subject)
    except ValueError as exc:
        raise AuthError("Token inválido.") from exc
    user = await crud.get_user(db, user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        await token_store.revoke_all(subject)
        raise AuthError("La sesión ya no es válida. Inicia sesión nuevamente.")
    return user


async def logout(refresh_token: str | None) -> None:
    """Revoke the presented refresh token so it cannot be rotated again."""
    if not refresh_token:
        return
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except AuthError:
        return
    await token_store.revoke(payload["sub"], payload["jti"])


async def _consume_verification_code(email: str, code: str) -> None:
    stored = await redis_client.get(_code_key(email))
    if stored is None:
        raise AuthError("El código expiró o no existe. Solicita uno nuevo.")

    attempts = await redis_client.incr(_attempts_key(email))
    if attempts == 1:
        await redis_client.expire(_attempts_key(email), settings.email_code_ttl_seconds)
    if attempts > settings.email_code_max_attempts:
        await redis_client.delete(_code_key(email))
        raise RateLimitError("Superaste el número de intentos. Solicita un código nuevo.")

    if not secrets.compare_digest(stored, code):
        raise AuthError("Código incorrecto.")

    await redis_client.delete(_code_key(email))
    await redis_client.delete(_attempts_key(email))


async def _issue_tokens(user: User) -> TokenOut:
    return await _issue_tokens_for_subject(str(user.id), user.role.value)


async def _issue_tokens_for_subject(subject: str, role: str | None) -> TokenOut:
    jti = new_jti()
    await token_store.remember(subject, jti)
    extra = {"role": role} if role else {}
    return TokenOut(
        access_token=create_access_token(subject, **extra),
        refresh_token=create_refresh_token(subject, jti, **extra),
    )


# Pre-computed Argon2 hash of a random string, used to equalise login timing for unknown users.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))

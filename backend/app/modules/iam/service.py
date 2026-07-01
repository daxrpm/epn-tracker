"""Lógica de autenticación y registro con correo EPN (ERS §RF-001, §RF-002, §25)."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exception.errors import AuthError, RateLimitError
from app.common.security.jwt import create_access_token, create_refresh_token, decode_token
from app.common.security.password import hash_password, verify_password
from app.core.conf import settings
from app.core.email import get_email_sender
from app.core.rate_limit import enforce_rate_limit
from app.database.redis import redis_client
from app.modules.iam import crud
from app.modules.iam.model import User
from app.modules.iam.schema import TokenOut


def _generate_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def _code_key(email: str) -> str:
    return f"verify:code:{email.lower()}"


def _attempts_key(email: str) -> str:
    return f"verify:attempts:{email.lower()}"


def _resend_key(email: str) -> str:
    return f"verify:resend:{email.lower()}"


async def request_verification_code(db: AsyncSession, email: str) -> None:
    """Genera y envía un código. No revela si el correo existe (respuesta neutral, ERS §RF-001)."""
    email = email.lower()

    await enforce_rate_limit(
        f"rate:register:{email}", settings.email_codes_per_hour, 3600
    )

    if await redis_client.exists(_resend_key(email)):
        raise RateLimitError(
            f"Debes esperar {settings.email_code_resend_seconds}s antes de reenviar el código."
        )

    code = _generate_code()
    await redis_client.set(_code_key(email), code, ex=settings.email_code_ttl_seconds)
    await redis_client.delete(_attempts_key(email))
    await redis_client.set(_resend_key(email), "1", ex=settings.email_code_resend_seconds)

    await get_email_sender().send(
        to=email,
        subject="Tu código de verificación EPN",
        body=(
            f"Tu código es {code}. Expira en {settings.email_code_ttl_seconds // 60} minutos.\n"
            "Si no solicitaste esto, ignora este correo."
        ),
    )


async def verify_code_and_register(
    db: AsyncSession, email: str, code: str, password: str
) -> TokenOut:
    """Valida el código y activa la cuenta. Crea el usuario si no existe (ERS §RF-001)."""
    email = email.lower()
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

    user = await crud.get_user_by_email(db, email)
    if user is None:
        user = await crud.create_user(db, email=email, password_hash=hash_password(password))
    else:
        # Reverificación / restablecimiento de contraseña tras verificar de nuevo.
        user.password_hash = hash_password(password)
    user.email_verified_at = datetime.now(UTC)
    await db.flush()

    return _issue_tokens(user)


async def login(db: AsyncSession, email: str, password: str) -> TokenOut:
    email = email.lower()
    user = await crud.get_user_by_email(db, email)
    if user is None or user.password_hash is None:
        raise AuthError("Credenciales inválidas.")
    if not verify_password(password, user.password_hash):
        raise AuthError("Credenciales inválidas.")
    if not user.is_verified:
        raise AuthError("Debes verificar tu correo antes de iniciar sesión.")
    return _issue_tokens(user)


async def refresh_tokens(refresh_token: str) -> TokenOut:
    payload = decode_token(refresh_token, expected_type="refresh")
    subject = payload.get("sub")
    if not subject:
        raise AuthError("Token de refresco inválido.")
    return TokenOut(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )


def _issue_tokens(user: User) -> TokenOut:
    subject = str(user.id)
    return TokenOut(
        access_token=create_access_token(subject, role=user.role.value),
        refresh_token=create_refresh_token(subject),
    )

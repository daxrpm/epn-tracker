"""Application/domain exceptions mapped to error codes and HTTP status (ERS §26)."""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base application error. Handlers translate it into the standard error envelope."""

    code: str = "APP_ERROR"
    status_code: int = 400
    message: str = "Ocurrió un error."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        self.details = details or []
        super().__init__(self.message)


class ValidationAppError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "Los datos enviados no son válidos."


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = 404
    message = "Recurso no encontrado."


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = 409
    message = "El recurso ya existe o hay un conflicto de estado."


class AuthError(AppError):
    code = "UNAUTHORIZED"
    status_code = 401
    message = "No autorizado."


class ForbiddenError(AppError):
    code = "FORBIDDEN"
    status_code = 403
    message = "No tienes permiso para esta acción."


class RateLimitError(AppError):
    code = "RATE_LIMITED"
    status_code = 429
    message = "Demasiados intentos. Espera un momento."

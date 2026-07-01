"""Envío de correo. En dev usa un backend de consola; la interfaz permite un SMTP real luego."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.conf import settings
from app.core.logging import get_logger

logger = get_logger("app.email")


class EmailSender(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender(EmailSender):
    """Imprime el correo en el log. Útil para desarrollo local (ERS §RF-001)."""

    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL -> %s | %s\n%s", to, subject, body)


def get_email_sender() -> EmailSender:
    # Extensible: agregar SMTP/API cuando se configure (ERS §RF-018).
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    return ConsoleEmailSender()

"""Email sending. Dev uses a console backend; the interface allows a real SMTP later."""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.conf import settings
from app.core.logging import get_logger

logger = get_logger("app.email")


class EmailSender(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender(EmailSender):
    """Prints the email to the log. Useful for local development (ERS §RF-001)."""

    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info("EMAIL -> %s | %s\n%s", to, subject, body)


def get_email_sender() -> EmailSender:
    # Extensible: add SMTP/API when configured (ERS §RF-018).
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    return ConsoleEmailSender()

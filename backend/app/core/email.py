"""Email delivery backends.

Development can log messages to the console. Deployed environments use SMTP with TLS and execute
the blocking standard-library client in a worker thread so the API event loop stays responsive.
"""

from __future__ import annotations

import asyncio
import smtplib
import ssl
from abc import ABC, abstractmethod
from email.message import EmailMessage

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


class SMTPEmailSender(EmailSender):
    async def send(self, to: str, subject: str, body: str) -> None:
        await asyncio.to_thread(self._send, to, subject, body)

    @staticmethod
    def _send(to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = settings.smtp_from_email
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        context = ssl.create_default_context()
        smtp_class = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
        kwargs = {"timeout": settings.smtp_timeout_seconds}
        if settings.smtp_use_ssl:
            kwargs["context"] = context

        with smtp_class(settings.smtp_host, settings.smtp_port, **kwargs) as client:
            if not settings.smtp_use_ssl:
                client.ehlo()
                if settings.smtp_starttls:
                    client.starttls(context=context)
                    client.ehlo()
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(message)


def get_email_sender() -> EmailSender:
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    return SMTPEmailSender()

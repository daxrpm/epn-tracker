"""Configuración de logging estructurado básico (ERS §RNF-008)."""

from __future__ import annotations

import logging
import sys

from app.core.conf import settings

_CONFIGURED = False


def setup_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return

    level = logging.DEBUG if settings.debug else logging.INFO
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s [%(name)s] [req:%(request_id)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
            defaults={"request_id": "-"},
        )
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    logging.getLogger("uvicorn.access").handlers.clear()
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

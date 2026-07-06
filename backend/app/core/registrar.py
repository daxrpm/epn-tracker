"""App factory: builds and configures the FastAPI instance."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.common.exception.handlers import register_exception_handlers
from app.core.conf import settings
from app.core.logging import setup_logging
from app.middleware.request_context import RequestContextMiddleware
from app.modules.resources import storage
from app.router import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    # Ensure the resources bucket exists. Non-fatal: the API still boots if MinIO is unavailable
    # (uploads will error later, but reads/other modules keep working).
    try:
        await storage.ensure_bucket()
    except Exception:  # noqa: BLE001
        logger.warning("Could not initialize object storage bucket at startup", exc_info=True)
    yield


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app

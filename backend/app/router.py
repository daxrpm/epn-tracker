"""Router raíz de la API v1. Agrega los routers de cada módulo.

Los routers de cada módulo se registran aquí a medida que se implementan.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.iam.api import router as iam_router

api_router = APIRouter()


@api_router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


api_router.include_router(iam_router)

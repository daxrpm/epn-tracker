"""Router raíz de la API v1. Agrega los routers de cada módulo.

Los routers de cada módulo se registran aquí a medida que se implementan.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.academic.api import admin_router as academic_admin_router
from app.modules.academic.api import router as academic_router
from app.modules.iam.api import router as iam_router
from app.modules.public.api import router as public_router

api_router = APIRouter()


@api_router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


api_router.include_router(iam_router)
api_router.include_router(public_router)
api_router.include_router(academic_router)
api_router.include_router(academic_admin_router)

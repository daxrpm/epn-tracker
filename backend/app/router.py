"""Router raíz de la API v1. Agrega los routers de cada módulo.

Los routers de cada módulo se registran aquí a medida que se implementan.
"""

from __future__ import annotations

from fastapi import APIRouter

api_router = APIRouter()


@api_router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}

"""Root API v1 router. Aggregates the routers of each module.

Module routers are registered here as they are implemented.
"""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.common.deps import DbSession
from app.database.redis import redis_client
from app.modules.academic.api import admin_router as academic_admin_router
from app.modules.academic.api import router as academic_router
from app.modules.evaluation.api import router as evaluation_router
from app.modules.iam.api import router as iam_router
from app.modules.public.api import router as public_router
from app.modules.simulation.api import public_router as simulation_public_router
from app.modules.simulation.api import router as simulation_router
from app.modules.student.api import router as student_router

api_router = APIRouter()


@api_router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness probe: the process is up."""
    return {"status": "ok"}


@api_router.get("/health/ready", tags=["health"])
async def readiness(db: DbSession) -> dict[str, str]:
    """Readiness probe: database and Redis are reachable."""
    await db.execute(text("SELECT 1"))
    await redis_client.ping()
    return {"status": "ready", "database": "ok", "redis": "ok"}


api_router.include_router(iam_router)
api_router.include_router(public_router)
api_router.include_router(academic_router)
api_router.include_router(academic_admin_router)
api_router.include_router(evaluation_router)
api_router.include_router(student_router)
api_router.include_router(simulation_router)
api_router.include_router(simulation_public_router)

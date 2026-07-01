"""Simulator endpoints (ERS §17.10, §17.11).

``/simulations/run`` requires authentication; ``/public/simulations/basic`` is anonymous and reads
only public catalog data (ERS §RF-012).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.common.deps import CurrentUser, DbSession
from app.modules.simulation import service
from app.modules.simulation.schema import SimulationRunIn, SimulationRunOut

router = APIRouter(tags=["simulation"])


@router.post("/simulations/run", response_model=SimulationRunOut)
async def run_simulation(
    payload: SimulationRunIn, user: CurrentUser, db: DbSession
) -> SimulationRunOut:
    return await service.run_simulation(db, payload)


public_router = APIRouter(prefix="/public", tags=["public"])


@public_router.post("/simulations/basic", response_model=SimulationRunOut)
async def run_basic_simulation(payload: SimulationRunIn, db: DbSession) -> SimulationRunOut:
    return await service.run_simulation(db, payload)

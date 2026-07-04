"""Simulator endpoints (ERS §17.10, §17.11).

``/simulations/run`` requires authentication; ``/public/simulations/basic`` is anonymous and reads
only public catalog data (ERS §RF-012).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.common.deps import CurrentUser, DbSession
from app.modules.simulation import service
from app.modules.simulation.schema import (
    SavedSimulationCreateIn,
    SavedSimulationListItem,
    SavedSimulationOut,
    SimulationRunIn,
    SimulationRunOut,
    StudentSimulationRunIn,
    StudentSimulationRunOut,
)
from app.modules.student import service as student_service

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


# --- Authenticated student simulator: seeds the scenario from saved state, persists scenarios -----

student_router = APIRouter(prefix="/student", tags=["simulation"])


@student_router.post("/simulations/run", response_model=StudentSimulationRunOut)
async def run_student_simulation(
    payload: StudentSimulationRunIn, user: CurrentUser, db: DbSession
) -> StudentSimulationRunOut:
    profile = await student_service.get_or_create_profile(db, user)
    return await service.run_student_simulation(db, profile, payload)


@student_router.post("/simulations", response_model=SavedSimulationOut)
async def save_simulation(
    payload: SavedSimulationCreateIn, user: CurrentUser, db: DbSession
) -> SavedSimulationOut:
    profile = await student_service.get_or_create_profile(db, user)
    return await service.save_simulation(db, profile, payload)


@student_router.get("/simulations", response_model=list[SavedSimulationListItem])
async def list_simulations(
    user: CurrentUser, db: DbSession
) -> list[SavedSimulationListItem]:
    profile = await student_service.get_or_create_profile(db, user)
    return await service.list_saved_simulations(db, profile)


@student_router.get("/simulations/{simulation_id}", response_model=SavedSimulationOut)
async def get_simulation(
    simulation_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> SavedSimulationOut:
    profile = await student_service.get_or_create_profile(db, user)
    return await service.get_saved_simulation(db, profile, simulation_id)


@student_router.delete("/simulations/{simulation_id}")
async def delete_simulation(
    simulation_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> dict[str, bool]:
    profile = await student_service.get_or_create_profile(db, user)
    await service.delete_saved_simulation(db, profile, simulation_id)
    return {"deleted": True}

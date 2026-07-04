"""Data access for saved simulations (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import SimulationMode
from app.modules.simulation.model import Simulation


async def create_simulation(
    db: AsyncSession,
    *,
    student_profile_id: uuid.UUID,
    curriculum_id: uuid.UUID,
    name: str,
    input_snapshot: dict,
    result_snapshot: dict,
) -> Simulation:
    simulation = Simulation(
        student_profile_id=student_profile_id,
        curriculum_id=curriculum_id,
        name=name,
        mode=SimulationMode.SAVED,
        input_snapshot=input_snapshot,
        result_snapshot=result_snapshot,
    )
    db.add(simulation)
    await db.flush()
    # Load the server-generated created_at so the response can include it before commit.
    await db.refresh(simulation)
    return simulation


async def list_simulations(
    db: AsyncSession, student_profile_id: uuid.UUID
) -> Sequence[Simulation]:
    stmt = (
        select(Simulation)
        .where(Simulation.student_profile_id == student_profile_id)
        .order_by(Simulation.created_at.desc())
    )
    return (await db.execute(stmt)).scalars().all()


async def get_simulation(db: AsyncSession, simulation_id: uuid.UUID) -> Simulation | None:
    return await db.get(Simulation, simulation_id)


async def delete_simulation(db: AsyncSession, simulation: Simulation) -> None:
    await db.delete(simulation)
    await db.flush()

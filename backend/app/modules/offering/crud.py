"""Data access for the offering module (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.offering.model import (
    CourseOffering,
    Professor,
    Section,
    SectionProfessor,
)


async def search_professors(
    db: AsyncSession, query: str, limit: int = 20
) -> Sequence[Professor]:
    like = f"%{query.lower()}%"
    stmt = (
        select(Professor)
        .where(Professor.full_name.ilike(like))
        .order_by(Professor.full_name)
        .limit(limit)
    )
    return (await db.execute(stmt)).scalars().all()


async def get_professor(db: AsyncSession, professor_id: uuid.UUID) -> Professor | None:
    return await db.get(Professor, professor_id)


async def get_course_offering(
    db: AsyncSession, offering_id: uuid.UUID
) -> CourseOffering | None:
    return await db.get(CourseOffering, offering_id)


async def list_course_offerings(
    db: AsyncSession,
    period_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
) -> Sequence[CourseOffering]:
    stmt = select(CourseOffering)
    if period_id is not None:
        stmt = stmt.where(CourseOffering.academic_period_id == period_id)
    if course_id is not None:
        stmt = stmt.where(CourseOffering.course_id == course_id)
    return (await db.execute(stmt)).scalars().all()


async def get_section(db: AsyncSession, section_id: uuid.UUID) -> Section | None:
    return await db.get(Section, section_id)


async def get_section_professor(
    db: AsyncSession, section_id: uuid.UUID, professor_id: uuid.UUID
) -> SectionProfessor | None:
    stmt = select(SectionProfessor).where(
        SectionProfessor.section_id == section_id,
        SectionProfessor.professor_id == professor_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()

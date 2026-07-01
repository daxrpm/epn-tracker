"""Data access for the academic catalog (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.model import (
    Career,
    Course,
    CourseRequirement,
    Curriculum,
    CurriculumCourse,
    Faculty,
    Institution,
)


async def list_institutions(db: AsyncSession) -> Sequence[Institution]:
    return (await db.execute(select(Institution))).scalars().all()


async def list_faculties(db: AsyncSession) -> Sequence[Faculty]:
    return (await db.execute(select(Faculty))).scalars().all()


async def list_careers(db: AsyncSession) -> Sequence[Career]:
    return (await db.execute(select(Career))).scalars().all()


async def get_career(db: AsyncSession, career_id: uuid.UUID) -> Career | None:
    return await db.get(Career, career_id)


async def list_curricula(db: AsyncSession) -> Sequence[Curriculum]:
    return (await db.execute(select(Curriculum))).scalars().all()


async def get_curriculum(db: AsyncSession, curriculum_id: uuid.UUID) -> Curriculum | None:
    return await db.get(Curriculum, curriculum_id)


async def list_curriculum_courses(
    db: AsyncSession, curriculum_id: uuid.UUID
) -> Sequence[CurriculumCourse]:
    stmt = (
        select(CurriculumCourse)
        .where(CurriculumCourse.curriculum_id == curriculum_id)
        .order_by(CurriculumCourse.reference_term, CurriculumCourse.display_order)
    )
    return (await db.execute(stmt)).scalars().all()


async def get_course(db: AsyncSession, course_id: uuid.UUID) -> Course | None:
    return await db.get(Course, course_id)


async def get_courses_by_ids(
    db: AsyncSession, course_ids: list[uuid.UUID]
) -> Sequence[Course]:
    if not course_ids:
        return []
    return (await db.execute(select(Course).where(Course.id.in_(course_ids)))).scalars().all()


async def search_courses(db: AsyncSession, query: str, limit: int = 20) -> Sequence[Course]:
    like = f"%{query.lower()}%"
    stmt = (
        select(Course)
        .where((Course.normalized_name.like(like)) | (Course.code.ilike(like)))
        .limit(limit)
    )
    return (await db.execute(stmt)).scalars().all()


async def requirements_for_curriculum(
    db: AsyncSession, curriculum_course_ids: list[uuid.UUID]
) -> Sequence[CourseRequirement]:
    if not curriculum_course_ids:
        return []
    stmt = select(CourseRequirement).where(
        CourseRequirement.curriculum_course_id.in_(curriculum_course_ids)
    )
    return (await db.execute(stmt)).scalars().all()

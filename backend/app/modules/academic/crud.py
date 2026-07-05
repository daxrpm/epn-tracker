"""Data access for the academic catalog (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.academic.model import (
    AcademicPeriod,
    Career,
    Course,
    CourseRequirement,
    Curriculum,
    CurriculumCourse,
    CurriculumGraduationRequirement,
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


async def get_curriculum_course(
    db: AsyncSession, curriculum_course_id: uuid.UUID
) -> CurriculumCourse | None:
    return await db.get(CurriculumCourse, curriculum_course_id)


async def get_course_requirement(
    db: AsyncSession, requirement_id: uuid.UUID
) -> CourseRequirement | None:
    return await db.get(CourseRequirement, requirement_id)


async def find_requirement(
    db: AsyncSession,
    *,
    curriculum_course_id: uuid.UUID,
    required_curriculum_course_id: uuid.UUID,
    requirement_type,
) -> CourseRequirement | None:
    stmt = select(CourseRequirement).where(
        CourseRequirement.curriculum_course_id == curriculum_course_id,
        CourseRequirement.required_curriculum_course_id == required_curriculum_course_id,
        CourseRequirement.requirement_type == requirement_type,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def requirements_for_curriculum(
    db: AsyncSession, curriculum_course_ids: list[uuid.UUID]
) -> Sequence[CourseRequirement]:
    if not curriculum_course_ids:
        return []
    stmt = select(CourseRequirement).where(
        CourseRequirement.curriculum_course_id.in_(curriculum_course_ids)
    )
    return (await db.execute(stmt)).scalars().all()


async def list_academic_periods(db: AsyncSession) -> Sequence[AcademicPeriod]:
    stmt = select(AcademicPeriod).order_by(AcademicPeriod.code)
    return (await db.execute(stmt)).scalars().all()


async def get_academic_period(
    db: AsyncSession, period_id: uuid.UUID
) -> AcademicPeriod | None:
    return await db.get(AcademicPeriod, period_id)


async def get_academic_period_by_code(
    db: AsyncSession, institution_id: uuid.UUID, code: str
) -> AcademicPeriod | None:
    stmt = select(AcademicPeriod).where(
        AcademicPeriod.institution_id == institution_id, AcademicPeriod.code == code
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_curriculum_graduation_requirements(
    db: AsyncSession, curriculum_id: uuid.UUID
) -> Sequence[CurriculumGraduationRequirement]:
    stmt = select(CurriculumGraduationRequirement).where(
        CurriculumGraduationRequirement.curriculum_id == curriculum_id
    )
    return (await db.execute(stmt)).scalars().all()

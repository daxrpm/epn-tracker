"""Data access for the student module (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.student.model import (
    GradeComponentState,
    GradeItem,
    StudentCourseState,
    StudentEnrollment,
    StudentGraduationRequirementState,
    StudentProfile,
)


async def get_profile_by_user(db: AsyncSession, user_id: uuid.UUID) -> StudentProfile | None:
    stmt = select(StudentProfile).where(StudentProfile.user_id == user_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_course_states(
    db: AsyncSession, profile_id: uuid.UUID
) -> Sequence[StudentCourseState]:
    stmt = select(StudentCourseState).where(StudentCourseState.student_profile_id == profile_id)
    return (await db.execute(stmt)).scalars().all()


async def get_course_state_by_course(
    db: AsyncSession, profile_id: uuid.UUID, curriculum_course_id: uuid.UUID
) -> StudentCourseState | None:
    stmt = select(StudentCourseState).where(
        StudentCourseState.student_profile_id == profile_id,
        StudentCourseState.curriculum_course_id == curriculum_course_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_enrollment(db: AsyncSession, enrollment_id: uuid.UUID) -> StudentEnrollment | None:
    return await db.get(StudentEnrollment, enrollment_id)


async def list_enrollments(
    db: AsyncSession, profile_id: uuid.UUID
) -> Sequence[StudentEnrollment]:
    stmt = select(StudentEnrollment).where(StudentEnrollment.student_profile_id == profile_id)
    return (await db.execute(stmt)).scalars().all()


async def get_component_states(
    db: AsyncSession, enrollment_id: uuid.UUID
) -> Sequence[GradeComponentState]:
    stmt = select(GradeComponentState).where(
        GradeComponentState.student_enrollment_id == enrollment_id
    )
    return (await db.execute(stmt)).scalars().all()


async def get_component_state(
    db: AsyncSession, component_state_id: uuid.UUID
) -> GradeComponentState | None:
    return await db.get(GradeComponentState, component_state_id)


async def get_items(
    db: AsyncSession, component_state_id: uuid.UUID
) -> Sequence[GradeItem]:
    stmt = (
        select(GradeItem)
        .where(GradeItem.grade_component_state_id == component_state_id)
        .order_by(GradeItem.display_order)
    )
    return (await db.execute(stmt)).scalars().all()


async def get_items_for_states(
    db: AsyncSession, component_state_ids: list[uuid.UUID]
) -> Sequence[GradeItem]:
    """Load every item for a set of component states in a single query (avoids N+1)."""
    if not component_state_ids:
        return []
    stmt = (
        select(GradeItem)
        .where(GradeItem.grade_component_state_id.in_(component_state_ids))
        .order_by(GradeItem.display_order)
    )
    return (await db.execute(stmt)).scalars().all()


async def get_item(db: AsyncSession, item_id: uuid.UUID) -> GradeItem | None:
    return await db.get(GradeItem, item_id)


async def get_grad_req_states(
    db: AsyncSession, profile_id: uuid.UUID
) -> Sequence[StudentGraduationRequirementState]:
    stmt = select(StudentGraduationRequirementState).where(
        StudentGraduationRequirementState.student_profile_id == profile_id
    )
    return (await db.execute(stmt)).scalars().all()


async def get_grad_req_state(
    db: AsyncSession, state_id: uuid.UUID
) -> StudentGraduationRequirementState | None:
    return await db.get(StudentGraduationRequirementState, state_id)

"""Data access for study resources (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import (
    PUBLICLY_VISIBLE_RESOURCE_STATUSES,
    Contribution,
    ResourceKind,
    ResourceStatus,
    SchemeVote,
)
from app.common.pagination import DEFAULT_PAGE_SIZE
from app.common.sql import escape_like
from app.modules.academic.model import AcademicPeriod
from app.modules.resources.model import Resource, ResourceVote


async def get_resource(db: AsyncSession, resource_id: uuid.UUID) -> Resource | None:
    return await db.get(Resource, resource_id)


async def list_resources(
    db: AsyncSession,
    *,
    course_id: uuid.UUID | None = None,
    academic_period_id: uuid.UUID | None = None,
    professor_id: uuid.UUID | None = None,
    contribution: Contribution | None = None,
    kind: ResourceKind | None = None,
    tema: str | None = None,
    status_in: Sequence[ResourceStatus] | None = None,
    visible_to_user_id: uuid.UUID | None = None,
    include_hidden: bool = False,
    owned_only: bool = False,
    search: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> Sequence[Resource]:
    stmt = select(Resource).where(Resource.is_active.is_(True))
    if course_id is not None:
        stmt = stmt.where(Resource.course_id == course_id)
    if academic_period_id is not None:
        stmt = stmt.where(Resource.academic_period_id == academic_period_id)
    if professor_id is not None:
        stmt = stmt.where(Resource.professor_id == professor_id)
    if contribution is not None:
        stmt = stmt.where(Resource.contribution == contribution)
    if kind is not None:
        stmt = stmt.where(Resource.kind == kind)
    if tema:
        stmt = stmt.where(Resource.tema.ilike(f"%{escape_like(tema)}%", escape="\\"))
    if search:
        pattern = f"%{escape_like(search)}%"
        stmt = stmt.where(
            or_(
                Resource.title.ilike(pattern, escape="\\"),
                Resource.tema.ilike(pattern, escape="\\"),
                Resource.description.ilike(pattern, escape="\\"),
            )
        )
    if status_in is not None:
        stmt = stmt.where(Resource.status.in_(list(status_in)))
    if owned_only:
        stmt = stmt.where(Resource.created_by_user_id == visible_to_user_id)
    elif not include_hidden:
        # Visibility filtered in SQL: a caller sees public statuses plus their own drafts.
        stmt = stmt.where(
            or_(
                Resource.status.in_(list(PUBLICLY_VISIBLE_RESOURCE_STATUSES)),
                Resource.created_by_user_id == visible_to_user_id,
            )
        )
    stmt = stmt.order_by(Resource.created_at.desc()).limit(limit).offset(offset)
    return (await db.execute(stmt)).scalars().all()


async def count_votes(db: AsyncSession, resource_id: uuid.UUID, vote: SchemeVote) -> int:
    """Count votes of one kind; the vote rows are the source of truth for ``approval_count``."""
    stmt = select(func.count(ResourceVote.id)).where(
        ResourceVote.resource_id == resource_id, ResourceVote.vote == vote
    )
    return (await db.execute(stmt)).scalar_one()


async def get_user_vote(
    db: AsyncSession, resource_id: uuid.UUID, user_id: uuid.UUID
) -> ResourceVote | None:
    stmt = select(ResourceVote).where(
        ResourceVote.resource_id == resource_id,
        ResourceVote.user_id == user_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_current_period(db: AsyncSession) -> AcademicPeriod | None:
    """The academic period flagged as current, used to auto-stamp uploads."""
    stmt = select(AcademicPeriod).where(AcademicPeriod.is_current.is_(True)).limit(1)
    return (await db.execute(stmt)).scalars().first()

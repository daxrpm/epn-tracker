"""Data access for evaluation schemes (no business logic)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import SchemeVote, Visibility
from app.common.pagination import DEFAULT_PAGE_SIZE
from app.modules.evaluation.model import (
    EvaluationComponent,
    EvaluationScheme,
    EvaluationSchemeVote,
)


async def get_scheme(db: AsyncSession, scheme_id: uuid.UUID) -> EvaluationScheme | None:
    return await db.get(EvaluationScheme, scheme_id)


async def get_components(
    db: AsyncSession, scheme_id: uuid.UUID
) -> Sequence[EvaluationComponent]:
    stmt = (
        select(EvaluationComponent)
        .where(EvaluationComponent.evaluation_scheme_id == scheme_id)
        .order_by(EvaluationComponent.contribution, EvaluationComponent.display_order)
    )
    return (await db.execute(stmt)).scalars().all()


async def list_schemes(
    db: AsyncSession,
    *,
    course_id: uuid.UUID | None = None,
    professor_id: uuid.UUID | None = None,
    section_id: uuid.UUID | None = None,
    viewer_id: uuid.UUID | None = None,
    include_private: bool = False,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> Sequence[EvaluationScheme]:
    """List active schemes.

    Visibility is enforced in SQL, never in memory: unless ``include_private`` is set (admins),
    a caller only sees non-private schemes plus their own (ERS §8.9).
    """
    stmt = select(EvaluationScheme).where(EvaluationScheme.is_active.is_(True))
    if course_id is not None:
        stmt = stmt.where(EvaluationScheme.course_id == course_id)
    if professor_id is not None:
        stmt = stmt.where(EvaluationScheme.professor_id == professor_id)
    if section_id is not None:
        stmt = stmt.where(EvaluationScheme.section_id == section_id)
    if not include_private:
        stmt = stmt.where(
            or_(
                EvaluationScheme.visibility != Visibility.PRIVATE,
                EvaluationScheme.created_by_user_id == viewer_id,
            )
        )
    stmt = stmt.order_by(EvaluationScheme.created_at.desc()).limit(limit).offset(offset)
    return (await db.execute(stmt)).scalars().all()


async def count_votes(db: AsyncSession, scheme_id: uuid.UUID, vote: SchemeVote) -> int:
    """Count votes of one kind. The vote rows are the source of truth for ``approval_count``."""
    stmt = select(func.count(EvaluationSchemeVote.id)).where(
        EvaluationSchemeVote.evaluation_scheme_id == scheme_id,
        EvaluationSchemeVote.vote == vote,
    )
    return (await db.execute(stmt)).scalar_one()


async def get_user_vote(
    db: AsyncSession, scheme_id: uuid.UUID, user_id: uuid.UUID
) -> EvaluationSchemeVote | None:
    stmt = select(EvaluationSchemeVote).where(
        EvaluationSchemeVote.evaluation_scheme_id == scheme_id,
        EvaluationSchemeVote.user_id == user_id,
    )
    return (await db.execute(stmt)).scalar_one_or_none()

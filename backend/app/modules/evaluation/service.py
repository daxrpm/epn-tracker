"""Evaluation scheme creation and community voting (ERS §8.10-8.12, §RF-019, §RF-020).

Weighting rules are enforced by the pure domain validator; this service only handles persistence and
the community verification state machine. User-facing messages stay in Spanish.
"""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import (
    EvaluationSchemeStatus,
    SchemeSourceType,
    SchemeVote,
    Visibility,
)
from app.common.exception.errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationAppError,
)
from app.domain.grading.scheme_validation import SchemeComponent, validate_scheme
from app.modules.evaluation import crud
from app.modules.evaluation.model import (
    EvaluationComponent,
    EvaluationScheme,
    EvaluationSchemeVote,
)
from app.modules.evaluation.schema import (
    SchemeCreateIn,
    SchemeCreateOut,
    SchemeIssueOut,
    VoteOut,
)
from app.modules.iam.model import User

COMMUNITY_VERIFICATION_THRESHOLD = 3


def build_context_hash(
    course_id: uuid.UUID,
    academic_period_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
    professor_id: uuid.UUID | None,
) -> str:
    raw = f"{course_id}|{academic_period_id}|{section_id}|{professor_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def create_scheme(
    db: AsyncSession, user: User, payload: SchemeCreateIn
) -> SchemeCreateOut:
    """Create a student scheme. Public schemes start as COMMUNITY_PENDING (ERS §RF-019)."""
    validation = validate_scheme(
        [
            SchemeComponent(
                contribution=c.contribution,
                name=c.name,
                weight_percent=c.weight_percent,
                evaluation_type=c.evaluation_type,
            )
            for c in payload.components
        ],
        strict=False,
    )
    if not validation.is_valid:
        raise ValidationAppError(
            "El esquema de evaluación no es válido.",
            details=[{"field": e.field, "message": e.message} for e in validation.errors],
        )

    is_private = payload.visibility == Visibility.PRIVATE
    scheme = EvaluationScheme(
        course_id=payload.course_id,
        academic_period_id=payload.academic_period_id,
        section_id=payload.section_id,
        professor_id=payload.professor_id,
        created_by_user_id=user.id,
        title=payload.title,
        status=EvaluationSchemeStatus.PERSONAL
        if is_private
        else EvaluationSchemeStatus.COMMUNITY_PENDING,
        visibility=payload.visibility,
        source_type=SchemeSourceType.MANUAL_STUDENT,
        context_hash=build_context_hash(
            payload.course_id, payload.academic_period_id, payload.section_id, payload.professor_id
        ),
    )
    db.add(scheme)
    await db.flush()

    for component in payload.components:
        db.add(
            EvaluationComponent(
                evaluation_scheme_id=scheme.id,
                contribution=component.contribution,
                name=component.name,
                evaluation_type=component.evaluation_type,
                weight_percent=component.weight_percent,
                score_scale=component.score_scale,
                display_order=component.display_order,
            )
        )
    await db.flush()

    return SchemeCreateOut(
        id=scheme.id,
        status=scheme.status,
        is_valid=validation.is_valid,
        warnings=[SchemeIssueOut(field=w.field, message=w.message) for w in validation.warnings],
    )


async def vote_scheme(
    db: AsyncSession, user: User, scheme_id: uuid.UUID, vote: SchemeVote
) -> VoteOut:
    """Register a community vote; auto-verify at three external approvals (ERS §8.11)."""
    scheme = await crud.get_scheme(db, scheme_id)
    if scheme is None or not scheme.is_active:
        raise NotFoundError("Esquema no encontrado.")
    if not user.is_verified:
        raise ForbiddenError("Debes verificar tu correo para votar.")
    if scheme.created_by_user_id == user.id:
        # The creator does not count as an external approval (ERS §8.11).
        raise ForbiddenError("No puedes votar tu propio esquema.")
    if await crud.get_user_vote(db, scheme_id, user.id) is not None:
        raise ConflictError("Ya votaste este esquema.")

    db.add(
        EvaluationSchemeVote(
            evaluation_scheme_id=scheme_id,
            user_id=user.id,
            vote=vote,
            context_hash=scheme.context_hash,
        )
    )

    if vote == SchemeVote.APPROVE:
        scheme.approval_count += 1
        if (
            scheme.approval_count >= COMMUNITY_VERIFICATION_THRESHOLD
            and scheme.status == EvaluationSchemeStatus.COMMUNITY_PENDING
        ):
            scheme.status = EvaluationSchemeStatus.COMMUNITY_VERIFIED

    await db.flush()
    return VoteOut(
        scheme_id=scheme.id, status=scheme.status, approval_count=scheme.approval_count
    )

"""Evaluation scheme creation and community voting (ERS §8.10-8.12, §RF-019, §RF-020).

Weighting rules are enforced by the pure domain validator; this service only handles persistence and
the community verification state machine. User-facing messages stay in Spanish.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import (
    Contribution,
    EvaluationSchemeStatus,
    SchemeSourceType,
    SchemeVote,
    UserRole,
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
    SchemeCopyOut,
    SchemeCreateIn,
    SchemeCreateOut,
    SchemeIssueOut,
    SchemeSuggestionOut,
    VoteOut,
)
from app.modules.iam.model import User
from app.modules.offering import crud as offering_crud

COMMUNITY_VERIFICATION_THRESHOLD = 3


def build_context_hash(
    course_id: uuid.UUID,
    academic_period_id: uuid.UUID | None,
    section_id: uuid.UUID | None,
    professor_id: uuid.UUID | None,
) -> str:
    raw = f"{course_id}|{academic_period_id}|{section_id}|{professor_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def create_scheme(db: AsyncSession, user: User, payload: SchemeCreateIn) -> SchemeCreateOut:
    """Create a student scheme. Public schemes start as COMMUNITY_PENDING (ERS §RF-019)."""
    # A two-decimal split such as 33.33 + 33.33 + 33.33 is academically 100%, although its
    # literal sum is 99.99. Complete the missing cent on a component with available capacity so
    # subsequent grade calculations operate on an exact 100%.
    for contribution in (Contribution.APORTE_1, Contribution.APORTE_2):
        contribution_components = [
            component for component in payload.components if component.contribution == contribution
        ]
        total = sum(
            (component.weight_percent for component in contribution_components),
            start=Decimal("0"),
        )
        if Decimal("99.99") <= total < Decimal("100"):
            adjustment = Decimal("100") - total
            target = next(
                (
                    component
                    for component in reversed(contribution_components)
                    if component.weight_percent + adjustment <= Decimal("35")
                ),
                None,
            )
            if target is not None:
                target.weight_percent += adjustment

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
            "El curso no es válido.",
            details=[{"field": e.field, "message": e.message} for e in validation.errors],
        )

    # Admins publish verified schemes directly; students need community approval (ERS §RF-019).
    is_admin = user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)
    is_private = payload.visibility == Visibility.PRIVATE
    if is_admin and not is_private:
        status = EvaluationSchemeStatus.ADMIN_VERIFIED
        source_type = SchemeSourceType.MANUAL_ADMIN
    elif is_private:
        status = EvaluationSchemeStatus.PERSONAL
        source_type = SchemeSourceType.MANUAL_STUDENT
    else:
        status = EvaluationSchemeStatus.COMMUNITY_PENDING
        source_type = SchemeSourceType.MANUAL_STUDENT

    scheme = EvaluationScheme(
        course_id=payload.course_id,
        academic_period_id=payload.academic_period_id,
        section_id=payload.section_id,
        professor_id=payload.professor_id,
        created_by_user_id=user.id,
        title=payload.title,
        status=status,
        visibility=payload.visibility,
        source_type=source_type,
        context_hash=build_context_hash(
            payload.course_id, payload.academic_period_id, payload.section_id, payload.professor_id
        ),
    )
    db.add(scheme)
    await db.flush()

    display_orders = {Contribution.APORTE_1: 0, Contribution.APORTE_2: 0}
    for component in payload.components:
        db.add(
            EvaluationComponent(
                evaluation_scheme_id=scheme.id,
                contribution=component.contribution,
                name=component.name,
                evaluation_type=component.evaluation_type,
                weight_percent=component.weight_percent,
                score_scale=component.score_scale,
                display_order=display_orders[component.contribution],
            )
        )
        display_orders[component.contribution] += 1
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
        raise NotFoundError("Curso no encontrado.")
    if not user.is_verified:
        raise ForbiddenError("Debes verificar tu correo para votar.")
    if scheme.created_by_user_id == user.id:
        # The creator does not count as an external approval (ERS §8.11).
        raise ForbiddenError("No puedes votar tu propio curso.")
    if await crud.get_user_vote(db, scheme_id, user.id) is not None:
        raise ConflictError("Ya votaste este curso.")

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
    return VoteOut(scheme_id=scheme.id, status=scheme.status, approval_count=scheme.approval_count)


async def copy_scheme_to_personal(
    db: AsyncSession, user: User, scheme_id: uuid.UUID
) -> SchemeCopyOut:
    """Duplicate a scheme (and its components) as a private personal copy (ERS §17.7)."""
    source = await crud.get_scheme(db, scheme_id)
    if source is None or not source.is_active:
        raise NotFoundError("Curso no encontrado.")

    copy = EvaluationScheme(
        course_id=source.course_id,
        academic_period_id=source.academic_period_id,
        section_id=source.section_id,
        professor_id=source.professor_id,
        created_by_user_id=user.id,
        title=source.title,
        status=EvaluationSchemeStatus.PERSONAL,
        visibility=Visibility.PRIVATE,
        source_type=SchemeSourceType.MANUAL_STUDENT,
        approval_count=0,
        context_hash=source.context_hash,
    )
    db.add(copy)
    await db.flush()

    components = await crud.get_components(db, source.id)
    for component in components:
        db.add(
            EvaluationComponent(
                evaluation_scheme_id=copy.id,
                contribution=component.contribution,
                name=component.name,
                evaluation_type=component.evaluation_type,
                weight_percent=component.weight_percent,
                score_scale=component.score_scale,
                display_order=component.display_order,
            )
        )
    await db.flush()

    return SchemeCopyOut(id=copy.id, status=copy.status)


# --- Priority suggestion (ERS §8.12) --------------------------------------------------------------


@dataclass(slots=True)
class SuggestContext:
    """Query context used to rank schemes for a course."""

    academic_period_id: uuid.UUID | None = None
    section_id: uuid.UUID | None = None
    professor_id: uuid.UUID | None = None


_VERIFIED_STATUSES = (
    EvaluationSchemeStatus.ADMIN_VERIFIED,
    EvaluationSchemeStatus.COMMUNITY_VERIFIED,
)
_SUGGESTABLE_STATUSES = (
    EvaluationSchemeStatus.ADMIN_VERIFIED,
    EvaluationSchemeStatus.COMMUNITY_VERIFIED,
    EvaluationSchemeStatus.COMMUNITY_PENDING,
)


def _match_kind(scheme: EvaluationScheme, ctx: SuggestContext) -> str:
    """Classify how closely a scheme matches the requested context."""
    is_exact = (
        scheme.academic_period_id == ctx.academic_period_id
        and scheme.section_id == ctx.section_id
        and scheme.professor_id == ctx.professor_id
    )
    if is_exact:
        return "EXACT"
    if ctx.professor_id is not None and scheme.professor_id == ctx.professor_id:
        return "PROFESSOR"
    return "COURSE"


def _priority_rank(status: EvaluationSchemeStatus, match: str) -> int:
    """Lower value = higher priority (ERS §8.12)."""
    if status == EvaluationSchemeStatus.ADMIN_VERIFIED and match == "EXACT":
        return 1
    if status == EvaluationSchemeStatus.COMMUNITY_VERIFIED and match == "EXACT":
        return 2
    if status == EvaluationSchemeStatus.ADMIN_VERIFIED and match == "PROFESSOR":
        return 3
    if status == EvaluationSchemeStatus.COMMUNITY_VERIFIED and match == "PROFESSOR":
        return 4
    if status == EvaluationSchemeStatus.COMMUNITY_PENDING and match == "EXACT":
        return 5
    return 6


def _suggestion_warning(status: EvaluationSchemeStatus, match: str) -> str | None:
    if status == EvaluationSchemeStatus.COMMUNITY_PENDING:
        return "Curso pendiente de verificación comunitaria."
    if match == "COURSE":
        return "Este curso corresponde a otro profesor o contexto."
    if match == "PROFESSOR":
        return "Este curso corresponde a otro periodo o sección."
    return None


def rank_schemes(
    schemes: Sequence[EvaluationScheme],
    ctx: SuggestContext,
    professor_names: dict[uuid.UUID, str] | None = None,
) -> list[SchemeSuggestionOut]:
    """Pure helper: order active schemes by suggestion priority (ERS §8.12)."""
    names = professor_names or {}
    candidates = [s for s in schemes if s.status in _SUGGESTABLE_STATUSES]

    def _sort_key(scheme: EvaluationScheme) -> tuple[int, int, str]:
        match = _match_kind(scheme, ctx)
        return (_priority_rank(scheme.status, match), -scheme.approval_count, scheme.title)

    candidates.sort(key=_sort_key)
    result: list[SchemeSuggestionOut] = []
    for scheme in candidates:
        match = _match_kind(scheme, ctx)
        result.append(
            SchemeSuggestionOut(
                id=scheme.id,
                title=scheme.title,
                professor_name=names.get(scheme.professor_id) if scheme.professor_id else None,
                status=scheme.status,
                approval_count=scheme.approval_count,
                match=match,
                warning=_suggestion_warning(scheme.status, match),
            )
        )
    return result


async def suggest_schemes(
    db: AsyncSession,
    *,
    course_id: uuid.UUID,
    academic_period_id: uuid.UUID | None = None,
    section_id: uuid.UUID | None = None,
    professor_id: uuid.UUID | None = None,
) -> list[SchemeSuggestionOut]:
    """Return active schemes for a course ordered by suggestion priority (ERS §8.12)."""
    schemes = await crud.list_schemes(db, course_id=course_id)
    professor_ids = {s.professor_id for s in schemes if s.professor_id is not None}
    professors = await offering_crud.get_professors_by_ids(db, list(professor_ids))
    professor_names = {p.id: p.full_name for p in professors}
    ctx = SuggestContext(
        academic_period_id=academic_period_id,
        section_id=section_id,
        professor_id=professor_id,
    )
    return rank_schemes(schemes, ctx, professor_names)

"""Student services: profile, course states, gradebook and grade calculation (ERS §17.5, §17.6).

Grade math is delegated to the pure domain layer; this service only reads/writes persistence and
adapts between ORM rows and domain inputs. User-facing messages stay in Spanish.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.decimal_utils import display_str
from app.common.enums import CourseStateSource, GradeComponentMode
from app.common.exception.errors import ForbiddenError, NotFoundError
from app.domain.grading.grade_calculation import (
    ComponentInput,
    ItemInput,
    calculate_component_score,
    calculate_contribution,
    calculate_final,
)
from app.domain.grading.recovery import required_recovery_score
from app.modules.evaluation.model import EvaluationComponent, EvaluationScheme
from app.modules.iam.model import User
from app.modules.student import crud
from app.modules.student.model import (
    GradeComponentState,
    GradeItem,
    StudentCourseState,
    StudentEnrollment,
    StudentProfile,
)
from app.modules.student.schema import (
    CalculateOut,
    ComponentStateOut,
    ContributionOut,
    CourseStateBulkIn,
    EnrollmentCreateIn,
    GradebookOut,
    GradeItemOut,
    ProfileUpdateIn,
)


async def get_or_create_profile(db: AsyncSession, user: User) -> StudentProfile:
    profile = await crud.get_profile_by_user(db, user.id)
    if profile is None:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
        await db.flush()
    return profile


async def update_profile(
    db: AsyncSession, user: User, payload: ProfileUpdateIn
) -> StudentProfile:
    profile = await get_or_create_profile(db, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.flush()
    return profile


async def bulk_upsert_course_states(
    db: AsyncSession, profile: StudentProfile, payload: CourseStateBulkIn
) -> list[StudentCourseState]:
    result: list[StudentCourseState] = []
    for item in payload.items:
        state = await crud.get_course_state_by_course(db, profile.id, item.curriculum_course_id)
        if state is None:
            state = StudentCourseState(
                student_profile_id=profile.id,
                curriculum_course_id=item.curriculum_course_id,
                source=CourseStateSource.MANUAL,
            )
            db.add(state)
        state.state = item.state
        state.final_score_40 = item.final_score_40
        result.append(state)
    await db.flush()
    return result


async def create_enrollment(
    db: AsyncSession, profile: StudentProfile, payload: EnrollmentCreateIn
) -> StudentEnrollment:
    """Create an enrollment and seed its gradebook from the chosen scheme's components."""
    scheme = await db.get(EvaluationScheme, payload.evaluation_scheme_id)
    if scheme is None:
        raise NotFoundError("Esquema de evaluación no encontrado.")

    enrollment = StudentEnrollment(
        student_profile_id=profile.id,
        curriculum_course_id=payload.curriculum_course_id,
        academic_period_id=payload.academic_period_id,
        section_id=payload.section_id,
        professor_id=payload.professor_id,
        evaluation_scheme_id=scheme.id,
    )
    db.add(enrollment)
    await db.flush()

    components = (
        await db.execute(
            select(EvaluationComponent).where(
                EvaluationComponent.evaluation_scheme_id == scheme.id
            )
        )
    ).scalars().all()
    for component in components:
        db.add(
            GradeComponentState(
                student_enrollment_id=enrollment.id,
                evaluation_component_id=component.id,
                mode=GradeComponentMode.EQUAL_AVERAGE,
                score_scale=component.score_scale,
            )
        )
    await db.flush()
    return enrollment


async def _owned_enrollment(
    db: AsyncSession, profile: StudentProfile, enrollment_id: uuid.UUID
) -> StudentEnrollment:
    enrollment = await crud.get_enrollment(db, enrollment_id)
    if enrollment is None:
        raise NotFoundError("Matrícula no encontrada.")
    if enrollment.student_profile_id != profile.id:
        raise ForbiddenError("Esta matrícula no te pertenece.")
    return enrollment


async def _owned_component_state(
    db: AsyncSession, profile: StudentProfile, component_state_id: uuid.UUID
) -> GradeComponentState:
    state = await crud.get_component_state(db, component_state_id)
    if state is None:
        raise NotFoundError("Componente no encontrado.")
    await _owned_enrollment(db, profile, state.student_enrollment_id)
    return state


async def _recompute_component(db: AsyncSession, state: GradeComponentState) -> None:
    items = await crud.get_items(db, state.id)
    item_inputs = [
        ItemInput(score=i.score, internal_weight_percent=i.internal_weight_percent) for i in items
    ]
    state.calculated_score = calculate_component_score(state.mode, state.direct_score, item_inputs)


async def get_gradebook(
    db: AsyncSession, profile: StudentProfile, enrollment_id: uuid.UUID
) -> GradebookOut:
    enrollment = await _owned_enrollment(db, profile, enrollment_id)
    states = await crud.get_component_states(db, enrollment.id)
    components = await _load_components(db, states)
    items_by_state = await _load_items_by_state(db, states)

    out = [
        ComponentStateOut(
            id=state.id,
            evaluation_component_id=state.evaluation_component_id,
            name=components[state.evaluation_component_id].name,
            contribution=components[state.evaluation_component_id].contribution,
            weight_percent=components[state.evaluation_component_id].weight_percent,
            mode=state.mode,
            direct_score=state.direct_score,
            calculated_score=state.calculated_score,
            items=[GradeItemOut.model_validate(i) for i in items_by_state.get(state.id, [])],
        )
        for state in states
    ]
    return GradebookOut(enrollment_id=enrollment.id, components=out)


async def _load_components(
    db: AsyncSession, states: list[GradeComponentState]
) -> dict[uuid.UUID, EvaluationComponent]:
    component_ids = [s.evaluation_component_id for s in states]
    if not component_ids:
        return {}
    rows = (
        await db.execute(
            select(EvaluationComponent).where(EvaluationComponent.id.in_(component_ids))
        )
    ).scalars().all()
    return {c.id: c for c in rows}


async def _load_items_by_state(
    db: AsyncSession, states: list[GradeComponentState]
) -> dict[uuid.UUID, list[GradeItem]]:
    items = await crud.get_items_for_states(db, [s.id for s in states])
    grouped: dict[uuid.UUID, list[GradeItem]] = {}
    for item in items:
        grouped.setdefault(item.grade_component_state_id, []).append(item)
    return grouped


async def patch_component(
    db: AsyncSession,
    profile: StudentProfile,
    component_state_id: uuid.UUID,
    *,
    mode: GradeComponentMode | None,
    direct_score,  # noqa: ANN001 - Decimal | None
) -> GradeComponentState:
    state = await _owned_component_state(db, profile, component_state_id)
    if mode is not None:
        state.mode = mode
    if direct_score is not None or mode == GradeComponentMode.DIRECT_SCORE:
        state.direct_score = direct_score
    await _recompute_component(db, state)
    await db.flush()
    return state


async def add_item(
    db: AsyncSession,
    profile: StudentProfile,
    component_state_id: uuid.UUID,
    *,
    name: str,
    score,  # noqa: ANN001
    internal_weight_percent,  # noqa: ANN001
) -> GradeItem:
    state = await _owned_component_state(db, profile, component_state_id)
    item = GradeItem(
        grade_component_state_id=state.id,
        name=name,
        score=score,
        internal_weight_percent=internal_weight_percent,
    )
    db.add(item)
    await db.flush()
    await _recompute_component(db, state)
    await db.flush()
    return item


async def patch_item(
    db: AsyncSession, profile: StudentProfile, item_id: uuid.UUID, payload
) -> GradeItem:  # noqa: ANN001
    item = await crud.get_item(db, item_id)
    if item is None:
        raise NotFoundError("Insumo no encontrado.")
    state = await _owned_component_state(db, profile, item.grade_component_state_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    await _recompute_component(db, state)
    await db.flush()
    return item


async def delete_item(db: AsyncSession, profile: StudentProfile, item_id: uuid.UUID) -> None:
    item = await crud.get_item(db, item_id)
    if item is None:
        raise NotFoundError("Insumo no encontrado.")
    state = await _owned_component_state(db, profile, item.grade_component_state_id)
    await db.delete(item)
    await db.flush()
    await _recompute_component(db, state)
    await db.flush()


async def calculate(
    db: AsyncSession, profile: StudentProfile, enrollment_id: uuid.UUID
) -> CalculateOut:
    """Compute contributions, final grade and recovery for an enrollment (ERS §16)."""
    enrollment = await _owned_enrollment(db, profile, enrollment_id)
    states = await crud.get_component_states(db, enrollment.id)
    components = await _load_components(db, states)
    items_by_state = await _load_items_by_state(db, states)

    grouped: dict[str, list[ComponentInput]] = {"APORTE_1": [], "APORTE_2": []}
    for state in states:
        component = components[state.evaluation_component_id]
        item_inputs = [
            ItemInput(score=i.score, internal_weight_percent=i.internal_weight_percent)
            for i in items_by_state.get(state.id, [])
        ]
        state.calculated_score = calculate_component_score(
            state.mode, state.direct_score, item_inputs
        )
        grouped[component.contribution.value].append(
            ComponentInput(
                weight_percent=component.weight_percent,
                mode=GradeComponentMode.DIRECT_SCORE,
                direct_score=state.calculated_score,
            )
        )
    await db.flush()

    a1 = calculate_contribution(grouped["APORTE_1"])
    a2 = calculate_contribution(grouped["APORTE_2"])
    is_complete = a1.is_complete and a2.is_complete
    final = calculate_final(a1.score_20, a2.score_20, is_complete=is_complete)
    required = required_recovery_score(final.final_40) if is_complete else None

    return CalculateOut(
        aporte_1=_contribution_out("APORTE_1", a1),
        aporte_2=_contribution_out("APORTE_2", a2),
        final_40=str(final.final_40),
        final_20=str(final.final_20),
        display_final_20=display_str(final.final_20) or "0.00",
        status=final.status,
        is_complete=is_complete,
        required_recovery_score_40=None if required is None else str(required),
    )


def _contribution_out(contribution: str, result) -> ContributionOut:  # noqa: ANN001
    return ContributionOut(
        contribution=contribution,
        score_20=str(result.score_20),
        evaluated_weight_percent=str(result.evaluated_weight_percent),
        is_complete=result.is_complete,
    )

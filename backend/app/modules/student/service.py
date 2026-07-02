"""Student services: profile, course states, gradebook and grade calculation (ERS §17.5, §17.6).

Grade math is delegated to the pure domain layer; this service only reads/writes persistence and
adapts between ORM rows and domain inputs. User-facing messages stay in Spanish.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.decimal_utils import ZERO, display_round, display_str
from app.common.enums import CourseState, CourseStateSource, GradeComponentMode
from app.common.exception.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.domain.grading.grade_calculation import (
    ComponentInput,
    ItemInput,
    calculate_component_score,
    calculate_contribution,
    calculate_final,
)
from app.domain.grading.projection import (
    DEFAULT_TARGET_FINAL_40,
    ProjectionComponent,
    project_target,
)
from app.domain.grading.recovery import required_recovery_score
from app.modules.academic import crud as academic_crud
from app.modules.evaluation.model import EvaluationComponent, EvaluationScheme
from app.modules.iam.model import User
from app.modules.student import crud
from app.modules.student.model import (
    GradeComponentState,
    GradeItem,
    StudentCourseState,
    StudentEnrollment,
    StudentGraduationRequirementState,
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
    ProgressOut,
    ProgressTermOut,
    ProjectionOut,
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
    if profile.current_curriculum_id is not None:
        await provision_graduation_requirements(db, profile)
    return profile


async def provision_graduation_requirements(
    db: AsyncSession, profile: StudentProfile
) -> None:
    """Seed missing graduation-requirement states for the student's curriculum (idempotent)."""
    if profile.current_curriculum_id is None:
        return
    curriculum_reqs = await academic_crud.list_curriculum_graduation_requirements(
        db, profile.current_curriculum_id
    )
    existing = await crud.get_grad_req_states(db, profile.id)
    existing_ids = {s.graduation_requirement_id for s in existing}
    created = False
    for req in curriculum_reqs:
        if req.graduation_requirement_id in existing_ids:
            continue
        db.add(
            StudentGraduationRequirementState(
                student_profile_id=profile.id,
                graduation_requirement_id=req.graduation_requirement_id,
            )
        )
        existing_ids.add(req.graduation_requirement_id)
        created = True
    if created:
        await db.flush()


async def get_progress(db: AsyncSession, profile: StudentProfile) -> ProgressOut:
    """Compute malla progress from the student's curriculum and course states (ERS §RF-020)."""
    if profile.current_curriculum_id is None:
        raise ValidationAppError("No tienes una malla asignada.")

    curriculum_courses = await academic_crud.list_curriculum_courses(
        db, profile.current_curriculum_id
    )
    states = await crud.get_course_states(db, profile.id)
    state_by_cc = {s.curriculum_course_id: s.state for s in states}

    counts: dict[CourseState, int] = dict.fromkeys(CourseState, 0)
    total_credits = ZERO
    approved_credits = ZERO
    term_totals: dict[int, Decimal] = {}
    term_approved: dict[int, Decimal] = {}

    for cc in curriculum_courses:
        state = state_by_cc.get(cc.id, CourseState.NOT_TAKEN)
        counts[state] += 1
        credits = cc.credits or ZERO
        total_credits += credits
        term_totals[cc.reference_term] = term_totals.get(cc.reference_term, ZERO) + credits
        if state == CourseState.PASSED:
            approved_credits += credits
            term_approved[cc.reference_term] = (
                term_approved.get(cc.reference_term, ZERO) + credits
            )

    percent = ZERO if total_credits == ZERO else approved_credits / total_credits * Decimal("100")

    by_term = [
        ProgressTermOut(
            term=term,
            approved_credits=str(term_approved.get(term, ZERO)),
            total_credits=str(term_totals[term]),
        )
        for term in sorted(term_totals)
    ]

    return ProgressOut(
        total_credits=str(total_credits),
        approved_credits=str(approved_credits),
        percent=display_str(percent) or "0.00",
        counts_by_state={state.value: counts[state] for state in CourseState},
        by_term=by_term,
    )


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
        ItemInput(
            score=i.score, internal_weight_percent=i.internal_weight_percent, score_scale=i.score_scale
        )
        for i in items
    ]
    state.calculated_score = calculate_component_score(
        state.mode, state.direct_score, item_inputs, state.score_scale
    )


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
            direct_score_scale=state.score_scale,
            calculated_score=display_round(state.calculated_score),
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
    direct_score_scale: Decimal | None = None,
) -> GradeComponentState:
    state = await _owned_component_state(db, profile, component_state_id)
    if mode is not None:
        state.mode = mode
    if direct_score is not None or mode == GradeComponentMode.DIRECT_SCORE:
        state.direct_score = direct_score
    if direct_score_scale is not None:
        state.score_scale = direct_score_scale
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
    score_scale: Decimal,
    internal_weight_percent,  # noqa: ANN001
) -> GradeItem:
    state = await _owned_component_state(db, profile, component_state_id)
    item = GradeItem(
        grade_component_state_id=state.id,
        name=name,
        score=score,
        score_scale=score_scale,
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
            ItemInput(
                score=i.score,
                internal_weight_percent=i.internal_weight_percent,
                score_scale=i.score_scale,
            )
            for i in items_by_state.get(state.id, [])
        ]
        state.calculated_score = calculate_component_score(
            state.mode, state.direct_score, item_inputs, state.score_scale
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
        final_40=display_str(final.final_40) or "0.00",
        final_20=str(final.final_20),
        display_final_20=display_str(final.final_20) or "0.00",
        status=final.status,
        is_complete=is_complete,
        required_recovery_score_40=display_str(required) if required is not None else None,
    )


def _contribution_out(contribution: str, result) -> ContributionOut:  # noqa: ANN001
    return ContributionOut(
        contribution=contribution,
        score_20=display_str(result.score_20) or "0.00",
        evaluated_weight_percent=display_str(result.evaluated_weight_percent) or "0",
        is_complete=result.is_complete,
    )


async def project(
    db: AsyncSession,
    profile: StudentProfile,
    enrollment_id: uuid.UUID,
    target_final_40: Decimal | None = None,
) -> ProjectionOut:
    """Project what the student still needs to reach ``target_final_40`` (ERS §RF-009)."""
    target = DEFAULT_TARGET_FINAL_40 if target_final_40 is None else target_final_40
    enrollment = await _owned_enrollment(db, profile, enrollment_id)
    states = await crud.get_component_states(db, enrollment.id)
    components = await _load_components(db, states)
    items_by_state = await _load_items_by_state(db, states)

    projection_components: list[ProjectionComponent] = []
    for state in states:
        component = components[state.evaluation_component_id]
        item_inputs = [
            ItemInput(
                score=i.score,
                internal_weight_percent=i.internal_weight_percent,
                score_scale=i.score_scale,
            )
            for i in items_by_state.get(state.id, [])
        ]
        state.calculated_score = calculate_component_score(
            state.mode, state.direct_score, item_inputs, state.score_scale
        )
        projection_components.append(
            ProjectionComponent(
                contribution=component.contribution,
                weight_percent=component.weight_percent,
                calculated_score=state.calculated_score,
            )
        )
    await db.flush()

    result = project_target(projection_components, target_final_40=target)
    return ProjectionOut(
        target_final_40=display_str(result.target_final_40) or "0.00",
        current_points_40=display_str(result.current_points_40) or "0.00",
        evaluated_weight_percent=display_str(result.evaluated_weight_percent) or "0",
        remaining_weight_percent=display_str(result.remaining_weight_percent) or "0",
        required_avg_score_20=display_str(result.required_avg_score_20),
        already_reached=result.already_reached,
        is_reachable=result.is_reachable,
    )

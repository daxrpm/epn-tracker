"""Simulator service: builds domain course nodes from a curriculum and runs the engine (ERS §16.5).

The eligibility and credit-limit rules live entirely in the pure domain layer; this service only
loads curriculum data and adapts it to and from domain types.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import CourseState, RequirementType
from app.common.exception.errors import NotFoundError, ValidationAppError
from app.domain.simulation.eligibility import (
    BlockedCourse,
    CourseNode,
    ScenarioState,
    SimulationResult,
    simulate_next_courses,
)
from app.domain.simulation.english_rules import EnglishState
from app.modules.academic import crud
from app.modules.academic.model import CurriculumCourse
from app.modules.simulation import crud as sim_crud
from app.modules.simulation.model import Simulation
from app.modules.simulation.schema import (
    BlockedCourseOut,
    CourseNodeOut,
    EnglishStateIn,
    ReasonOut,
    SavedSimulationCreateIn,
    SavedSimulationListItem,
    SavedSimulationOut,
    SimulationRunIn,
    SimulationRunOut,
    StudentBlockedCourseOut,
    StudentCourseNodeOut,
    StudentSimulationRunIn,
    StudentSimulationRunOut,
)
from app.modules.student import crud as student_crud
from app.modules.student.model import StudentProfile


@dataclass(slots=True)
class CurriculumData:
    """Domain nodes plus the id/code lookups the student simulator needs to enrich output."""

    nodes: list[CourseNode]
    cc_id_to_code: dict[uuid.UUID, str]
    code_to_cc: dict[str, CurriculumCourse]


async def load_curriculum_data(db: AsyncSession, curriculum_id: uuid.UUID) -> CurriculumData:
    """Load a curriculum as domain course nodes (keyed by code) and the maps to project back."""
    curriculum_courses = list(await crud.list_curriculum_courses(db, curriculum_id))
    if not curriculum_courses:
        return CurriculumData(nodes=[], cc_id_to_code={}, code_to_cc={})

    courses = {
        c.id: c
        for c in await crud.get_courses_by_ids(db, [cc.course_id for cc in curriculum_courses])
    }
    cc_id_to_code = {cc.id: courses[cc.course_id].code for cc in curriculum_courses}

    requirements = await crud.requirements_for_curriculum(
        db, [cc.id for cc in curriculum_courses]
    )
    prerequisites: dict[uuid.UUID, list[str]] = {}
    corequisites: dict[uuid.UUID, list[str]] = {}
    for req in requirements:
        bucket = (
            prerequisites if req.requirement_type == RequirementType.PREREQUISITE else corequisites
        )
        code = cc_id_to_code.get(req.required_curriculum_course_id)
        if code is not None:
            bucket.setdefault(req.curriculum_course_id, []).append(code)

    nodes = [
        CourseNode(
            key=courses[cc.course_id].code,
            credits=cc.credits,
            prerequisites=prerequisites.get(cc.id, []),
            corequisites=corequisites.get(cc.id, []),
            name=courses[cc.course_id].name,
        )
        for cc in curriculum_courses
    ]
    code_to_cc = {cc_id_to_code[cc.id]: cc for cc in curriculum_courses}
    return CurriculumData(nodes=nodes, cc_id_to_code=cc_id_to_code, code_to_cc=code_to_cc)


async def build_course_nodes(db: AsyncSession, curriculum_id: uuid.UUID) -> list[CourseNode]:
    """Build domain course nodes (keyed by course code) from a curriculum."""
    return (await load_curriculum_data(db, curriculum_id)).nodes


async def run_simulation(db: AsyncSession, payload: SimulationRunIn) -> SimulationRunOut:
    nodes = await build_course_nodes(db, payload.curriculum_id)
    if not nodes:
        raise NotFoundError("La malla no existe o no tiene materias.")

    scenario = ScenarioState(
        passed=set(payload.passed_course_codes),
        failed=set(payload.failed_course_codes),
        annulled=set(payload.annulled_course_codes),
    )
    english = EnglishState(
        level=payload.english.level,
        sufficiency=payload.english.sufficiency,
        last_required_level_enrolled=payload.english.last_required_level_enrolled,
        has_exception_authorization=payload.english.has_exception_authorization,
    )

    result = simulate_next_courses(
        nodes,
        scenario,
        set(payload.selected_course_codes),
        english=english,
        has_special_credit_authorization=payload.has_special_credit_authorization,
    )

    return SimulationRunOut(
        max_credits=str(result.max_credits),
        selected_credits=str(result.selected_credits),
        selected_valid=result.selected_valid,
        eligible_courses=[
            CourseNodeOut(code=c.key, name=c.name, credits=str(c.credit_value))
            for c in result.eligible_courses
        ],
        blocked_courses=[
            BlockedCourseOut(
                code=b.course.key,
                name=b.course.name,
                reasons=[ReasonOut(code=r.code, message=r.message) for r in b.reasons],
            )
            for b in result.blocked_courses
        ],
        restriction_reasons=[
            ReasonOut(code=r.code, message=r.message) for r in result.restriction_reasons
        ],
    )


# --- Authenticated student simulator --------------------------------------------------------------


def _english_from_profile(profile: StudentProfile) -> EnglishState:
    return EnglishState(
        level=profile.english_level,
        sufficiency=profile.english_sufficiency,
        last_required_level_enrolled=profile.english_last_required_level_enrolled,
        has_exception_authorization=profile.has_english_exception_authorization,
    )


def _english_from_override(override: EnglishStateIn) -> EnglishState:
    return EnglishState(
        level=override.level,
        sufficiency=override.sufficiency,
        last_required_level_enrolled=override.last_required_level_enrolled,
        has_exception_authorization=override.has_exception_authorization,
    )


def _student_node_out(course: CourseNode, code_to_cc: dict[str, CurriculumCourse]) -> dict:
    cc = code_to_cc.get(course.key)
    return {
        "code": course.key,
        "name": course.name,
        "credits": str(course.credit_value),
        "curriculum_course_id": cc.id if cc else None,
        "reference_term": cc.reference_term if cc else None,
    }


def _to_student_out(
    result: SimulationResult, code_to_cc: dict[str, CurriculumCourse]
) -> StudentSimulationRunOut:
    return StudentSimulationRunOut(
        max_credits=str(result.max_credits),
        selected_credits=str(result.selected_credits),
        selected_valid=result.selected_valid,
        eligible_courses=[
            StudentCourseNodeOut(**_student_node_out(c, code_to_cc))
            for c in result.eligible_courses
        ],
        blocked_courses=[_blocked_out(b, code_to_cc) for b in result.blocked_courses],
        restriction_reasons=[
            ReasonOut(code=r.code, message=r.message) for r in result.restriction_reasons
        ],
    )


def _blocked_out(
    blocked: BlockedCourse, code_to_cc: dict[str, CurriculumCourse]
) -> StudentBlockedCourseOut:
    return StudentBlockedCourseOut(
        **_student_node_out(blocked.course, code_to_cc),
        reasons=[ReasonOut(code=r.code, message=r.message) for r in blocked.reasons],
    )


async def run_student_simulation(
    db: AsyncSession, profile: StudentProfile, payload: StudentSimulationRunIn
) -> StudentSimulationRunOut:
    """Run the simulator seeding the scenario from the student's saved course states and profile.

    The stored per-course state (passed/failed/annulled) is the base scenario; ``assumptions``
    override it (typically the outcome the student projects for in-progress courses).
    """
    if profile.current_curriculum_id is None:
        raise ValidationAppError("El perfil no tiene una malla seleccionada.")

    data = await load_curriculum_data(db, profile.current_curriculum_id)
    if not data.nodes:
        raise NotFoundError("La malla no existe o no tiene materias.")

    states = await student_crud.get_course_states(db, profile.id)
    effective: dict[uuid.UUID, CourseState] = {s.curriculum_course_id: s.state for s in states}
    for assumption in payload.assumptions:
        effective[assumption.curriculum_course_id] = assumption.state

    passed: set[str] = set()
    failed: set[str] = set()
    annulled: set[str] = set()
    for cc_id, state in effective.items():
        code = data.cc_id_to_code.get(cc_id)
        if code is None:
            continue
        if state == CourseState.PASSED:
            passed.add(code)
        elif state == CourseState.FAILED:
            failed.add(code)
        elif state == CourseState.ANNULLED:
            annulled.add(code)

    scenario = ScenarioState(passed=passed, failed=failed, annulled=annulled)
    selected = {
        data.cc_id_to_code[cc_id]
        for cc_id in payload.selected_course_ids
        if cc_id in data.cc_id_to_code
    }
    english = (
        _english_from_profile(profile)
        if payload.english_override is None
        else _english_from_override(payload.english_override)
    )

    result = simulate_next_courses(
        data.nodes,
        scenario,
        selected,
        english=english,
        has_special_credit_authorization=payload.has_special_credit_authorization,
    )
    return _to_student_out(result, data.code_to_cc)


# --- Saved scenarios ------------------------------------------------------------------------------


def _saved_out(simulation: Simulation) -> SavedSimulationOut:
    return SavedSimulationOut(
        id=simulation.id,
        name=simulation.name,
        curriculum_id=simulation.curriculum_id,
        created_at=simulation.created_at,
        input_snapshot=simulation.input_snapshot,
        result=StudentSimulationRunOut.model_validate(simulation.result_snapshot),
    )


async def save_simulation(
    db: AsyncSession, profile: StudentProfile, payload: SavedSimulationCreateIn
) -> SavedSimulationOut:
    result = await run_student_simulation(db, profile, payload)
    input_snapshot = payload.model_dump(mode="json", exclude={"name"})
    simulation = await sim_crud.create_simulation(
        db,
        student_profile_id=profile.id,
        # run_student_simulation already guaranteed the profile has a curriculum.
        curriculum_id=profile.current_curriculum_id,  # type: ignore[arg-type]
        name=payload.name,
        input_snapshot=input_snapshot,
        result_snapshot=result.model_dump(mode="json"),
    )
    return _saved_out(simulation)


async def list_saved_simulations(
    db: AsyncSession, profile: StudentProfile
) -> list[SavedSimulationListItem]:
    simulations = await sim_crud.list_simulations(db, profile.id)
    return [
        SavedSimulationListItem(
            id=s.id,
            name=s.name,
            curriculum_id=s.curriculum_id,
            created_at=s.created_at,
            max_credits=str(s.result_snapshot.get("max_credits", "0")),
            selected_credits=str(s.result_snapshot.get("selected_credits", "0")),
            selected_valid=bool(s.result_snapshot.get("selected_valid", False)),
        )
        for s in simulations
    ]


async def _owned_simulation(
    db: AsyncSession, profile: StudentProfile, simulation_id: uuid.UUID
) -> Simulation:
    simulation = await sim_crud.get_simulation(db, simulation_id)
    if simulation is None or simulation.student_profile_id != profile.id:
        raise NotFoundError("Simulación no encontrada.")
    return simulation


async def get_saved_simulation(
    db: AsyncSession, profile: StudentProfile, simulation_id: uuid.UUID
) -> SavedSimulationOut:
    return _saved_out(await _owned_simulation(db, profile, simulation_id))


async def delete_saved_simulation(
    db: AsyncSession, profile: StudentProfile, simulation_id: uuid.UUID
) -> None:
    await sim_crud.delete_simulation(db, await _owned_simulation(db, profile, simulation_id))

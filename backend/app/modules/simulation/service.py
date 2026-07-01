"""Simulator service: builds domain course nodes from a curriculum and runs the engine (ERS §16.5).

The eligibility and credit-limit rules live entirely in the pure domain layer; this service only
loads curriculum data and adapts it to and from domain types.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import RequirementType
from app.common.exception.errors import NotFoundError
from app.domain.simulation.eligibility import CourseNode, ScenarioState, simulate_next_courses
from app.domain.simulation.english_rules import EnglishState
from app.modules.academic import crud
from app.modules.simulation.schema import (
    BlockedCourseOut,
    CourseNodeOut,
    ReasonOut,
    SimulationRunIn,
    SimulationRunOut,
)


async def build_course_nodes(db: AsyncSession, curriculum_id: uuid.UUID) -> list[CourseNode]:
    """Build domain course nodes (keyed by course code) from a curriculum."""
    curriculum_courses = list(await crud.list_curriculum_courses(db, curriculum_id))
    if not curriculum_courses:
        return []

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

    return [
        CourseNode(
            key=courses[cc.course_id].code,
            credits=cc.credits,
            prerequisites=prerequisites.get(cc.id, []),
            corequisites=corequisites.get(cc.id, []),
            name=courses[cc.course_id].name,
        )
        for cc in curriculum_courses
    ]


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

"""Course eligibility and enrollment simulation (ERS §8.20-8.22, §16.5).

A course is eligible if it is not already passed, all its prerequisites are passed and its
corequisites are passed or selected in the same scenario. Annulled courses count neither as passed
nor as failed (ERS §8.15).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.numeric import to_decimal
from app.domain.simulation.credit_limits import (
    CreditLimitResult,
    RestrictionReason,
    calculate_credit_limit,
)
from app.domain.simulation.english_rules import EnglishState


@dataclass(slots=True)
class CourseNode:
    """A curriculum course for the simulator, identified by ``key`` (code or id)."""

    key: str
    credits: Decimal | str
    prerequisites: list[str] = field(default_factory=list)
    corequisites: list[str] = field(default_factory=list)
    name: str = ""

    @property
    def credit_value(self) -> Decimal:
        return to_decimal(self.credits) or Decimal("0")


@dataclass(slots=True)
class ScenarioState:
    """The student's assumed state in the simulated scenario."""

    passed: set[str] = field(default_factory=set)
    failed: set[str] = field(default_factory=set)
    annulled: set[str] = field(default_factory=set)


@dataclass(slots=True)
class BlockReason:
    code: str
    message: str


@dataclass(slots=True)
class EligibilityResult:
    is_eligible: bool
    reasons: list[BlockReason] = field(default_factory=list)


@dataclass(slots=True)
class BlockedCourse:
    course: CourseNode
    reasons: list[BlockReason]


@dataclass(slots=True)
class SimulationResult:
    max_credits: Decimal
    selected_credits: Decimal
    selected_valid: bool
    eligible_courses: list[CourseNode]
    blocked_courses: list[BlockedCourse]
    restriction_reasons: list[RestrictionReason]


def check_course_eligibility(
    course: CourseNode, scenario: ScenarioState, selected: set[str]
) -> EligibilityResult:
    """Decide whether a course can be taken in the given scenario."""
    reasons: list[BlockReason] = []

    if course.key in scenario.passed:
        already = BlockReason("ALREADY_PASSED", "La materia ya está aprobada.")
        return EligibilityResult(False, [already])

    for prereq in course.prerequisites:
        if prereq not in scenario.passed:
            reasons.append(
                BlockReason("MISSING_PREREQUISITE", f"Falta aprobar el prerrequisito {prereq}.")
            )

    for coreq in course.corequisites:
        if coreq not in scenario.passed and coreq not in selected:
            reasons.append(
                BlockReason(
                    "COREQUISITE_NOT_MET",
                    f"El correquisito {coreq} debe estar aprobado o seleccionado.",
                )
            )

    return EligibilityResult(is_eligible=not reasons, reasons=reasons)


def calculate_approved_credits(courses: list[CourseNode], scenario: ScenarioState) -> Decimal:
    return sum(
        (c.credit_value for c in courses if c.key in scenario.passed), start=Decimal("0")
    )


def simulate_next_courses(
    courses: list[CourseNode],
    scenario: ScenarioState,
    selected: set[str],
    *,
    english: EnglishState | None = None,
    has_special_credit_authorization: bool = False,
) -> SimulationResult:
    """Main simulator engine (ERS §8.22, §16.5)."""
    english = english or EnglishState()
    approved_credits = calculate_approved_credits(courses, scenario)

    limit: CreditLimitResult = calculate_credit_limit(
        approved_credits,
        has_pending_failed_courses=bool(scenario.failed),
        english=english,
        has_special_credit_authorization=has_special_credit_authorization,
    )
    reasons = list(limit.reasons)

    eligible: list[CourseNode] = []
    blocked: list[BlockedCourse] = []
    for course in courses:
        result = check_course_eligibility(course, scenario, selected)
        if result.is_eligible:
            eligible.append(course)
        else:
            blocked.append(BlockedCourse(course=course, reasons=result.reasons))

    by_key = {c.key: c for c in courses}
    selected_credits = sum(
        (by_key[k].credit_value for k in selected if k in by_key), start=Decimal("0")
    )
    selected_valid = selected_credits <= limit.max_credits

    if not _repeated_courses_selected_first(scenario, selected, eligible):
        selected_valid = False
        reasons.append(
            RestrictionReason(
                "REPEATED_COURSES_MUST_BE_SELECTED_FIRST",
                "Debes priorizar las materias reprobadas antes de seleccionar otras.",
            )
        )

    return SimulationResult(
        max_credits=limit.max_credits,
        selected_credits=selected_credits,
        selected_valid=selected_valid,
        eligible_courses=eligible,
        blocked_courses=blocked,
        restriction_reasons=reasons,
    )


def _repeated_courses_selected_first(
    scenario: ScenarioState, selected: set[str], eligible: list[CourseNode]
) -> bool:
    """If there are pending eligible failed courses they must be selected first (ERS §8.17)."""
    if not scenario.failed:
        return True
    eligible_keys = {c.key for c in eligible}
    eligible_failed = scenario.failed & eligible_keys
    if not eligible_failed:
        return True
    selects_other = bool(selected - scenario.failed)
    missing_failed = bool(eligible_failed - selected)
    # Only invalid when selecting other courses while leaving eligible failed ones out.
    return not (selects_other and missing_failed)

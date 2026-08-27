"""Credit-limit and selection-validity rules (ERS §8.16-8.18, §8.22)."""

from __future__ import annotations

from decimal import Decimal

from app.domain.enums import EnglishLevel
from app.domain.simulation.credit_limits import (
    MAX_CREDITS_NORMAL,
    MAX_CREDITS_REPETITION,
    MAX_CREDITS_SPECIAL_AUTHORIZATION,
    calculate_credit_limit,
)
from app.domain.simulation.eligibility import (
    CourseNode,
    ScenarioState,
    simulate_next_courses,
)
from app.domain.simulation.english_rules import EnglishState


def _reason_codes(result) -> set[str]:  # noqa: ANN001
    return {r.code for r in result.reasons}


# --- Special authorization ----------------------------------------------------------------------


def test_without_authorization_the_ceiling_is_fifteen():
    result = calculate_credit_limit(
        30, has_pending_failed_courses=False, english=EnglishState()
    )
    assert result.max_credits == MAX_CREDITS_NORMAL
    assert result.reasons == []


def test_special_authorization_actually_raises_the_ceiling():
    """It used to be a no-op: the branch only fired when the ceiling was already 15."""
    result = calculate_credit_limit(
        30,
        has_pending_failed_courses=False,
        english=EnglishState(),
        has_special_credit_authorization=True,
    )
    assert result.max_credits == MAX_CREDITS_SPECIAL_AUTHORIZATION
    assert result.max_credits > MAX_CREDITS_NORMAL
    assert "SPECIAL_AUTHORIZATION" in _reason_codes(result)


def test_authorization_does_not_defeat_the_repetition_limit():
    result = calculate_credit_limit(
        30,
        has_pending_failed_courses=True,
        english=EnglishState(),
        has_special_credit_authorization=True,
    )
    assert result.max_credits == MAX_CREDITS_REPETITION
    assert "REPETITION_LIMIT_12" in _reason_codes(result)


def test_authorization_does_not_defeat_the_english_limit():
    result = calculate_credit_limit(
        80,
        has_pending_failed_courses=False,
        english=EnglishState(level=EnglishLevel.BASIC_1),
        has_special_credit_authorization=True,
    )
    assert result.max_credits == Decimal("9")
    assert "ENGLISH_LIMIT" in _reason_codes(result)


def test_the_authorized_ceiling_is_configurable():
    result = calculate_credit_limit(
        30,
        has_pending_failed_courses=False,
        english=EnglishState(),
        has_special_credit_authorization=True,
        authorized_ceiling=Decimal("21"),
    )
    assert result.max_credits == Decimal("21")


# --- Selection validity -------------------------------------------------------------------------


def _two_course_curriculum() -> list[CourseNode]:
    return [
        CourseNode(key="A", credits="3", name="Base"),
        CourseNode(key="B", credits="3", prerequisites=["A"], name="Avanzada"),
    ]


def test_selecting_a_course_whose_prerequisite_is_missing_is_invalid():
    """The simulator used to bless any selection that merely fitted in the credit budget."""
    result = simulate_next_courses(
        _two_course_curriculum(), ScenarioState(), selected={"B"}
    )
    assert result.selected_valid is False
    assert "SELECTED_COURSE_NOT_ELIGIBLE" in {r.code for r in result.restriction_reasons}


def test_selecting_an_eligible_course_is_valid():
    result = simulate_next_courses(
        _two_course_curriculum(), ScenarioState(), selected={"A"}
    )
    assert result.selected_valid is True


def test_a_course_code_that_does_not_exist_is_reported():
    result = simulate_next_courses(
        _two_course_curriculum(), ScenarioState(), selected={"NOPE"}
    )
    assert result.selected_valid is False
    assert "UNKNOWN_COURSE_SELECTED" in {r.code for r in result.restriction_reasons}


def test_passed_courses_are_not_reported_as_blocked():
    """Listing every finished course as "blocked" buries the real blockers."""
    scenario = ScenarioState(passed={"A"})
    result = simulate_next_courses(_two_course_curriculum(), scenario, selected=set())

    blocked_keys = {b.course.key for b in result.blocked_courses}
    assert "A" not in blocked_keys
    assert {c.key for c in result.eligible_courses} == {"B"}


def test_a_course_with_unmet_prerequisites_is_still_reported_as_blocked():
    result = simulate_next_courses(_two_course_curriculum(), ScenarioState(), selected=set())
    blocked = {b.course.key: [r.code for r in b.reasons] for b in result.blocked_courses}
    assert blocked == {"B": ["MISSING_PREREQUISITE"]}

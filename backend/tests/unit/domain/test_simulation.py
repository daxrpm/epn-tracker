"""Tests del simulador: inglés, créditos y elegibilidad (ERS §8.15-8.22, §24.4, CA-008..011)."""

from decimal import Decimal

from app.domain.enums import EnglishLevel
from app.domain.simulation.credit_limits import calculate_credit_limit
from app.domain.simulation.eligibility import (
    CourseNode,
    ScenarioState,
    check_course_eligibility,
    simulate_next_courses,
)
from app.domain.simulation.english_rules import EnglishState, calculate_english_credit_limit

# --- Inglés (ERS §8.18, CA-009/010) ---------------------------------------------------------------


def test_ca_009_english_45_credits_limit_12():
    limit = calculate_english_credit_limit("45", EnglishState(level=EnglishLevel.BASIC_2))
    assert limit == Decimal("12")


def test_ca_010_english_75_credits_limit_9():
    limit = calculate_english_credit_limit("75", EnglishState(sufficiency=False))
    assert limit == Decimal("9")


def test_english_sufficiency_no_limit():
    limit = calculate_english_credit_limit("120", EnglishState(sufficiency=True))
    assert limit is None


def test_english_exception_last_level():
    state = EnglishState(
        sufficiency=False, last_required_level_enrolled=True, has_exception_authorization=True
    )
    assert calculate_english_credit_limit("120", state) == Decimal("15")


# --- Créditos (ERS §8.16-8.17) --------------------------------------------------------------------


def test_repetition_limit_12():
    result = calculate_credit_limit(
        "30", has_pending_failed_courses=True, english=EnglishState()
    )
    assert result.max_credits == Decimal("12")
    assert any(r.code == "REPETITION_LIMIT_12" for r in result.reasons)


def test_min_of_restrictions_taken():
    # 75 credits without English => 9, plus repetition 12 => take the minimum 9
    result = calculate_credit_limit(
        "75", has_pending_failed_courses=True, english=EnglishState(sufficiency=False)
    )
    assert result.max_credits == Decimal("9")


# --- Elegibilidad (ERS §8.20-8.22, CA-008/011) ----------------------------------------------------


def _courses() -> list[CourseNode]:
    return [
        CourseNode(key="ICCD442", credits="4"),
        CourseNode(
            key="ICCD523", credits="3", prerequisites=["ICCD442"], name="Inteligencia Artificial"
        ),
    ]


def test_ca_008_missing_prerequisite_blocks():
    scenario = ScenarioState(passed=set())
    course = _courses()[1]
    result = check_course_eligibility(course, scenario, selected=set())
    assert result.is_eligible is False
    assert any(r.code == "MISSING_PREREQUISITE" for r in result.reasons)


def test_prerequisite_passed_makes_eligible():
    scenario = ScenarioState(passed={"ICCD442"})
    result = check_course_eligibility(_courses()[1], scenario, selected=set())
    assert result.is_eligible is True


def test_ca_011_annulled_does_not_unlock():
    # ICCD442 annulled != passed => ICCD523 stays blocked
    scenario = ScenarioState(annulled={"ICCD442"})
    result = check_course_eligibility(_courses()[1], scenario, selected=set())
    assert result.is_eligible is False


def test_already_passed_not_candidate():
    scenario = ScenarioState(passed={"ICCD442"})
    result = check_course_eligibility(_courses()[0], scenario, selected=set())
    assert result.is_eligible is False
    assert result.reasons[0].code == "ALREADY_PASSED"


def test_corequisite_selected_allows_course():
    courses = [
        CourseNode(key="A", credits="3"),
        CourseNode(key="B", credits="3", corequisites=["A"]),
    ]
    scenario = ScenarioState()
    result = check_course_eligibility(courses[1], scenario, selected={"A"})
    assert result.is_eligible is True


def test_simulate_next_courses_end_to_end():
    courses = _courses()
    scenario = ScenarioState(passed={"ICCD442"})
    result = simulate_next_courses(courses, scenario, selected={"ICCD523"})
    assert result.max_credits == Decimal("15")
    assert result.selected_credits == Decimal("3")
    assert result.selected_valid is True
    assert any(c.key == "ICCD523" for c in result.eligible_courses)


def test_simulate_repeated_must_be_first():
    courses = [
        CourseNode(key="FAILED1", credits="4"),
        CourseNode(key="NEW1", credits="4"),
    ]
    scenario = ScenarioState(failed={"FAILED1"})
    # Selects the new course while leaving out the eligible failed one => invalid
    result = simulate_next_courses(courses, scenario, selected={"NEW1"})
    assert result.selected_valid is False
    codes = [r.code for r in result.restriction_reasons]
    assert "REPEATED_COURSES_MUST_BE_SELECTED_FIRST" in codes

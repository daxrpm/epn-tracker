"""Simulator domain rules: English, credits and course eligibility."""

from app.domain.simulation.credit_limits import (
    CreditLimitResult,
    calculate_credit_limit,
)
from app.domain.simulation.eligibility import (
    CourseNode,
    EligibilityResult,
    ScenarioState,
    check_course_eligibility,
    simulate_next_courses,
)
from app.domain.simulation.english_rules import (
    EnglishState,
    calculate_english_credit_limit,
)

__all__ = [
    "CourseNode",
    "CreditLimitResult",
    "EligibilityResult",
    "EnglishState",
    "ScenarioState",
    "calculate_credit_limit",
    "calculate_english_credit_limit",
    "check_course_eligibility",
    "simulate_next_courses",
]

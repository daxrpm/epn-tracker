"""Completeness and scale handling in the grade calculator.

These pin down the mismatch that left a perfectly valid scheme permanently IN_PROGRESS: validation
tolerated a one-cent shortfall while completeness demanded exact equality.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.domain.enums import Contribution, EvaluationType, GradeComponentMode
from app.domain.grading.grade_calculation import (
    ComponentInput,
    calculate_contribution,
    normalize_score,
)
from app.domain.grading.scheme_validation import SchemeComponent, validate_scheme


def _component(weight: str, score: str) -> ComponentInput:
    return ComponentInput(
        weight_percent=weight,
        mode=GradeComponentMode.DIRECT_SCORE,
        direct_score=score,
        direct_score_scale="20",
    )


def test_three_thirds_are_complete_even_though_they_sum_to_99_99():
    components = [_component("33.33", "15") for _ in range(3)]
    result = calculate_contribution(components)

    assert result.evaluated_weight_percent == Decimal("99.99")
    assert result.is_complete is True, "a valid scheme must be able to finish"


def test_a_scheme_summing_to_99_99_is_accepted_by_validation():
    """The two rules have to agree, which is the whole point of the shared tolerance."""
    components = [
        SchemeComponent(
            contribution=contribution,
            name=name,
            weight_percent="33.33",
            evaluation_type=kind,
        )
        for contribution in (Contribution.APORTE_1, Contribution.APORTE_2)
        for name, kind in (
            ("A", EvaluationType.FORMATIVE),
            ("B", EvaluationType.SUMMATIVE),
            ("C", EvaluationType.FORMATIVE),
        )
    ]
    assert validate_scheme(components, strict=True).is_valid is True


def test_an_incomplete_contribution_is_not_complete():
    result = calculate_contribution([_component("50", "15")])
    assert result.evaluated_weight_percent == Decimal("50")
    assert result.is_complete is False


def test_a_two_cent_shortfall_is_still_incomplete():
    result = calculate_contribution([_component("99.98", "15")])
    assert result.is_complete is False


def test_an_ungraded_component_does_not_count_toward_completeness():
    graded = _component("60", "15")
    ungraded = ComponentInput(
        weight_percent="40", mode=GradeComponentMode.DIRECT_SCORE, direct_score=None
    )
    result = calculate_contribution([graded, ungraded])

    assert result.evaluated_weight_percent == Decimal("60")
    assert result.is_complete is False


# --- Scale handling -----------------------------------------------------------------------------


def test_a_missing_scale_means_already_over_twenty():
    assert normalize_score("15", None) == Decimal("15")


def test_a_score_is_rescaled_onto_twenty():
    assert normalize_score("7", "10") == Decimal("14")


def test_a_zero_scale_is_an_error_rather_than_a_silent_default():
    """It used to fall back to /20, reporting a wrong grade instead of failing."""
    with pytest.raises(ValueError, match="greater than zero"):
        normalize_score("7", "0")


def test_a_negative_scale_is_rejected():
    with pytest.raises(ValueError):
        normalize_score("7", "-10")

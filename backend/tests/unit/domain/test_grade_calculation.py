"""Tests del cálculo de notas (ERS §8.2, §8.4, §16.1-16.3, §24.2)."""

from decimal import Decimal

import pytest

from app.domain.enums import CourseFinalStatus, GradeComponentMode
from app.domain.grading.grade_calculation import (
    ComponentInput,
    ItemInput,
    calculate_component_score,
    calculate_contribution,
    calculate_final,
)


def test_direct_score_returns_value():
    score = calculate_component_score(GradeComponentMode.DIRECT_SCORE, "14.75", [])
    assert score == Decimal("14.75")


def test_equal_average():  # ERS §8.8
    items = [ItemInput(score="18"), ItemInput(score="16"), ItemInput(score="20")]
    score = calculate_component_score(GradeComponentMode.EQUAL_AVERAGE, None, items)
    assert score == Decimal("18")


def test_custom_weights(): # ERS §8.8: 15*0.4 + 18*0.6 = 16.8
    items = [
        ItemInput(score="15", internal_weight_percent="40"),
        ItemInput(score="18", internal_weight_percent="60"),
    ]
    score = calculate_component_score(GradeComponentMode.CUSTOM_WEIGHTS, None, items)
    assert score == Decimal("16.8")


def test_equal_average_ignores_missing_items():
    items = [ItemInput(score="20"), ItemInput(score=None)]
    score = calculate_component_score(GradeComponentMode.EQUAL_AVERAGE, None, items)
    assert score == Decimal("20")


def test_contribution_partial_reports_evaluated_weight():
    # Homework 18/20 @20% => 3.6 ; Exam without a score @35% does not count yet
    direct = GradeComponentMode.DIRECT_SCORE
    components = [
        ComponentInput(weight_percent="20", mode=direct, direct_score="18"),
        ComponentInput(weight_percent="35", mode=direct, direct_score=None),
    ]
    result = calculate_contribution(components)
    assert result.score_20 == Decimal("3.6")
    assert result.evaluated_weight_percent == Decimal("20")
    assert result.is_complete is False


def test_float_is_rejected():
    with pytest.raises(TypeError):
        calculate_component_score(GradeComponentMode.DIRECT_SCORE, 14.75, [])  # type: ignore[arg-type]


# ERS §24.2 — final grade test cases
@pytest.mark.parametrize(
    ("a1", "a2", "final_40", "status"),
    [
        ("14", "14", "28", CourseFinalStatus.APPROVED),  # CA-002
        ("10", "8", "18", CourseFinalStatus.RECOVERY_ELIGIBLE),
        ("10", "10", "20", CourseFinalStatus.RECOVERY_ELIGIBLE),
        ("12", "12", "24", CourseFinalStatus.RECOVERY_ELIGIBLE),
        ("8", "9.99", "17.99", CourseFinalStatus.FAILED_DIRECT),  # CA-003
    ],
)
def test_final_grade_table(a1, a2, final_40, status):
    result = calculate_final(a1, a2, is_complete=True)
    assert result.final_40 == Decimal(final_40)
    assert result.status == status


def test_final_incomplete_is_in_progress():
    result = calculate_final("10", "10", is_complete=False)
    assert result.status == CourseFinalStatus.IN_PROGRESS

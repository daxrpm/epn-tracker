"""Tests de la proyección de notas (ERS §8.7, §RF-009)."""

from decimal import Decimal

from app.domain.enums import Contribution
from app.domain.grading.projection import (
    ProjectionComponent,
    project_target,
)

A1 = Contribution.APORTE_1
A2 = Contribution.APORTE_2


def _full_scheme(a1_score=None, a2_score=None):
    """Two contributions, each a single 100%-weight component."""
    return [
        ProjectionComponent(contribution=A1, weight_percent="100", calculated_score=a1_score),
        ProjectionComponent(contribution=A2, weight_percent="100", calculated_score=a2_score),
    ]


def test_nothing_scored_requires_target_average():
    result = project_target(_full_scheme(), target_final_40="28")
    # Nothing scored -> 200 remaining, need (28-0)*100/200 = 14 avg /20.
    assert result.current_points_40 == Decimal("0")
    assert result.evaluated_weight_percent == Decimal("0")
    assert result.remaining_weight_percent == Decimal("200")
    assert result.required_avg_score_20 == Decimal("14")
    assert result.already_reached is False
    assert result.is_reachable is True


def test_partial_progress():
    # APORTE_1 = 14/20 @100% -> 14 points. APORTE_2 remaining (100 weight).
    result = project_target(_full_scheme(a1_score="14"), target_final_40="28")
    assert result.current_points_40 == Decimal("14")
    assert result.evaluated_weight_percent == Decimal("100")
    assert result.remaining_weight_percent == Decimal("100")
    # Need (28-14)*100/100 = 14 on the remaining contribution.
    assert result.required_avg_score_20 == Decimal("14")
    assert result.already_reached is False
    assert result.is_reachable is True


def test_already_reached():
    result = project_target(_full_scheme(a1_score="20", a2_score="20"), target_final_40="28")
    assert result.current_points_40 == Decimal("40")
    assert result.remaining_weight_percent == Decimal("0")
    assert result.required_avg_score_20 is None
    assert result.already_reached is True
    assert result.is_reachable is True


def test_already_reached_with_remaining_weight():
    # APORTE_1 = 20/20 already gives 20 points; but target is 18, so already reached.
    result = project_target(_full_scheme(a1_score="20"), target_final_40="18")
    assert result.current_points_40 == Decimal("20")
    assert result.remaining_weight_percent == Decimal("100")
    # Required average is negative (already over target) but still reachable.
    assert result.required_avg_score_20 == Decimal("-2")
    assert result.already_reached is True
    assert result.is_reachable is True


def test_unreachable_target():
    # APORTE_1 = 2/20 -> 2 points, need (28-2)*100/100 = 26 on the rest: impossible.
    result = project_target(_full_scheme(a1_score="2"), target_final_40="28")
    assert result.remaining_weight_percent == Decimal("100")
    assert result.required_avg_score_20 == Decimal("26")
    assert result.already_reached is False
    assert result.is_reachable is False


def test_complete_but_below_target():
    # Everything scored, final = 20, below target 28: not reachable and not already reached.
    result = project_target(_full_scheme(a1_score="10", a2_score="10"), target_final_40="28")
    assert result.current_points_40 == Decimal("20")
    assert result.remaining_weight_percent == Decimal("0")
    assert result.required_avg_score_20 is None
    assert result.already_reached is False
    assert result.is_reachable is False


def test_multiple_components_weighted():
    components = [
        ProjectionComponent(contribution=A1, weight_percent="30", calculated_score="18"),
        ProjectionComponent(contribution=A1, weight_percent="70", calculated_score=None),
        ProjectionComponent(contribution=A2, weight_percent="40", calculated_score="15"),
        ProjectionComponent(contribution=A2, weight_percent="60", calculated_score=None),
    ]
    result = project_target(components, target_final_40="28")
    # Scored points: 18*30/100 + 15*40/100 = 5.4 + 6.0 = 11.4
    assert result.current_points_40 == Decimal("11.4")
    assert result.evaluated_weight_percent == Decimal("70")
    assert result.remaining_weight_percent == Decimal("130")
    # Need (28-11.4)*100/130 = 16.6*100/130
    assert result.required_avg_score_20 == (Decimal("16.6") * Decimal("100") / Decimal("130"))
    assert result.is_reachable is True


def test_default_target_is_28():
    result = project_target(_full_scheme())
    assert result.target_final_40 == Decimal("28")


def test_partial_scheme_under_200_weight():
    # Only one contribution defined (weight 100): remaining is 100, not 200.
    components = [
        ProjectionComponent(contribution=A1, weight_percent="100", calculated_score=None),
    ]
    result = project_target(components, target_final_40="14")
    assert result.remaining_weight_percent == Decimal("100")
    assert result.required_avg_score_20 == Decimal("14")

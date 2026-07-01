"""Tests de recuperación / supletorio (ERS §8.5-8.6, §16.4, §24.2)."""

from decimal import Decimal

import pytest

from app.domain.grading.recovery import (
    evaluate_recovery,
    improved_final_with_recovery,
    is_recovery_eligible,
    required_recovery_score,
)


# ERS §8.5 — nota mínima necesaria en recuperación
@pytest.mark.parametrize(
    ("final_40", "eligible", "required"),
    [
        ("17.99", False, None),
        ("18.00", True, "30.00"),
        ("20.00", True, "28.00"),
        ("24.00", True, "24.00"),
        ("27.50", True, "24.00"),
        ("28.00", False, None),  # ya aprobó
    ],
)
def test_required_recovery_table(final_40, eligible, required):
    assert is_recovery_eligible(final_40) is eligible
    result = required_recovery_score(final_40)
    if required is None:
        assert result is None
    else:
        assert result == Decimal(required)


def test_ca_001_final_20_needs_28():
    # CA-001: final 20/40 => necesita 28/40 en recuperación
    assert required_recovery_score("20") == Decimal("28")


def test_evaluate_recovery_pass():
    # final 20 + recuperación 30 => promedio 25 >= 24 y recuperación >= 24 => aprueba
    result = evaluate_recovery("20", "30")
    assert result.is_eligible is True
    assert result.passed is True
    assert result.averaged_final_40 == Decimal("25")


def test_evaluate_recovery_fail_low_recovery():
    # recuperación 23 < 24 => no aprueba aunque el promedio pudiera acercarse
    result = evaluate_recovery("24", "23")
    assert result.passed is False


def test_improvement_only_if_higher():
    assert improved_final_with_recovery("30", "20") == Decimal("30")
    assert improved_final_with_recovery("30", "38") == Decimal("34")

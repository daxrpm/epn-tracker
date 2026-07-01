"""Examen de recuperación / supletorio (ERS §8.5-8.6, §16.4).

Sobre 40 puntos. Elegible si ``18 <= final_40 < 28``. Para aprobar, la recuperación debe ser >= 24 y
el promedio ``(final_40 + recovery_40) / 2 >= 24``.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.domain.numeric import to_decimal

RECOVERY_FLOOR_40 = Decimal("18")
APPROVED_THRESHOLD_40 = Decimal("28")
RECOVERY_MIN_SCORE_40 = Decimal("24")
RECOVERY_TARGET_SUM = Decimal("48")  # 2 * 24


@dataclass(slots=True)
class RecoveryResult:
    is_eligible: bool
    required_recovery_score_40: Decimal | None
    passed: bool | None = None
    averaged_final_40: Decimal | None = None


def is_recovery_eligible(final_40: Decimal | str) -> bool:
    value = to_decimal(final_40)
    if value is None:
        return False
    return RECOVERY_FLOOR_40 <= value < APPROVED_THRESHOLD_40


def required_recovery_score(final_40: Decimal | str) -> Decimal | None:
    """Nota mínima necesaria en recuperación: ``max(24, 48 - final_40)`` (ERS §8.5)."""
    value = to_decimal(final_40)
    if value is None or not (RECOVERY_FLOOR_40 <= value < APPROVED_THRESHOLD_40):
        return None
    return max(RECOVERY_MIN_SCORE_40, RECOVERY_TARGET_SUM - value)


def evaluate_recovery(
    final_40: Decimal | str, recovery_score_40: Decimal | str | None = None
) -> RecoveryResult:
    """Evalúa elegibilidad y, si se da la nota de recuperación, si el estudiante aprueba."""
    eligible = is_recovery_eligible(final_40)
    required = required_recovery_score(final_40)

    recovery = to_decimal(recovery_score_40)
    if recovery is None:
        return RecoveryResult(is_eligible=eligible, required_recovery_score_40=required)

    final = to_decimal(final_40) or Decimal("0")
    averaged = (final + recovery) / Decimal("2")
    passed = recovery >= RECOVERY_MIN_SCORE_40 and averaged >= RECOVERY_MIN_SCORE_40
    return RecoveryResult(
        is_eligible=eligible,
        required_recovery_score_40=required,
        passed=passed,
        averaged_final_40=averaged,
    )


def improved_final_with_recovery(
    final_40: Decimal | str, recovery_score_40: Decimal | str
) -> Decimal:
    """Mejora opcional de nota con recuperación (ERS §8.6). No es el flujo principal."""
    final = to_decimal(final_40) or Decimal("0")
    recovery = to_decimal(recovery_score_40) or Decimal("0")
    if recovery <= final:
        return final
    return max(final, (final + recovery) / Decimal("2"))

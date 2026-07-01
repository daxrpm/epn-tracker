"""Límite de créditos matriculables (ERS §8.16-8.18).

Combina el máximo normal (15), la restricción por repetición (12) y la restricción por inglés, y
devuelve el mínimo aplicable junto con las razones textuales.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.numeric import to_decimal
from app.domain.simulation.english_rules import EnglishState, calculate_english_credit_limit

MAX_CREDITS_NORMAL = Decimal("15")
MAX_CREDITS_REPETITION = Decimal("12")


@dataclass(slots=True)
class RestrictionReason:
    code: str
    message: str


@dataclass(slots=True)
class CreditLimitResult:
    max_credits: Decimal
    reasons: list[RestrictionReason] = field(default_factory=list)


def calculate_credit_limit(
    approved_credits: Decimal | str | int,
    *,
    has_pending_failed_courses: bool,
    english: EnglishState,
    has_special_credit_authorization: bool = False,
) -> CreditLimitResult:
    """Calcula el límite de créditos aplicando todas las restricciones (toma el mínimo)."""
    reasons: list[RestrictionReason] = []
    max_credits = MAX_CREDITS_NORMAL

    if has_pending_failed_courses and max_credits > MAX_CREDITS_REPETITION:
        max_credits = MAX_CREDITS_REPETITION
        reasons.append(
            RestrictionReason(
                "REPETITION_LIMIT_12",
                "Tienes materias reprobadas pendientes. El límite es 12 créditos y debes "
                "priorizarlas.",
            )
        )

    english_limit = calculate_english_credit_limit(approved_credits, english)
    if english_limit is not None and english_limit < max_credits:
        max_credits = english_limit
        credits = to_decimal(approved_credits) or Decimal("0")
        reasons.append(
            RestrictionReason(
                "ENGLISH_LIMIT",
                f"Por tus {credits} créditos aprobados y tu estado de inglés, el límite "
                f"simulado es {english_limit} créditos.",
            )
        )

    # La autorización especial solo levanta el máximo normal, no las otras restricciones.
    if has_special_credit_authorization and not has_pending_failed_courses and not reasons:
        max_credits = MAX_CREDITS_NORMAL

    return CreditLimitResult(max_credits=max_credits, reasons=reasons)

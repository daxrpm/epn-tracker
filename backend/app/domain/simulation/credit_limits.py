"""Maximum enrollable credits (ERS §8.16-8.18).

Combines the normal maximum (15), the repetition restriction (12) and the English restriction, and
returns the applicable minimum together with the textual reasons.
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
    """Compute the credit limit applying every restriction (takes the minimum)."""
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

    # A special authorization only lifts the normal maximum, not the other restrictions.
    if has_special_credit_authorization and not has_pending_failed_courses and not reasons:
        max_credits = MAX_CREDITS_NORMAL

    return CreditLimitResult(max_credits=max_credits, reasons=reasons)

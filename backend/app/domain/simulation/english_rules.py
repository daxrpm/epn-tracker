"""Credit restriction based on English level (ERS §8.18, §16.6).

For third-level undergraduate programs:
- >= 45 credits and level < INTERMEDIATE_1  -> limit 12
- >= 75 credits and no sufficiency          -> limit 9
- >= 120 credits and no sufficiency         -> limit 9 (15 with an exception at the last level)
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.domain.enums import EnglishLevel
from app.domain.numeric import to_decimal

LIMIT_45 = Decimal("12")
LIMIT_75 = Decimal("9")
LIMIT_120 = Decimal("9")
EXCEPTION_LIMIT = Decimal("15")


@dataclass(slots=True)
class EnglishState:
    level: EnglishLevel = EnglishLevel.NONE
    sufficiency: bool = False
    last_required_level_enrolled: bool = False
    has_exception_authorization: bool = False


def calculate_english_credit_limit(
    approved_credits: Decimal | str | int, english: EnglishState
) -> Decimal | None:
    """Return the credit limit imposed by English, or ``None`` if it does not apply."""
    credits = to_decimal(approved_credits) or Decimal("0")

    if credits >= Decimal("120") and not english.sufficiency:
        if english.last_required_level_enrolled and english.has_exception_authorization:
            return EXCEPTION_LIMIT
        return LIMIT_120

    if credits >= Decimal("75") and not english.sufficiency:
        if english.last_required_level_enrolled and english.has_exception_authorization:
            return EXCEPTION_LIMIT
        return LIMIT_75

    if (
        credits >= Decimal("45")
        and not english.sufficiency
        and english.level.rank < EnglishLevel.INTERMEDIATE_1.rank
    ):
        return LIMIT_45

    return None

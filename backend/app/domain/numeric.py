"""Pure numeric helpers for the domain layer (ERS §8.1, §RNF-006).

Rule: internally we keep full precision with ``Decimal``. Rounding is only for display (2 decimals,
``ROUND_HALF_UP``). ``float`` is never used.

This module has no framework dependencies; it is the numeric foundation of the domain layer.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0")


def to_decimal(value: str | int | Decimal | None) -> Decimal | None:
    """Safely convert to ``Decimal``. Rejects ``float`` to avoid precision loss."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        raise TypeError("float is not allowed in grade calculations; use str or Decimal.")
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid decimal value: {value!r}") from exc


def require_decimal(value: str | int | Decimal) -> Decimal:
    result = to_decimal(value)
    if result is None:
        raise ValueError("Expected a decimal value but received None.")
    return result


def display_round(value: Decimal | None, places: Decimal = TWO_PLACES) -> Decimal | None:
    """Round for display to 2 decimals. Presentation only, never for storage."""
    if value is None:
        return None
    return value.quantize(places, rounding=ROUND_HALF_UP)


def display_str(value: Decimal | None, places: Decimal = TWO_PLACES) -> str | None:
    rounded = display_round(value, places)
    return None if rounded is None else str(rounded)

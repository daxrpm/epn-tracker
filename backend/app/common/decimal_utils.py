"""Utilidades de precisión decimal (ERS §8.1, §RNF-006).

Regla: internamente se conservan todos los decimales posibles con ``Decimal``. El redondeo es solo
para visualización (2 decimales, ``ROUND_HALF_UP``). Nunca se usa ``float``.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

TWO_PLACES = Decimal("0.01")


def to_decimal(value: str | int | Decimal | None) -> Decimal | None:
    """Convierte a ``Decimal`` de forma segura. Rechaza ``float`` para evitar imprecisión."""
    if value is None:
        return None
    if isinstance(value, float):
        raise TypeError("No se permite float en cálculos de notas; usa str o Decimal.")
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Valor decimal inválido: {value!r}") from exc


def display_round(value: Decimal | None, places: Decimal = TWO_PLACES) -> Decimal | None:
    """Redondeo visual a 2 decimales. Solo para presentación, no para almacenamiento."""
    if value is None:
        return None
    return value.quantize(places, rounding=ROUND_HALF_UP)


def display_str(value: Decimal | None, places: Decimal = TWO_PLACES) -> str | None:
    rounded = display_round(value, places)
    return None if rounded is None else str(rounded)

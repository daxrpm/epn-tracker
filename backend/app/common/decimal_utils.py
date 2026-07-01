"""Reexport de las utilidades numéricas del dominio para la capa de aplicación (ERS §RNF-006).

La implementación vive en ``app.domain.numeric`` (capa pura). El backend importa desde aquí.
"""

from app.domain.numeric import (
    TWO_PLACES,
    ZERO,
    display_round,
    display_str,
    require_decimal,
    to_decimal,
)

__all__ = [
    "TWO_PLACES",
    "ZERO",
    "display_round",
    "display_str",
    "require_decimal",
    "to_decimal",
]

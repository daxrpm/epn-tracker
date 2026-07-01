"""Tipos de columna compartidos.

Los montos numéricos usan ``Numeric`` con suficiente precisión para conservar todos los decimales
(ERS §RNF-006). El redondeo es solo visual en la capa de presentación.
"""

from __future__ import annotations

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Numeric

# Notas, pesos y puntajes: mucha precisión, sin float.
Score = Numeric(12, 4)
# Créditos y horas expresadas como decimal.
Credits = Numeric(8, 2)


def enum_column(enum_cls: type) -> SAEnum:
    """Enum portable (VARCHAR + CHECK) que funciona en PostgreSQL y SQLite."""
    return SAEnum(enum_cls, native_enum=False, validate_strings=True, length=40)

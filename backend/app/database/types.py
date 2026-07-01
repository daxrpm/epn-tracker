"""Shared column types.

Numeric amounts use ``Numeric`` with enough precision to keep all decimals (ERS §RNF-006). Rounding
is only visual in the presentation layer.
"""

from __future__ import annotations

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Numeric

# Grades, weights and scores: high precision, no float.
Score = Numeric(12, 4)
# Credits and hours expressed as decimals.
Credits = Numeric(8, 2)


def enum_column(enum_cls: type) -> SAEnum:
    """Portable enum (VARCHAR + CHECK) that works on both PostgreSQL and SQLite."""
    return SAEnum(enum_cls, native_enum=False, validate_strings=True, length=40)

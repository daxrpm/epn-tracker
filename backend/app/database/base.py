"""Base declarativa de SQLAlchemy y mixins compartidos.

Todas las entidades usan UUID como PK y llevan ``created_at`` / ``updated_at``. Los montos numéricos
(notas, pesos, créditos) se modelan con ``Numeric`` para mapear a ``Decimal`` y evitar ``float``
(ERS §RNF-006).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import Uuid

# Convención de nombres para índices/constraints: migraciones estables y deterministas.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, sort_order=-100
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), sort_order=100
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), sort_order=101
    )

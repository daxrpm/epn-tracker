"""Modelo de usuario (ERS §12.17).

El email se almacena normalizado a minúsculas para unicidad case-insensitive (portable a SQLite;
en producción PostgreSQL puede migrarse a ``citext``). Los códigos de verificación viven en Redis.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.enums import UserRole, UserStatus
from app.database.base import Base, TimestampMixin, UUIDMixin
from app.database.types import enum_column


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(nullable=True)
    role: Mapped[UserRole] = mapped_column(enum_column(UserRole), default=UserRole.STUDENT)
    status: Mapped[UserStatus] = mapped_column(enum_column(UserStatus), default=UserStatus.ACTIVE)

    @property
    def is_verified(self) -> bool:
        return self.email_verified_at is not None

"""User model (ERS §12.17).

The email is stored lowercased for case-insensitive uniqueness (portable to SQLite; in production
PostgreSQL it can be migrated to ``citext``). Verification codes live in Redis.
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

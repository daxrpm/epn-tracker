"""Acceso a datos del módulo IAM (sin lógica de negocio)."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import UserRole, UserStatus
from app.modules.iam.model import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def list_users(db: AsyncSession) -> Sequence[User]:
    return (await db.execute(select(User).order_by(User.created_at.desc()))).scalars().all()


async def count_active_superadmins(
    db: AsyncSession, *, exclude_user_id: uuid.UUID | None = None
) -> int:
    stmt = select(func.count(User.id)).where(
        User.role == UserRole.SUPER_ADMIN, User.status == UserStatus.ACTIVE
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    return (await db.execute(stmt)).scalar_one()


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password_hash: str,
    role: UserRole = UserRole.STUDENT,
) -> User:
    user = User(
        email=email.lower(),
        password_hash=password_hash,
        role=role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    await db.flush()
    return user

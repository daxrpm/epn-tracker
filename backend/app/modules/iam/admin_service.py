"""Superadmin user & role management (ERS §5.4, §24).

All mutations are guarded against the two ways an admin console can lock itself out or be abused:
a superadmin can never change their **own** role/status (no self-demotion or self-lockout), and the
**last active superadmin** can never be demoted, suspended or deleted. Every change is written to
the audit log with before/after snapshots.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.enums import UserRole, UserStatus
from app.common.exception.errors import ConflictError, ForbiddenError, NotFoundError
from app.common.security.password import hash_password
from app.modules.audit import crud as audit_crud
from app.modules.iam import crud
from app.modules.iam.model import User
from app.modules.iam.schema import AdminUserCreateIn


def _snapshot(user: User) -> dict:
    return {"email": user.email, "role": user.role.value, "status": user.status.value}


async def _get_target(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await crud.get_user(db, user_id)
    if user is None:
        raise NotFoundError("Usuario no encontrado.")
    return user


def _forbid_self(actor: User, target: User) -> None:
    if actor.id == target.id:
        raise ForbiddenError("No puedes modificar tu propia cuenta desde el panel.")


async def _guard_last_superadmin(db: AsyncSession, target: User) -> None:
    """Block an operation that would remove the last active superadmin."""
    if target.role == UserRole.SUPER_ADMIN and target.status == UserStatus.ACTIVE:
        remaining = await crud.count_active_superadmins(db, exclude_user_id=target.id)
        if remaining < 1:
            raise ConflictError("No puedes dejar al sistema sin un superadministrador activo.")


async def list_users(db: AsyncSession) -> Sequence[User]:
    return await crud.list_users(db)


async def create_user(db: AsyncSession, actor: User, payload: AdminUserCreateIn) -> User:
    if await crud.get_user_by_email(db, payload.email) is not None:
        raise ConflictError("Ya existe una cuenta con ese correo.")
    user = await crud.create_user(
        db,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    # Superadmin vouches for the account, so it starts verified (no email code needed).
    user.email_verified_at = datetime.now(UTC)
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor.id,
        action="USER_CREATE",
        entity_type="user",
        entity_id=str(user.id),
        after=_snapshot(user),
    )
    return user


async def update_role(
    db: AsyncSession, actor: User, user_id: uuid.UUID, new_role: UserRole
) -> User:
    target = await _get_target(db, user_id)
    _forbid_self(actor, target)
    if new_role != UserRole.SUPER_ADMIN:
        await _guard_last_superadmin(db, target)
    before = _snapshot(target)
    target.role = new_role
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor.id,
        action="USER_ROLE_CHANGE",
        entity_type="user",
        entity_id=str(target.id),
        before=before,
        after=_snapshot(target),
    )
    return target


async def update_status(
    db: AsyncSession, actor: User, user_id: uuid.UUID, new_status: UserStatus
) -> User:
    target = await _get_target(db, user_id)
    _forbid_self(actor, target)
    if new_status != UserStatus.ACTIVE:
        await _guard_last_superadmin(db, target)
    before = _snapshot(target)
    target.status = new_status
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor.id,
        action="USER_STATUS_CHANGE",
        entity_type="user",
        entity_id=str(target.id),
        before=before,
        after=_snapshot(target),
    )
    return target


async def delete_user(db: AsyncSession, actor: User, user_id: uuid.UUID) -> None:
    """Soft delete: mark the account DELETED (keeps FKs like audit actor and student history)."""
    target = await _get_target(db, user_id)
    _forbid_self(actor, target)
    await _guard_last_superadmin(db, target)
    before = _snapshot(target)
    target.status = UserStatus.DELETED
    await db.flush()
    await audit_crud.record(
        db,
        actor_user_id=actor.id,
        action="USER_DELETE",
        entity_type="user",
        entity_id=str(target.id),
        before=before,
        after=_snapshot(target),
    )

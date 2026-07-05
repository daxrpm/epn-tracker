"""Superadmin user & role management: authorization guards and safety rails (ERS §5.4, §24)."""

import pytest
from sqlalchemy import func, select

from app.common.enums import UserRole, UserStatus
from app.common.security.jwt import create_access_token
from app.common.security.password import hash_password
from app.modules.audit.model import AuditLog
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _make_user(db_session, email, role) -> User:
    user = User(email=email, role=role, password_hash=hash_password("password123"))
    db_session.add(user)
    await db_session.commit()
    return user


def _token(user: User) -> str:
    return create_access_token(str(user.id), role=user.role.value)


async def test_only_superadmin_can_list_users(client, db_session):
    student = await _make_user(db_session, "s@epn.edu.ec", UserRole.STUDENT)
    admin = await _make_user(db_session, "a@epn.edu.ec", UserRole.ADMIN)
    superadmin = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)

    url = "/api/v1/admin/users"
    assert (await client.get(url, headers=_auth(_token(student)))).status_code == 403
    assert (await client.get(url, headers=_auth(_token(admin)))).status_code == 403
    ok = await client.get(url, headers=_auth(_token(superadmin)))
    assert ok.status_code == 200
    assert {u["email"] for u in ok.json()} == {"s@epn.edu.ec", "a@epn.edu.ec", "root@epn.edu.ec"}


async def test_superadmin_creates_admin_verified(client, db_session):
    superadmin = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)
    resp = await client.post(
        "/api/v1/admin/users",
        json={"email": "nuevo@epn.edu.ec", "password": "supersecret1", "role": "ADMIN"},
        headers=_auth(_token(superadmin)),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["role"] == "ADMIN"
    assert body["status"] == "ACTIVE"
    assert body["is_verified"] is True

    # Duplicate email is rejected.
    dup = await client.post(
        "/api/v1/admin/users",
        json={"email": "nuevo@epn.edu.ec", "password": "supersecret1", "role": "ADMIN"},
        headers=_auth(_token(superadmin)),
    )
    assert dup.status_code == 409


async def test_change_role_is_audited(client, db_session):
    superadmin = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)
    student = await _make_user(db_session, "s@epn.edu.ec", UserRole.STUDENT)

    resp = await client.patch(
        f"/api/v1/admin/users/{student.id}/role",
        json={"role": "ADMIN"},
        headers=_auth(_token(superadmin)),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "ADMIN"

    count = (
        await db_session.execute(
            select(func.count(AuditLog.id)).where(AuditLog.action == "USER_ROLE_CHANGE")
        )
    ).scalar_one()
    assert count == 1


async def test_cannot_modify_self(client, db_session):
    superadmin = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)
    # A second superadmin exists so the guard that trips is self-protection, not last-superadmin.
    await _make_user(db_session, "root2@epn.edu.ec", UserRole.SUPER_ADMIN)
    token = _token(superadmin)

    assert (
        await client.patch(
            f"/api/v1/admin/users/{superadmin.id}/role",
            json={"role": "STUDENT"},
            headers=_auth(token),
        )
    ).status_code == 403
    assert (
        await client.delete(f"/api/v1/admin/users/{superadmin.id}", headers=_auth(token))
    ).status_code == 403


async def test_can_demote_a_superadmin_when_another_exists(client, db_session):
    superadmin = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)
    other = await _make_user(db_session, "root2@epn.edu.ec", UserRole.SUPER_ADMIN)

    # Two superadmins exist, so demoting one is allowed.
    resp = await client.patch(
        f"/api/v1/admin/users/{other.id}/role",
        json={"role": "ADMIN"},
        headers=_auth(_token(superadmin)),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "ADMIN"


async def test_last_superadmin_guard(db_session):
    """Defense-in-depth: the guard refuses to drop the last active superadmin (service level).

    The self-protection guard already blocks the only reachable API path (a lone superadmin acting
    on itself), so the last-superadmin rail is exercised directly here.
    """
    from app.common.exception.errors import ConflictError
    from app.modules.iam import admin_service

    sole = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)
    actor = await _make_user(db_session, "ghost@epn.edu.ec", UserRole.SUPER_ADMIN)
    # Only `sole` remains active, so removing its superadmin role would leave zero.
    actor.status = UserStatus.SUSPENDED
    await db_session.flush()

    with pytest.raises(ConflictError):
        await admin_service.update_role(db_session, actor, sole.id, UserRole.ADMIN)
    with pytest.raises(ConflictError):
        await admin_service.delete_user(db_session, actor, sole.id)


async def test_suspend_and_soft_delete(client, db_session):
    superadmin = await _make_user(db_session, "root@epn.edu.ec", UserRole.SUPER_ADMIN)
    admin = await _make_user(db_session, "a@epn.edu.ec", UserRole.ADMIN)
    token = _token(superadmin)

    suspend = await client.patch(
        f"/api/v1/admin/users/{admin.id}/status",
        json={"status": "SUSPENDED"},
        headers=_auth(token),
    )
    assert suspend.status_code == 200
    assert suspend.json()["status"] == "SUSPENDED"

    deleted = await client.delete(f"/api/v1/admin/users/{admin.id}", headers=_auth(token))
    assert deleted.status_code == 200

    # Soft delete: row still exists with status DELETED (refresh past this session's cache).
    await db_session.refresh(admin)
    assert admin.status == UserStatus.DELETED

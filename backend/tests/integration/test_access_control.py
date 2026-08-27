"""Access-control regressions.

Every test here encodes a hole that was actually open at some point. They are deliberately blunt:
they assert on status codes and on the absence of leaked fields, not on internal call paths, so
they keep working if the implementation is rewritten.
"""

from __future__ import annotations

import pytest

from app.common.enums import UserRole, UserStatus
from app.common.security.jwt import create_access_token
from tests.factories import (
    API,
    auth,
    create_scheme,
    enroll,
    make_user,
    make_user_row,
    scheme_payload,
    seed_malla,
    student_on,
)

pytestmark = pytest.mark.asyncio


# --- Private evaluation schemes ----------------------------------------------------------------


async def test_anonymous_cannot_read_a_private_scheme(client, db_session):
    """The critical finding: a PRIVATE scheme was readable with no token at all."""
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    owner = await student_on(client, db_session, "owner@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(client, owner, course_id, visibility="PRIVATE")

    detail = await client.get(f"{API}/evaluation-schemes/{scheme_id}")
    assert detail.status_code == 401

    listing = await client.get(f"{API}/evaluation-schemes", params={"course_id": course_id})
    assert listing.status_code == 401


async def test_another_student_cannot_read_a_private_scheme(client, db_session):
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    owner = await student_on(client, db_session, "owner2@epn.edu.ec", malla["curriculum_id"])
    intruder = await student_on(client, db_session, "intruder@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(
        client, owner, course_id, visibility="PRIVATE", title="Mi esquema privado"
    )

    detail = await client.get(f"{API}/evaluation-schemes/{scheme_id}", headers=auth(intruder))
    # 404, not 403: the endpoint must not confirm that the id exists.
    assert detail.status_code == 404

    listing = await client.get(
        f"{API}/evaluation-schemes", params={"course_id": course_id}, headers=auth(intruder)
    )
    assert listing.status_code == 200
    assert [s for s in listing.json() if s["id"] == scheme_id] == []


async def test_owner_still_sees_their_own_private_scheme(client, db_session):
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    owner = await student_on(client, db_session, "owner3@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(client, owner, course_id, visibility="PRIVATE")

    detail = await client.get(f"{API}/evaluation-schemes/{scheme_id}", headers=auth(owner))
    assert detail.status_code == 200

    listing = await client.get(
        f"{API}/evaluation-schemes", params={"course_id": course_id}, headers=auth(owner)
    )
    assert [s["id"] for s in listing.json()] == [scheme_id]


async def test_private_scheme_cannot_be_copied_by_a_stranger(client, db_session):
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    owner = await student_on(client, db_session, "owner4@epn.edu.ec", malla["curriculum_id"])
    intruder = await student_on(client, db_session, "intruder2@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(client, owner, course_id, visibility="PRIVATE")

    resp = await client.post(
        f"{API}/evaluation-schemes/{scheme_id}/copy-to-personal", headers=auth(intruder)
    )
    assert resp.status_code == 404


async def test_private_scheme_cannot_be_used_to_seed_a_gradebook(client, db_session):
    """Enrolling on someone else's private scheme would expose its components."""
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    curriculum_course_id = malla["courses"][0]["id"]
    owner = await student_on(client, db_session, "owner5@epn.edu.ec", malla["curriculum_id"])
    intruder = await student_on(client, db_session, "intruder3@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(client, owner, course_id, visibility="PRIVATE")

    resp = await client.post(
        f"{API}/student/enrollments",
        json={
            "curriculum_course_id": curriculum_course_id,
            "evaluation_scheme_id": scheme_id,
        },
        headers=auth(intruder),
    )
    assert resp.status_code == 404


async def test_admins_can_see_private_schemes_for_moderation(client, db_session):
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    owner = await student_on(client, db_session, "owner6@epn.edu.ec", malla["curriculum_id"])
    admin = await make_user(db_session, "mod@epn.edu.ec", role=UserRole.ADMIN)
    scheme_id = await create_scheme(client, owner, course_id, visibility="PRIVATE")

    detail = await client.get(f"{API}/evaluation-schemes/{scheme_id}", headers=auth(admin))
    assert detail.status_code == 200


# --- Enrollment ownership ----------------------------------------------------------------------


async def test_a_student_cannot_touch_another_students_gradebook(client, db_session):
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    owner = await student_on(client, db_session, "grades@epn.edu.ec", malla["curriculum_id"])
    intruder = await student_on(client, db_session, "peeker@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(client, owner, course_id)
    enrollment_id = await enroll(client, owner, malla["courses"][0]["id"], scheme_id)

    for method, path in (
        ("get", f"{API}/student/enrollments/{enrollment_id}/gradebook"),
        ("get", f"{API}/student/enrollments/{enrollment_id}/calculate"),
        ("get", f"{API}/student/enrollments/{enrollment_id}/projection"),
    ):
        resp = await getattr(client, method)(path, headers=auth(intruder))
        assert resp.status_code == 403, f"{path} leaked to another student"

    deleted = await client.delete(
        f"{API}/student/enrollments/{enrollment_id}", headers=auth(intruder)
    )
    assert deleted.status_code == 403


async def test_enrolling_on_a_course_outside_your_malla_is_rejected(client, db_session):
    malla = await seed_malla(client, db_session)
    course_id = malla["courses"][0]["course_id"]
    # A student with no curriculum selected at all.
    stranger = await make_user(db_session, "nomalla@epn.edu.ec")
    scheme_id = await create_scheme(client, stranger, course_id)

    resp = await client.post(
        f"{API}/student/enrollments",
        json={
            "curriculum_course_id": malla["courses"][0]["id"],
            "evaluation_scheme_id": scheme_id,
        },
        headers=auth(stranger),
    )
    assert resp.status_code == 404


async def test_the_same_course_cannot_be_enrolled_twice(client, db_session):
    malla = await seed_malla(client, db_session)
    student = await student_on(client, db_session, "dup@epn.edu.ec", malla["curriculum_id"])
    scheme_id = await create_scheme(client, student, malla["courses"][0]["course_id"])
    await enroll(client, student, malla["courses"][0]["id"], scheme_id)

    again = await client.post(
        f"{API}/student/enrollments",
        json={
            "curriculum_course_id": malla["courses"][0]["id"],
            "evaluation_scheme_id": scheme_id,
        },
        headers=auth(student),
    )
    assert again.status_code == 409


# --- Unknown foreign keys are 404, never 500 ---------------------------------------------------


async def test_unknown_course_id_on_scheme_creation_is_a_404(client, db_session):
    student = await make_user(db_session, "fk@epn.edu.ec")
    resp = await client.post(
        f"{API}/evaluation-schemes",
        json=scheme_payload("00000000-0000-0000-0000-000000000000"),
        headers=auth(student),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


# --- Session lifecycle -------------------------------------------------------------------------


async def test_suspending_a_user_stops_their_refresh_tokens(client, db_session):
    """A suspended account must not be able to mint new tokens."""
    password = "Sufficiently-long-pass-1"
    user = await make_user_row(db_session, "victim@epn.edu.ec", password=password)
    superadmin = await make_user(db_session, "root@epn.edu.ec", role=UserRole.SUPER_ADMIN)

    login = await client.post(
        f"{API}/auth/login", json={"email": user.email, "password": password}
    )
    assert login.status_code == 200, login.text
    refresh_token = login.json()["refresh_token"]

    suspended = await client.patch(
        f"{API}/admin/users/{user.id}/status",
        json={"status": UserStatus.SUSPENDED.value},
        headers=auth(superadmin),
    )
    assert suspended.status_code == 200, suspended.text

    refreshed = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 401


async def test_a_suspended_user_cannot_log_in(client, db_session):
    password = "Sufficiently-long-pass-2"
    user = await make_user_row(db_session, "blocked@epn.edu.ec", password=password)
    user.status = UserStatus.SUSPENDED
    await db_session.commit()

    resp = await client.post(
        f"{API}/auth/login", json={"email": user.email, "password": password}
    )
    assert resp.status_code == 401
    # The message must not distinguish "suspended" from "wrong password".
    assert resp.json()["error"]["message"] == "Credenciales inválidas."


async def test_changing_the_password_revokes_existing_sessions(client, db_session, fake_redis):
    password = "Sufficiently-long-pass-3"
    user = await make_user_row(db_session, "reset@epn.edu.ec", password=password)

    login = await client.post(
        f"{API}/auth/login", json={"email": user.email, "password": password}
    )
    old_refresh = login.json()["refresh_token"]

    # Drive the real reset path: request a code, read it from Redis, verify with a new password.
    requested = await client.post(
        f"{API}/auth/register/request-code", json={"email": user.email}
    )
    assert requested.status_code == 200, requested.text
    code = await fake_redis.get(f"verify:code:{user.email}")

    reset = await client.post(
        f"{API}/auth/register/verify-code",
        json={"email": user.email, "code": code, "password": "A-brand-new-password-9"},
    )
    assert reset.status_code == 200, reset.text

    stale = await client.post(f"{API}/auth/refresh", json={"refresh_token": old_refresh})
    assert stale.status_code == 401


# --- Header hardening --------------------------------------------------------------------------


async def test_security_headers_are_present(client):
    resp = await client.get(f"{API}/health")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in resp.headers


async def test_a_forged_request_id_is_replaced(client):
    """The value is echoed into logs and headers, so newlines must never survive."""
    resp = await client.get(
        f"{API}/health", headers={"X-Request-ID": "abc\r\nX-Injected: evil"}
    )
    assert "\n" not in resp.headers["X-Request-ID"]
    assert resp.headers["X-Request-ID"] != "abc\r\nX-Injected: evil"
    assert "X-Injected" not in resp.headers


async def test_a_well_formed_request_id_is_preserved(client):
    resp = await client.get(f"{API}/health", headers={"X-Request-ID": "trace-abc123"})
    assert resp.headers["X-Request-ID"] == "trace-abc123"


# --- Admin surface -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", f"{API}/admin/users"),
        ("get", f"{API}/admin/resources"),
    ],
)
async def test_admin_endpoints_reject_students(client, db_session, method, path):
    student = await make_user(db_session, f"nosy-{path.count('/')}@epn.edu.ec")
    resp = await getattr(client, method)(path, headers=auth(student))
    assert resp.status_code == 403


async def test_superadmin_cannot_demote_themselves(client, db_session):
    """Self-service demotion is how an admin console locks itself out."""
    root = await make_user_row(db_session, "root2@epn.edu.ec", role=UserRole.SUPER_ADMIN)
    # A second superadmin exists, so the last-superadmin rule is not what does the blocking here.
    await make_user_row(db_session, "root3@epn.edu.ec", role=UserRole.SUPER_ADMIN)
    own_token = create_access_token(str(root.id), role=UserRole.SUPER_ADMIN.value)

    resp = await client.patch(
        f"{API}/admin/users/{root.id}/role",
        json={"role": UserRole.STUDENT.value},
        headers=auth(own_token),
    )
    assert resp.status_code == 403


async def test_the_last_active_superadmin_cannot_be_demoted(client, db_session):
    keeper = await make_user_row(db_session, "keeper@epn.edu.ec", role=UserRole.SUPER_ADMIN)
    spare = await make_user_row(db_session, "spare@epn.edu.ec", role=UserRole.SUPER_ADMIN)
    keeper_token = create_access_token(str(keeper.id), role=UserRole.SUPER_ADMIN.value)
    spare_token = create_access_token(str(spare.id), role=UserRole.SUPER_ADMIN.value)

    # Two superadmins exist, so demoting one is fine.
    demote_spare = await client.patch(
        f"{API}/admin/users/{spare.id}/role",
        json={"role": UserRole.STUDENT.value},
        headers=auth(keeper_token),
    )
    assert demote_spare.status_code == 200, demote_spare.text

    # `keeper` is now the only one left, so `spare` (were they still able to act) must not
    # be able to demote them. Re-promote `spare` and have them try.
    await client.patch(
        f"{API}/admin/users/{spare.id}/role",
        json={"role": UserRole.SUPER_ADMIN.value},
        headers=auth(keeper_token),
    )
    demote_keeper = await client.patch(
        f"{API}/admin/users/{keeper.id}/role",
        json={"role": UserRole.STUDENT.value},
        headers=auth(spare_token),
    )
    assert demote_keeper.status_code == 200, "two superadmins exist, so this one is allowed"

    # Only `spare` is left now: demoting them must be refused.
    last_one = await client.patch(
        f"{API}/admin/users/{spare.id}/role",
        json={"role": UserRole.STUDENT.value},
        headers=auth(keeper_token),
    )
    assert last_one.status_code == 403, "a demoted superadmin should not be able to act"

"""Admin direct editing of courses, mallas and requirements (ERS §17.3): guards + audit."""

import pytest
from sqlalchemy import func, select

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.audit.model import AuditLog
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio


def _course(code, name, term, credits, requirements=None):
    return {
        "code": code, "name": name, "credits": credits, "hours": 144,
        "reference_term": term, "organization_unit": "PROFESSIONAL",
        "requirements": requirements or [],
    }


_MALLA = {
    "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
    "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
    "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
    "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "6", "total_hours": 0},
    "courses": [
        _course("ICCD144", "Programación I", 1, "3"),
        _course("ICCD244", "Programación II", 2, "3"),
    ],
    "graduation_requirements": [],
}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _make_token(db_session, email, role) -> str:
    user = User(email=email, role=role)
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=role.value)


async def _seed(client, db_session):
    admin = await _make_token(db_session, "admin@epn.edu.ec", UserRole.ADMIN)
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(admin)
    )
    assert resp.status_code == 200, resp.text
    curriculum_id = resp.json()["curriculum_id"]
    courses = (await client.get(f"/api/v1/curricula/{curriculum_id}/courses")).json()
    return admin, curriculum_id, {c["code"]: c for c in courses}


async def test_student_cannot_edit(client, db_session):
    _, _, by_code = await _seed(client, db_session)
    student = await _make_token(db_session, "s@epn.edu.ec", UserRole.STUDENT)
    resp = await client.patch(
        f"/api/v1/admin/curriculum-courses/{by_code['ICCD244']['id']}",
        json={"credits": "4"},
        headers=_auth(student),
    )
    assert resp.status_code == 403


async def test_admin_edits_curriculum_course_and_it_is_audited(client, db_session):
    admin, _, by_code = await _seed(client, db_session)
    resp = await client.patch(
        f"/api/v1/admin/curriculum-courses/{by_code['ICCD244']['id']}",
        json={"credits": "5", "reference_term": 3},
        headers=_auth(admin),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    from decimal import Decimal

    assert Decimal(body["credits"]) == 5
    assert body["reference_term"] == 3

    count = (
        await db_session.execute(
            select(func.count(AuditLog.id)).where(AuditLog.action == "CURRICULUM_COURSE_UPDATE")
        )
    ).scalar_one()
    assert count == 1


async def test_admin_adds_and_removes_prerequisite(client, db_session):
    admin, curriculum_id, by_code = await _seed(client, db_session)
    add = await client.post(
        "/api/v1/admin/course-requirements",
        json={
            "curriculum_course_id": by_code["ICCD244"]["id"],
            "required_curriculum_course_id": by_code["ICCD144"]["id"],
            "requirement_type": "PREREQUISITE",
        },
        headers=_auth(admin),
    )
    assert add.status_code == 200, add.text
    req_id = add.json()["id"]

    courses = (await client.get(f"/api/v1/curricula/{curriculum_id}/courses")).json()
    iccd244 = next(c for c in courses if c["code"] == "ICCD244")
    assert "ICCD144" in iccd244["prerequisite_codes"]

    # The requirements-with-ids endpoint powers the malla's remove-prereq UI.
    details = await client.get(
        f"/api/v1/admin/curriculum-courses/{by_code['ICCD244']['id']}/requirements",
        headers=_auth(admin),
    )
    assert details.status_code == 200
    assert details.json() == [
        {
            "id": req_id,
            "required_curriculum_course_id": by_code["ICCD144"]["id"],
            "required_code": "ICCD144",
            "requirement_type": "PREREQUISITE",
        }
    ]

    # Duplicate is rejected.
    dup = await client.post(
        "/api/v1/admin/course-requirements",
        json={
            "curriculum_course_id": by_code["ICCD244"]["id"],
            "required_curriculum_course_id": by_code["ICCD144"]["id"],
            "requirement_type": "PREREQUISITE",
        },
        headers=_auth(admin),
    )
    assert dup.status_code == 409

    removed = await client.delete(
        f"/api/v1/admin/course-requirements/{req_id}", headers=_auth(admin)
    )
    assert removed.status_code == 200


async def test_self_requirement_rejected(client, db_session):
    admin, _, by_code = await _seed(client, db_session)
    resp = await client.post(
        "/api/v1/admin/course-requirements",
        json={
            "curriculum_course_id": by_code["ICCD244"]["id"],
            "required_curriculum_course_id": by_code["ICCD244"]["id"],
            "requirement_type": "PREREQUISITE",
        },
        headers=_auth(admin),
    )
    assert resp.status_code == 422

"""End-to-end tests for professors and course offerings admin (ERS §12.10-12.13)."""

import pytest

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio

_MALLA = {
    "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
    "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
    "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
    "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "3", "total_hours": 144},
    "courses": [
        {
            "code": "ICCD523",
            "name": "Inteligencia Artificial",
            "credits": "3",
            "hours": 144,
            "reference_term": 5,
            "organization_unit": "PROFESSIONAL",
            "requirements": [],
        }
    ],
    "graduation_requirements": [],
}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _admin_token(db_session, email="admin@epn.edu.ec") -> str:
    user = User(email=email, role=UserRole.ADMIN)
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=UserRole.ADMIN.value)


async def _seed_catalog(client, token):
    """Import a malla and return (institution_id, course_id, curriculum_id)."""
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    curriculum_id = resp.json()["curriculum_id"]
    institution_id = (await client.get("/api/v1/institutions")).json()[0]["id"]
    courses = (await client.get(f"/api/v1/curricula/{curriculum_id}/courses")).json()
    return institution_id, courses[0]["course_id"], curriculum_id


async def test_professor_create_and_search(client, db_session):
    token = await _admin_token(db_session)
    institution_id, _, _ = await _seed_catalog(client, token)

    created = await client.post(
        "/api/v1/admin/professors",
        json={"institution_id": institution_id, "full_name": "Ada Lovelace",
              "email": "ada@epn.edu.ec"},
        headers=_auth(token),
    )
    assert created.status_code == 200, created.text

    found = await client.get("/api/v1/professors/search?q=lovelace")
    assert found.status_code == 200
    names = [p["full_name"] for p in found.json()]
    assert "Ada Lovelace" in names


async def test_create_course_offering(client, db_session):
    token = await _admin_token(db_session)
    institution_id, course_id, curriculum_id = await _seed_catalog(client, token)

    period = await client.post(
        "/api/v1/admin/academic-periods",
        json={"institution_id": institution_id, "code": "2026-A", "name": "Periodo 2026-A"},
        headers=_auth(token),
    )
    assert period.status_code == 200, period.text
    period_id = period.json()["id"]

    offering = await client.post(
        "/api/v1/admin/course-offerings",
        json={"course_id": course_id, "academic_period_id": period_id,
              "curriculum_id": curriculum_id},
        headers=_auth(token),
    )
    assert offering.status_code == 200, offering.text
    offering_id = offering.json()["id"]

    listed = await client.get(f"/api/v1/course-offerings?period_id={period_id}")
    assert listed.status_code == 200
    assert any(o["id"] == offering_id for o in listed.json())


async def test_offering_create_requires_admin(client, db_session):
    admin = await _admin_token(db_session)
    institution_id, _, _ = await _seed_catalog(client, admin)

    student = User(email="student@epn.edu.ec", role=UserRole.STUDENT)
    db_session.add(student)
    await db_session.commit()
    token = create_access_token(str(student.id), role=UserRole.STUDENT.value)

    resp = await client.post(
        "/api/v1/admin/professors",
        json={"institution_id": institution_id, "full_name": "Grace Hopper"},
        headers=_auth(token),
    )
    assert resp.status_code == 403

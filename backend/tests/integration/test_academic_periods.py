"""End-to-end tests for academic periods admin CRUD (ERS §12.9)."""

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


async def _institution_id(client, admin_token) -> str:
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(admin_token)
    )
    assert resp.status_code == 200, resp.text
    institutions = (await client.get("/api/v1/institutions")).json()
    return institutions[0]["id"]


async def test_create_and_list_academic_period(client, db_session):
    token = await _admin_token(db_session)
    institution_id = await _institution_id(client, token)

    created = await client.post(
        "/api/v1/admin/academic-periods",
        json={"institution_id": institution_id, "code": "2026-A", "name": "Periodo 2026-A",
              "is_current": True},
        headers=_auth(token),
    )
    assert created.status_code == 200, created.text
    assert created.json()["code"] == "2026-A"
    assert created.json()["is_current"] is True

    listed = await client.get("/api/v1/academic-periods")
    assert listed.status_code == 200
    codes = [p["code"] for p in listed.json()]
    assert "2026-A" in codes


async def test_duplicate_period_code_conflicts(client, db_session):
    token = await _admin_token(db_session)
    institution_id = await _institution_id(client, token)
    body = {"institution_id": institution_id, "code": "2026-B", "name": "Periodo 2026-B"}

    first = await client.post("/api/v1/admin/academic-periods", json=body, headers=_auth(token))
    assert first.status_code == 200
    second = await client.post("/api/v1/admin/academic-periods", json=body, headers=_auth(token))
    assert second.status_code == 409


async def test_create_period_requires_admin(client, db_session):
    admin = await _admin_token(db_session)
    institution_id = await _institution_id(client, admin)

    student = User(email="student@epn.edu.ec", role=UserRole.STUDENT)
    db_session.add(student)
    await db_session.commit()
    token = create_access_token(str(student.id), role=UserRole.STUDENT.value)

    resp = await client.post(
        "/api/v1/admin/academic-periods",
        json={"institution_id": institution_id, "code": "2026-C", "name": "Periodo 2026-C"},
        headers=_auth(token),
    )
    assert resp.status_code == 403

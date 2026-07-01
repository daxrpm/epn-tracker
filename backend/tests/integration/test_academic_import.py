"""End-to-end tests for curriculum import and catalog reads (ERS §14, §RF-016)."""

import pytest

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio


def _malla(total_credits="6"):
    return {
        "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
        "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
        "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
        "curriculum": {
            "pensum_year": 2020,
            "total_terms": 9,
            "total_credits": total_credits,
            "total_hours": 288,
            "total_courses_reported": 2,
        },
        "courses": [
            {
                "code": "ICCD442",
                "name": "Estructura de Datos y Algoritmos II",
                "credits": "3",
                "hours": 144,
                "reference_term": 4,
                "organization_unit": "PROFESSIONAL",
                "requirements": [],
            },
            {
                "code": "ICCD523",
                "name": "Inteligencia Artificial",
                "credits": "3",
                "hours": 144,
                "reference_term": 5,
                "organization_unit": "PROFESSIONAL",
                "requirements": [{"type": "PREREQUISITE", "course_code": "ICCD442"}],
            },
        ],
        "graduation_requirements": [
            {"code": "IEXD200", "name": "Suficiencia B1 inglés", "type": "ENGLISH"}
        ],
    }


async def _admin_token(db_session) -> str:
    user = User(email="admin@epn.edu.ec", role=UserRole.ADMIN)
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=UserRole.ADMIN.value)


async def test_validate_detects_missing_prerequisite(client, db_session):
    token = await _admin_token(db_session)
    payload = _malla()
    payload["courses"][1]["requirements"] = [{"type": "PREREQUISITE", "course_code": "NOPE"}]
    resp = await client.post(
        "/api/v1/admin/curricula/import/validate",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is False
    assert any("NOPE" in e["message"] for e in body["errors"])


async def test_credit_mismatch_is_error(client, db_session):
    token = await _admin_token(db_session)
    resp = await client.post(
        "/api/v1/admin/curricula/import/validate",
        json=_malla(total_credits="99"),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.json()["valid"] is False


async def test_commit_and_read_back(client, db_session):
    token = await _admin_token(db_session)
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit",
        json=_malla(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    curriculum_id = resp.json()["curriculum_id"]

    courses = await client.get(f"/api/v1/curricula/{curriculum_id}/courses")
    assert courses.status_code == 200
    data = courses.json()
    assert len(data) == 2
    ia = next(c for c in data if c["code"] == "ICCD523")
    assert ia["prerequisite_codes"] == ["ICCD442"]


async def test_import_requires_admin(client, db_session):
    # A student token must be forbidden.
    student = User(email="s@epn.edu.ec", role=UserRole.STUDENT)
    db_session.add(student)
    await db_session.commit()
    token = create_access_token(str(student.id), role=UserRole.STUDENT.value)
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit",
        json=_malla(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403

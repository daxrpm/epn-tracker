"""End-to-end tests for malla progress and graduation-requirement provisioning (ERS §RF-020)."""

import pytest

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio

_MALLA = {
    "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
    "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
    "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
    "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "6", "total_hours": 288},
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
            "requirements": [],
        },
    ],
    "graduation_requirements": [
        {"code": "IEXD200", "name": "Suficiencia B1 inglés", "type": "ENGLISH"}
    ],
}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _make_user(db_session, email, role=UserRole.STUDENT) -> str:
    user = User(email=email, role=role)
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=role.value)


async def _seed_malla(client, db_session):
    admin = await _make_user(db_session, "admin@epn.edu.ec", role=UserRole.ADMIN)
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(admin)
    )
    assert resp.status_code == 200, resp.text
    curriculum_id = resp.json()["curriculum_id"]
    courses = (await client.get(f"/api/v1/curricula/{curriculum_id}/courses")).json()
    return curriculum_id, courses


async def test_progress_after_passing_a_course(client, db_session):
    curriculum_id, courses = await _seed_malla(client, db_session)
    student = await _make_user(db_session, "student@epn.edu.ec")

    profile = await client.put(
        "/api/v1/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=_auth(student),
    )
    assert profile.status_code == 200, profile.text

    passed_cc = courses[0]["id"]
    bulk = await client.put(
        "/api/v1/student/course-states/bulk",
        json={"items": [{"curriculum_course_id": passed_cc, "state": "PASSED"}]},
        headers=_auth(student),
    )
    assert bulk.status_code == 200, bulk.text

    progress = await client.get("/api/v1/student/progress", headers=_auth(student))
    assert progress.status_code == 200, progress.text
    body = progress.json()
    assert body["total_credits"] == "6.00"
    assert body["approved_credits"] == "3.00"
    assert body["percent"] == "50.00"
    assert body["counts_by_state"]["PASSED"] == 1
    assert body["counts_by_state"]["NOT_TAKEN"] == 1
    assert len(body["by_term"]) == 2


async def test_setting_curriculum_seeds_graduation_requirements(client, db_session):
    curriculum_id, _ = await _seed_malla(client, db_session)
    student = await _make_user(db_session, "student2@epn.edu.ec")

    # Before setting the curriculum there are no graduation-requirement states.
    empty = await client.get("/api/v1/student/graduation-requirements", headers=_auth(student))
    assert empty.status_code == 200
    assert empty.json() == []

    profile = await client.put(
        "/api/v1/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=_auth(student),
    )
    assert profile.status_code == 200, profile.text

    seeded = await client.get("/api/v1/student/graduation-requirements", headers=_auth(student))
    assert seeded.status_code == 200
    assert len(seeded.json()) == 1

    # Idempotent: setting it again does not duplicate.
    await client.put(
        "/api/v1/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=_auth(student),
    )
    again = await client.get("/api/v1/student/graduation-requirements", headers=_auth(student))
    assert len(again.json()) == 1


async def test_updating_a_graduation_requirement_returns_full_details(client, db_session):
    curriculum_id, _ = await _seed_malla(client, db_session)
    student = await _make_user(db_session, "student3@epn.edu.ec")
    await client.put(
        "/api/v1/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=_auth(student),
    )

    listed = await client.get("/api/v1/student/graduation-requirements", headers=_auth(student))
    state_id = listed.json()[0]["id"]

    updated = await client.put(
        f"/api/v1/student/graduation-requirements/{state_id}",
        json={"state": "COMPLETED"},
        headers=_auth(student),
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["state"] == "COMPLETED"
    # code/name/type come from the joined requirement (regression: used to 500).
    assert body["code"] == "IEXD200"
    assert body["name"] == "Suficiencia B1 inglés"
    assert body["requirement_type"] == "ENGLISH"

    # Completing the ENGLISH requirement syncs the profile's sufficiency flag, since that's what
    # the simulator's credit-limit rule actually reads (ERS §8.18) — not the requirement state.
    profile = await client.get("/api/v1/student/profile", headers=_auth(student))
    assert profile.json()["english_sufficiency"] is True
    assert profile.json()["english_level"] == "SUFFICIENCY_B1"


async def test_course_states_reject_more_than_15_in_progress_credits(client, db_session):
    malla = {
        **_MALLA,
        "career": {"name": "Sistemas", "degree_title": "Ingeniero/a en Sistemas"},
        "curriculum": {
            "pensum_year": 2026,
            "total_terms": 1,
            "total_credits": "18",
            "total_hours": 0,
        },
        "courses": [
            {
                "code": f"ONB10{index}",
                "name": f"Materia {index}",
                "credits": "3",
                "hours": 0,
                "reference_term": 1,
                "organization_unit": "PROFESSIONAL",
                "requirements": [],
            }
            for index in range(6)
        ],
        "graduation_requirements": [],
    }
    admin = await _make_user(db_session, "admin-limit@epn.edu.ec", role=UserRole.ADMIN)
    imported = await client.post(
        "/api/v1/admin/curricula/import/commit", json=malla, headers=_auth(admin)
    )
    assert imported.status_code == 200, imported.text
    curriculum_id = imported.json()["curriculum_id"]
    courses = (await client.get(f"/api/v1/curricula/{curriculum_id}/courses")).json()
    student = await _make_user(db_session, "student-limit@epn.edu.ec")
    await client.put(
        "/api/v1/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=_auth(student),
    )

    response = await client.put(
        "/api/v1/student/course-states/bulk",
        json={
            "items": [
                {"curriculum_course_id": course["id"], "state": "IN_PROGRESS"} for course in courses
            ]
        },
        headers=_auth(student),
    )

    assert response.status_code == 422
    assert "15 créditos" in response.text

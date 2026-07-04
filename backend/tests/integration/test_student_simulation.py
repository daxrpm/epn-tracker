"""End-to-end tests for the authenticated student simulator (ERS §8.22, §17.10, CU-007).

The scenario is seeded from the student's saved course states; ``assumptions`` project outcomes for
courses in progress. Saved scenarios are persisted through the ``Simulation`` model.
"""

import pytest

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio


def _course(code, name, term, credits, requirements=None):
    return {
        "code": code,
        "name": name,
        "credits": credits,
        "hours": 144,
        "reference_term": term,
        "organization_unit": "PROFESSIONAL",
        "requirements": requirements or [],
    }


_MALLA = {
    "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
    "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
    "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
    "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "9", "total_hours": 0},
    "courses": [
        _course("MAT100", "Cálculo", 1, "3"),
        _course("ICCD442", "Estructuras II", 4, "3"),
        _course(
            "ICCD523",
            "Inteligencia Artificial",
            5,
            "3",
            [{"type": "PREREQUISITE", "course_code": "ICCD442"}],
        ),
    ],
    "graduation_requirements": [],
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
    by_code = {c["code"]: c for c in courses}
    return curriculum_id, by_code


async def _register_student(client, db_session, curriculum_id, email="student@epn.edu.ec"):
    token = await _make_user(db_session, email)
    profile = await client.put(
        "/api/v1/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=_auth(token),
    )
    assert profile.status_code == 200, profile.text
    return token


async def test_failed_assumption_triggers_repetition_limit_and_blocks_prereq(client, db_session):
    curriculum_id, by_code = await _seed_malla(client, db_session)
    token = await _register_student(client, db_session, curriculum_id)

    # MAT100 is currently in progress.
    await client.put(
        "/api/v1/student/course-states/bulk",
        json={"items": [{"curriculum_course_id": by_code["MAT100"]["id"], "state": "IN_PROGRESS"}]},
        headers=_auth(token),
    )

    # The student projects failing MAT100 → repetition limit drops the max to 12.
    assumptions = [{"curriculum_course_id": by_code["MAT100"]["id"], "state": "FAILED"}]
    resp = await client.post(
        "/api/v1/student/simulations/run",
        json={"assumptions": assumptions},
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["max_credits"] == "12"
    assert any(r["code"] == "REPETITION_LIMIT_12" for r in body["restriction_reasons"])

    # ICCD523 is blocked because its prerequisite ICCD442 is not passed.
    blocked = {b["code"]: b for b in body["blocked_courses"]}
    assert "ICCD523" in blocked
    assert any(r["code"] == "MISSING_PREREQUISITE" for r in blocked["ICCD523"]["reasons"])
    # Eligible courses carry the curriculum_course_id + reference_term for the UI.
    eligible = {c["code"]: c for c in body["eligible_courses"]}
    assert "ICCD442" in eligible
    assert eligible["ICCD442"]["curriculum_course_id"] == by_code["ICCD442"]["id"]
    assert eligible["ICCD442"]["reference_term"] == 4


async def test_passing_prerequisite_makes_course_eligible(client, db_session):
    curriculum_id, by_code = await _seed_malla(client, db_session)
    token = await _register_student(client, db_session, curriculum_id, "s2@epn.edu.ec")

    await client.put(
        "/api/v1/student/course-states/bulk",
        json={"items": [{"curriculum_course_id": by_code["ICCD442"]["id"], "state": "PASSED"}]},
        headers=_auth(token),
    )
    resp = await client.post(
        "/api/v1/student/simulations/run", json={}, headers=_auth(token)
    )
    body = resp.json()
    eligible = {c["code"] for c in body["eligible_courses"]}
    assert "ICCD523" in eligible
    assert "ICCD442" not in eligible  # already passed


async def test_save_list_get_delete_scenario(client, db_session):
    curriculum_id, by_code = await _seed_malla(client, db_session)
    token = await _register_student(client, db_session, curriculum_id, "s3@epn.edu.ec")

    saved = await client.post(
        "/api/v1/student/simulations",
        json={
            "name": "Si paso todo",
            "selected_course_ids": [by_code["ICCD442"]["id"]],
        },
        headers=_auth(token),
    )
    assert saved.status_code == 200, saved.text
    saved_body = saved.json()
    simulation_id = saved_body["id"]
    assert saved_body["name"] == "Si paso todo"
    assert saved_body["result"]["selected_credits"] == "3.00"

    listed = await client.get("/api/v1/student/simulations", headers=_auth(token))
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == simulation_id
    assert items[0]["name"] == "Si paso todo"

    fetched = await client.get(
        f"/api/v1/student/simulations/{simulation_id}", headers=_auth(token)
    )
    assert fetched.status_code == 200
    assert fetched.json()["result"]["selected_credits"] == "3.00"

    deleted = await client.delete(
        f"/api/v1/student/simulations/{simulation_id}", headers=_auth(token)
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"deleted": True}

    empty = await client.get("/api/v1/student/simulations", headers=_auth(token))
    assert empty.json() == []


async def test_cannot_access_another_students_scenario(client, db_session):
    curriculum_id, by_code = await _seed_malla(client, db_session)
    owner = await _register_student(client, db_session, curriculum_id, "owner@epn.edu.ec")
    intruder = await _register_student(client, db_session, curriculum_id, "intruder@epn.edu.ec")

    saved = await client.post(
        "/api/v1/student/simulations",
        json={"name": "Escenario privado"},
        headers=_auth(owner),
    )
    simulation_id = saved.json()["id"]

    resp = await client.get(
        f"/api/v1/student/simulations/{simulation_id}", headers=_auth(intruder)
    )
    assert resp.status_code == 404

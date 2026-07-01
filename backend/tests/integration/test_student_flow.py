"""End-to-end tests for the gradebook flow (CU-003) and community voting (CA-006)."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio


async def _make_user(db_session, email, role=UserRole.STUDENT, verified=True) -> str:
    user = User(
        email=email,
        role=role,
        email_verified_at=datetime.now(UTC) if verified else None,
    )
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=role.value)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


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


def _four_component_scheme(course_id):
    return {
        "course_id": course_id,
        "title": "IA GR1CC 2026-A",
        "visibility": "COMMUNITY",
        "components": [
            {"contribution": "APORTE_1", "name": "Prueba", "weight_percent": "30",
             "evaluation_type": "SUMMATIVE"},
            {"contribution": "APORTE_1", "name": "Deberes", "weight_percent": "35",
             "evaluation_type": "FORMATIVE"},
            {"contribution": "APORTE_1", "name": "Proyecto", "weight_percent": "35",
             "evaluation_type": "FORMATIVE"},
            {"contribution": "APORTE_2", "name": "Prueba", "weight_percent": "30",
             "evaluation_type": "SUMMATIVE"},
            {"contribution": "APORTE_2", "name": "Deberes", "weight_percent": "35",
             "evaluation_type": "FORMATIVE"},
            {"contribution": "APORTE_2", "name": "Proyecto", "weight_percent": "35",
             "evaluation_type": "FORMATIVE"},
        ],
    }


async def _seed_course(client, db_session):
    admin = await _make_user(db_session, "admin@epn.edu.ec", role=UserRole.ADMIN)
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(admin)
    )
    assert resp.status_code == 200, resp.text
    curriculum_id = resp.json()["curriculum_id"]
    courses = (await client.get(f"/api/v1/curricula/{curriculum_id}/courses")).json()
    return courses[0]["course_id"], courses[0]["id"]


async def test_gradebook_calculate_flow(client, db_session):
    course_id, curriculum_course_id = await _seed_course(client, db_session)
    student = await _make_user(db_session, "student@epn.edu.ec")

    scheme = await client.post(
        "/api/v1/evaluation-schemes", json=_four_component_scheme(course_id), headers=_auth(student)
    )
    assert scheme.status_code == 200, scheme.text
    scheme_id = scheme.json()["id"]

    enrollment = await client.post(
        "/api/v1/student/enrollments",
        json={"curriculum_course_id": curriculum_course_id, "evaluation_scheme_id": scheme_id},
        headers=_auth(student),
    )
    assert enrollment.status_code == 200, enrollment.text
    enrollment_id = enrollment.json()["id"]

    gradebook = await client.get(
        f"/api/v1/student/enrollments/{enrollment_id}/gradebook", headers=_auth(student)
    )
    assert gradebook.status_code == 200
    components = gradebook.json()["components"]
    assert len(components) == 6

    # Enter every component as a direct score of 14/20 -> each contribution = 14 -> final 28.
    for component in components:
        resp = await client.patch(
            f"/api/v1/student/grade-components/{component['id']}",
            json={"mode": "DIRECT_SCORE", "direct_score": "14"},
            headers=_auth(student),
        )
        assert resp.status_code == 200

    result = await client.post(
        f"/api/v1/student/enrollments/{enrollment_id}/calculate", headers=_auth(student)
    )
    assert result.status_code == 200, result.text
    body = result.json()
    assert Decimal(body["final_40"]) == Decimal("28")
    assert body["display_final_20"] == "14.00"
    assert body["status"] == "APPROVED"
    assert body["is_complete"] is True


async def test_community_verification_at_three_votes(client, db_session):
    course_id, _ = await _seed_course(client, db_session)
    creator = await _make_user(db_session, "creator@epn.edu.ec")

    created = await client.post(
        "/api/v1/evaluation-schemes", json=_four_component_scheme(course_id), headers=_auth(creator)
    )
    scheme_id = created.json()["id"]
    assert created.json()["status"] == "COMMUNITY_PENDING"

    # The creator cannot vote their own scheme.
    self_vote = await client.post(
        f"/api/v1/evaluation-schemes/{scheme_id}/vote", json={}, headers=_auth(creator)
    )
    assert self_vote.status_code == 403

    statuses = []
    for i in range(3):
        voter = await _make_user(db_session, f"voter{i}@epn.edu.ec")
        resp = await client.post(
            f"/api/v1/evaluation-schemes/{scheme_id}/vote", json={}, headers=_auth(voter)
        )
        assert resp.status_code == 200
        statuses.append(resp.json()["status"])

    assert statuses[-1] == "COMMUNITY_VERIFIED"


async def test_duplicate_vote_rejected(client, db_session):
    course_id, _ = await _seed_course(client, db_session)
    creator = await _make_user(db_session, "c2@epn.edu.ec")
    scheme_id = (
        await client.post(
            "/api/v1/evaluation-schemes",
            json=_four_component_scheme(course_id),
            headers=_auth(creator),
        )
    ).json()["id"]

    voter = await _make_user(db_session, "v@epn.edu.ec")
    first = await client.post(
        f"/api/v1/evaluation-schemes/{scheme_id}/vote", json={}, headers=_auth(voter)
    )
    assert first.status_code == 200
    second = await client.post(
        f"/api/v1/evaluation-schemes/{scheme_id}/vote", json={}, headers=_auth(voter)
    )
    assert second.status_code == 409

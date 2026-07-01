"""End-to-end tests for the simulator endpoint (CA-008, CA-009)."""

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


# 15 courses of 3 credits = 45 total, enough to trigger the English limit at 45 approved credits.
_MALLA = {
    "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
    "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
    "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
    "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "51", "total_hours": 0},
    "courses": [_course(f"C{i:02d}", f"Course {i}", (i % 9) + 1, "3") for i in range(15)]
    + [
        _course("ICCD442", "Estructuras II", 4, "3"),
        _course(
            "ICCD523", "Inteligencia Artificial", 5, "3",
            [{"type": "PREREQUISITE", "course_code": "ICCD442"}],
        ),
    ],
    "graduation_requirements": [],
}


async def _seed(client, db_session):
    admin = User(email="admin@epn.edu.ec", role=UserRole.ADMIN)
    db_session.add(admin)
    await db_session.commit()
    token = create_access_token(str(admin.id), role=UserRole.ADMIN.value)
    resp = await client.post(
        "/api/v1/admin/curricula/import/commit",
        json=_MALLA,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["curriculum_id"]


async def test_ca_008_prerequisite_blocks(client, db_session):
    curriculum_id = await _seed(client, db_session)
    resp = await client.post(
        "/api/v1/public/simulations/basic",
        json={"curriculum_id": curriculum_id, "selected_course_codes": ["ICCD523"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    blocked = {b["code"]: b for b in body["blocked_courses"]}
    assert "ICCD523" in blocked
    assert any(r["code"] == "MISSING_PREREQUISITE" for r in blocked["ICCD523"]["reasons"])


async def test_prerequisite_passed_makes_eligible(client, db_session):
    curriculum_id = await _seed(client, db_session)
    resp = await client.post(
        "/api/v1/public/simulations/basic",
        json={"curriculum_id": curriculum_id, "passed_course_codes": ["ICCD442"]},
    )
    body = resp.json()
    eligible = {c["code"] for c in body["eligible_courses"]}
    assert "ICCD523" in eligible


async def test_ca_009_english_limit_at_45_credits(client, db_session):
    curriculum_id = await _seed(client, db_session)
    passed = [f"C{i:02d}" for i in range(15)]  # 15 * 3 = 45 approved credits
    resp = await client.post(
        "/api/v1/public/simulations/basic",
        json={
            "curriculum_id": curriculum_id,
            "passed_course_codes": passed,
            "english": {"level": "BASIC_2"},
        },
    )
    body = resp.json()
    assert body["max_credits"] == "12"
    assert any(r["code"] == "ENGLISH_LIMIT" for r in body["restriction_reasons"])

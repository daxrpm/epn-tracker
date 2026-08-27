"""Shared builders for integration tests.

Each test used to grow its own copy of "make a user, import a malla, create a scheme". Centralising
them keeps the tests about the behaviour under test instead of about setup, and means a contract
change (a new required field, a new visibility rule) is fixed in one place.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.common.security.password import hash_password
from app.modules.iam.model import User

API = "/api/v1"


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def make_user(
    db_session,
    email: str,
    *,
    role: UserRole = UserRole.STUDENT,
    verified: bool = True,
    password: str | None = None,
) -> str:
    """Persist a user and return an access token for them."""
    user = User(
        email=email,
        role=role,
        email_verified_at=datetime.now(UTC) if verified else None,
        password_hash=hash_password(password) if password else None,
    )
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=role.value)


async def make_user_row(db_session, email: str, **kwargs: Any) -> User:
    """Same as :func:`make_user` but returns the row, for tests that need the id."""
    user = User(
        email=email,
        role=kwargs.get("role", UserRole.STUDENT),
        email_verified_at=datetime.now(UTC) if kwargs.get("verified", True) else None,
        password_hash=hash_password(kwargs["password"]) if kwargs.get("password") else None,
    )
    db_session.add(user)
    await db_session.commit()
    return user


def malla_payload(*, courses: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """A minimal but valid curriculum import payload."""
    course_list = (
        courses if courses is not None else [_course("ICCD523", "Inteligencia Artificial")]
    )
    total_credits = sum(int(c["credits"]) for c in course_list)
    return {
        "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
        "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
        "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
        "curriculum": {
            "pensum_year": 2020,
            "total_terms": 9,
            "total_credits": str(total_credits),
            "total_hours": 144 * len(course_list),
        },
        "courses": course_list,
        "graduation_requirements": [],
    }


def _course(
    code: str,
    name: str,
    *,
    term: int = 5,
    credits: str = "3",
    requirements: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "name": name,
        "credits": credits,
        "hours": 144,
        "reference_term": term,
        "organization_unit": "PROFESSIONAL",
        "requirements": requirements or [],
    }


course = _course


async def seed_malla(client, db_session, *, courses: list[dict[str, Any]] | None = None) -> dict:
    """Import a curriculum as an admin and return its ids.

    Returns ``{"curriculum_id", "courses"}`` where ``courses`` is the API's malla listing, so a
    test can pick the ``course_id`` (catalog) or ``id`` (curriculum course) it needs.
    """
    admin = await make_user(db_session, "seed-admin@epn.edu.ec", role=UserRole.ADMIN)
    resp = await client.post(
        f"{API}/admin/curricula/import/commit",
        json=malla_payload(courses=courses),
        headers=auth(admin),
    )
    assert resp.status_code == 200, resp.text
    curriculum_id = resp.json()["curriculum_id"]
    listing = await client.get(f"{API}/curricula/{curriculum_id}/courses")
    assert listing.status_code == 200, listing.text
    return {"curriculum_id": curriculum_id, "courses": listing.json(), "admin": admin}


async def student_on(client, db_session, email: str, curriculum_id: str) -> str:
    """A verified student whose profile already points at ``curriculum_id``."""
    token = await make_user(db_session, email)
    resp = await client.put(
        f"{API}/student/profile",
        json={"current_curriculum_id": curriculum_id},
        headers=auth(token),
    )
    assert resp.status_code == 200, resp.text
    return token


def scheme_payload(
    course_id: str,
    *,
    title: str = "Curso de prueba",
    visibility: str = "COMMUNITY",
    weight: str = "25",
) -> dict[str, Any]:
    """A valid four-component-per-contribution scheme.

    Four components of 25% each per contribution: the regulation caps a single component at 35%,
    so a 50/50 split is not expressible (ERS §8.3).
    """
    components = [
        {
            "contribution": contribution,
            "name": name,
            "weight_percent": weight,
            "evaluation_type": kind,
        }
        for contribution in ("APORTE_1", "APORTE_2")
        for name, kind in (
            ("Deberes", "FORMATIVE"),
            ("Talleres", "FORMATIVE"),
            ("Prueba", "SUMMATIVE"),
            ("Examen", "SUMMATIVE"),
        )
    ]
    return {
        "course_id": course_id,
        "title": title,
        "visibility": visibility,
        "components": components,
    }


async def create_scheme(client, token: str, course_id: str, **kwargs: Any) -> str:
    resp = await client.post(
        f"{API}/evaluation-schemes", json=scheme_payload(course_id, **kwargs), headers=auth(token)
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


async def enroll(client, token: str, curriculum_course_id: str, scheme_id: str) -> str:
    resp = await client.post(
        f"{API}/student/enrollments",
        json={
            "curriculum_course_id": curriculum_course_id,
            "evaluation_scheme_id": scheme_id,
        },
        headers=auth(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


async def set_all_components(client, token: str, enrollment_id: str, score: str) -> None:
    """Give every component the same direct score, which makes both contributions complete."""
    gradebook = await client.get(
        f"{API}/student/enrollments/{enrollment_id}/gradebook", headers=auth(token)
    )
    assert gradebook.status_code == 200, gradebook.text
    for component in gradebook.json()["components"]:
        resp = await client.patch(
            f"{API}/student/grade-components/{component['id']}",
            json={"mode": "DIRECT_SCORE", "direct_score": score, "direct_score_scale": "20"},
            headers=auth(token),
        )
        assert resp.status_code == 200, resp.text


async def calculate(client, token: str, enrollment_id: str) -> dict:
    resp = await client.get(
        f"{API}/student/enrollments/{enrollment_id}/calculate", headers=auth(token)
    )
    assert resp.status_code == 200, resp.text
    return resp.json()

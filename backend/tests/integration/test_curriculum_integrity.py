"""Curriculum graph integrity and catalog search.

The visual malla editor creates a requirement with one click, for every student at once, so the
guards here are what stand between a misclick and a permanently unreachable course.
"""

from __future__ import annotations

import pytest

from app.common.enums import UserRole
from tests.factories import API, auth, course, make_user, seed_malla

pytestmark = pytest.mark.asyncio


async def _three_course_malla(client, db_session):
    return await seed_malla(
        client,
        db_session,
        courses=[
            course("MAT100", "Cálculo Diferencial", term=1),
            course("MAT200", "Cálculo Integral", term=2),
            course("MAT300", "Ecuaciones Diferenciales", term=3),
        ],
    )


def _by_code(malla: dict, code: str) -> str:
    return next(c["id"] for c in malla["courses"] if c["code"] == code)


async def _add_requirement(client, admin: str, target: str, required: str, kind="PREREQUISITE"):
    return await client.post(
        f"{API}/admin/course-requirements",
        json={
            "curriculum_course_id": target,
            "required_curriculum_course_id": required,
            "requirement_type": kind,
        },
        headers=auth(admin),
    )


# --- Cycle detection ----------------------------------------------------------------------------


async def test_a_direct_cycle_is_refused(client, db_session):
    malla = await _three_course_malla(client, db_session)
    admin = malla["admin"]
    first, second = _by_code(malla, "MAT100"), _by_code(malla, "MAT200")

    ok = await _add_requirement(client, admin, second, first)
    assert ok.status_code == 200, ok.text

    cycle = await _add_requirement(client, admin, first, second)
    assert cycle.status_code == 422
    assert "ciclo" in cycle.json()["error"]["message"]


async def test_a_transitive_cycle_is_refused(client, db_session):
    """A -> B -> C is fine; closing C -> A is not."""
    malla = await _three_course_malla(client, db_session)
    admin = malla["admin"]
    a, b, c = (_by_code(malla, code) for code in ("MAT100", "MAT200", "MAT300"))

    assert (await _add_requirement(client, admin, b, a)).status_code == 200
    assert (await _add_requirement(client, admin, c, b)).status_code == 200

    cycle = await _add_requirement(client, admin, a, c)
    assert cycle.status_code == 422


async def test_a_self_requirement_is_refused(client, db_session):
    malla = await _three_course_malla(client, db_session)
    only = _by_code(malla, "MAT100")

    resp = await _add_requirement(client, malla["admin"], only, only)
    assert resp.status_code == 422


async def test_a_diamond_is_allowed(client, db_session):
    """Two courses sharing a prerequisite is not a cycle and must keep working."""
    malla = await _three_course_malla(client, db_session)
    admin = malla["admin"]
    a, b, c = (_by_code(malla, code) for code in ("MAT100", "MAT200", "MAT300"))

    assert (await _add_requirement(client, admin, b, a)).status_code == 200
    assert (await _add_requirement(client, admin, c, a)).status_code == 200


async def test_requirements_across_different_mallas_are_refused(client, db_session):
    malla = await _three_course_malla(client, db_session)
    resp = await _add_requirement(
        client,
        malla["admin"],
        _by_code(malla, "MAT100"),
        "00000000-0000-0000-0000-000000000000",
    )
    assert resp.status_code == 404


async def test_a_duplicate_requirement_is_a_conflict(client, db_session):
    malla = await _three_course_malla(client, db_session)
    admin = malla["admin"]
    a, b = _by_code(malla, "MAT100"), _by_code(malla, "MAT200")

    assert (await _add_requirement(client, admin, b, a)).status_code == 200
    again = await _add_requirement(client, admin, b, a)
    assert again.status_code == 409


async def test_students_cannot_edit_the_malla_graph(client, db_session):
    malla = await _three_course_malla(client, db_session)
    student = await make_user(db_session, "notadmin@epn.edu.ec", role=UserRole.STUDENT)

    resp = await _add_requirement(
        client, student, _by_code(malla, "MAT200"), _by_code(malla, "MAT100")
    )
    assert resp.status_code == 403


# --- Catalog search -----------------------------------------------------------------------------


async def test_search_ignores_accents(client, db_session):
    """"Cálculo" must find the course stored with its accent-stripped normalised name."""
    await _three_course_malla(client, db_session)

    accented = await client.get(f"{API}/courses/search", params={"q": "Cálculo"})
    assert accented.status_code == 200, accented.text
    assert len(accented.json()) == 2

    plain = await client.get(f"{API}/courses/search", params={"q": "calculo"})
    assert [c["id"] for c in plain.json()] == [c["id"] for c in accented.json()]


async def test_search_ignores_case(client, db_session):
    await _three_course_malla(client, db_session)
    resp = await client.get(f"{API}/courses/search", params={"q": "ECUACIONES"})
    assert len(resp.json()) == 1


async def test_search_matches_the_course_code(client, db_session):
    await _three_course_malla(client, db_session)
    resp = await client.get(f"{API}/courses/search", params={"q": "mat30"})
    assert [c["code"] for c in resp.json()] == ["MAT300"]


async def test_a_wildcard_in_the_search_term_is_not_a_wildcard(client, db_session):
    """An unescaped `%` would turn any search into "match everything"."""
    await _three_course_malla(client, db_session)
    resp = await client.get(f"{API}/courses/search", params={"q": "%"})
    assert resp.json() == []


async def test_search_results_are_bounded(client, db_session):
    await _three_course_malla(client, db_session)
    resp = await client.get(f"{API}/courses/search", params={"q": "a", "limit": 2})
    assert len(resp.json()) <= 2

    too_many = await client.get(f"{API}/courses/search", params={"q": "a", "limit": 5000})
    assert too_many.status_code == 422

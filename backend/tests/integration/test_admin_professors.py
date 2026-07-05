"""Admin professor management (create/list/update/soft-delete) with role guards."""

import pytest

from app.common.enums import UserRole
from app.common.security.jwt import create_access_token
from app.modules.iam.model import User

pytestmark = pytest.mark.asyncio

_MALLA = {
    "institution": {"name": "Escuela Politécnica Nacional", "acronym": "EPN"},
    "faculty": {"name": "Facultad de Ingeniería de Sistemas", "acronym": "FIS"},
    "career": {"name": "Computación", "degree_title": "Ingeniero/a en Computación"},
    "curriculum": {"pensum_year": 2020, "total_terms": 9, "total_credits": "3", "total_hours": 0},
    "courses": [
        {"code": "ICCD144", "name": "Programación I", "credits": "3", "hours": 144,
         "reference_term": 1, "organization_unit": "BASIC", "requirements": []},
    ],
    "graduation_requirements": [],
}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _token(db_session, email, role) -> str:
    user = User(email=email, role=role)
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=role.value)


async def test_professor_crud_and_guards(client, db_session):
    admin = await _token(db_session, "admin@epn.edu.ec", UserRole.ADMIN)
    student = await _token(db_session, "s@epn.edu.ec", UserRole.STUDENT)
    await client.post("/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(admin))
    institution_id = (await client.get("/api/v1/institutions")).json()[0]["id"]

    created = await client.post(
        "/api/v1/admin/professors",
        json={"institution_id": institution_id, "full_name": "Ada Lovelace"},
        headers=_auth(admin),
    )
    assert created.status_code == 200, created.text
    prof_id = created.json()["id"]

    listed = await client.get("/api/v1/professors")
    assert any(p["id"] == prof_id for p in listed.json())

    # Student cannot edit.
    assert (
        await client.patch(
            f"/api/v1/admin/professors/{prof_id}",
            json={"full_name": "Nope"},
            headers=_auth(student),
        )
    ).status_code == 403

    updated = await client.patch(
        f"/api/v1/admin/professors/{prof_id}",
        json={"full_name": "Ada L. Byron", "email": "ada@epn.edu.ec"},
        headers=_auth(admin),
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Ada L. Byron"

    deleted = await client.delete(f"/api/v1/admin/professors/{prof_id}", headers=_auth(admin))
    assert deleted.status_code == 200
    # Soft delete: still listed but inactive.
    prof = next(p for p in (await client.get("/api/v1/professors")).json() if p["id"] == prof_id)
    assert prof["is_active"] is False

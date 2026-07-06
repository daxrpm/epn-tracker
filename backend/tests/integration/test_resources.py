"""End-to-end study-resource flow: upload, list, moderation, voting and download.

The S3/MinIO layer is replaced by an in-memory fake so the whole flow runs in-process
(no Docker needed). Everything else — routing, auth, validation, the moderation state
machine and text extraction — is the real code path.
"""

from __future__ import annotations

from datetime import UTC, datetime

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

# A minimal but valid single-page PDF (has a real /Contents stream pypdf can read).
_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj\n"
    b"4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (Hola EPN) Tj ET\nendstream endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF"
)
_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32  # valid magic, dummy body


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _token(db_session, email: str, role: UserRole) -> str:
    user = User(email=email, role=role, email_verified_at=datetime.now(UTC))
    db_session.add(user)
    await db_session.commit()
    return create_access_token(str(user.id), role=role.value)


@pytest.fixture(autouse=True)
def fake_storage(monkeypatch):
    """In-memory replacement for the MinIO/S3 layer."""
    store: dict[str, bytes] = {}

    async def put_object(key, data, content_type):
        store[key] = data

    async def delete_object(key):
        store.pop(key, None)

    async def presigned_get_url(key, *, filename=None, expires=600):
        return f"https://minio.local/{key}?sig=fake"

    async def stream_object(key):
        data = store.get(key, b"")

        async def _iter():
            yield data

        return _iter(), "application/octet-stream"

    async def ensure_bucket():
        return None

    monkeypatch.setattr("app.modules.resources.storage.put_object", put_object)
    monkeypatch.setattr("app.modules.resources.storage.delete_object", delete_object)
    monkeypatch.setattr("app.modules.resources.storage.presigned_get_url", presigned_get_url)
    monkeypatch.setattr("app.modules.resources.storage.stream_object", stream_object)
    monkeypatch.setattr("app.modules.resources.storage.ensure_bucket", ensure_bucket)
    return store


async def _setup(client, db_session):
    admin = await _token(db_session, "admin@epn.edu.ec", UserRole.ADMIN)
    await client.post("/api/v1/admin/curricula/import/commit", json=_MALLA, headers=_auth(admin))
    institution_id = (await client.get("/api/v1/institutions")).json()[0]["id"]
    # Current academic period, auto-stamped onto uploads.
    await client.post(
        "/api/v1/admin/academic-periods",
        json={"institution_id": institution_id, "code": "2026-A", "name": "2026 A",
              "is_current": True},
        headers=_auth(admin),
    )
    search = await client.get("/api/v1/courses/search", params={"q": "ICCD144"})
    course_id = search.json()[0]["id"]
    return admin, course_id


async def test_upload_render_moderate_and_vote(client, db_session, fake_storage):
    admin, course_id = await _setup(client, db_session)
    student = await _token(db_session, "student@epn.edu.ec", UserRole.STUDENT)

    # --- Upload a Markdown file (text extraction runs synchronously) ------------------------
    md_bytes = b"# Derivadas\n\nLa **regla** de la cadena."
    md = await client.post(
        "/api/v1/resources",
        files={"file": ("apuntes.md", md_bytes, "text/markdown")},
        data={"course_id": course_id, "title": "Apuntes de derivadas", "tema": "Derivadas",
              "contribution": "APORTE_1"},
        headers=_auth(student),
    )
    assert md.status_code == 200, md.text
    md_body = md.json()
    assert md_body["kind"] == "MARKDOWN"
    assert md_body["status"] == "COMMUNITY_PENDING"
    md_id = md_body["id"]

    # Auto-stamped the current period and extracted text.
    detail = (await client.get(f"/api/v1/resources/{md_id}", headers=_auth(student))).json()
    assert detail["academic_period_code"] == "2026-A"
    assert detail["download_url"].startswith("https://minio.local/")
    # Same-origin content proxy streams the bytes back.
    content = await client.get(f"/api/v1/resources/{md_id}/content", headers=_auth(student))
    assert content.status_code == 200

    # --- Upload a PDF and an image -----------------------------------------------------------
    pdf = await client.post(
        "/api/v1/resources",
        files={"file": ("examen.pdf", _PDF, "application/pdf")},
        data={"course_id": course_id, "title": "Examen 2026", "contribution": "APORTE_2"},
        headers=_auth(student),
    )
    assert pdf.status_code == 200, pdf.text
    assert pdf.json()["kind"] == "PDF"

    img = await client.post(
        "/api/v1/resources",
        files={"file": ("diagrama.png", _PNG, "image/png")},
        data={"course_id": course_id, "title": "Diagrama"},
        headers=_auth(student),
    )
    assert img.status_code == 200, img.text
    assert img.json()["kind"] == "IMAGE"

    # --- Create a LINK (YouTube) -------------------------------------------------------------
    link = await client.post(
        "/api/v1/resources/links",
        json={"course_id": course_id, "title": "Clase grabada",
              "external_url": "https://youtu.be/dQw4w9WgXcQ"},
        headers=_auth(student),
    )
    assert link.status_code == 200, link.text
    assert link.json()["kind"] == "LINK"

    # --- Consultation panel: all four resources for the materia ------------------------------
    listing = await client.get(
        "/api/v1/resources", params={"course_id": course_id}, headers=_auth(student)
    )
    assert listing.status_code == 200
    assert len(listing.json()) == 4

    # --- Rejected file types / spoofed magic bytes -------------------------------------------
    bad_ext = await client.post(
        "/api/v1/resources",
        files={"file": ("malware.exe", b"MZ...", "application/octet-stream")},
        data={"course_id": course_id, "title": "no"},
        headers=_auth(student),
    )
    assert bad_ext.status_code == 422, bad_ext.text
    spoofed = await client.post(
        "/api/v1/resources",
        files={"file": ("fake.pdf", b"not a pdf", "application/pdf")},
        data={"course_id": course_id, "title": "no"},
        headers=_auth(student),
    )
    assert spoofed.status_code == 422, spoofed.text

    # --- Community voting: three external approvals verify the resource ----------------------
    for i in range(3):
        voter = await _token(db_session, f"voter{i}@epn.edu.ec", UserRole.STUDENT)
        res = await client.post(f"/api/v1/resources/{md_id}/vote", json={"vote": "APPROVE"},
                                headers=_auth(voter))
        assert res.status_code == 200, res.text
    verified = (await client.get(f"/api/v1/resources/{md_id}", headers=_auth(student))).json()
    assert verified["status"] == "COMMUNITY_VERIFIED"
    assert verified["approval_count"] == 3

    # Creator cannot vote their own resource.
    self_vote = await client.post(f"/api/v1/resources/{md_id}/vote", json={"vote": "APPROVE"},
                                  headers=_auth(student))
    assert self_vote.status_code == 403

    # --- Admin moderation --------------------------------------------------------------------
    pending = await client.get("/api/v1/admin/resources", headers=_auth(admin))
    assert pending.status_code == 200
    pending_ids = {r["id"] for r in pending.json()}
    assert pdf.json()["id"] in pending_ids  # still pending

    approved = await client.post(
        f"/api/v1/admin/resources/{pdf.json()['id']}/approve", headers=_auth(admin)
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "ADMIN_VERIFIED"

    # Students cannot reach the moderation queue.
    forbidden = await client.get("/api/v1/admin/resources", headers=_auth(student))
    assert forbidden.status_code == 403

    # --- Admin delete (soft) removes it from listings ----------------------------------------
    deleted = await client.delete(
        f"/api/v1/admin/resources/{img.json()['id']}", headers=_auth(admin)
    )
    assert deleted.status_code == 200
    final = await client.get(
        "/api/v1/resources", params={"course_id": course_id}, headers=_auth(student)
    )
    assert len(final.json()) == 3

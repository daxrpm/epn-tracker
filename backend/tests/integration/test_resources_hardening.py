"""Upload validation, visibility and moderation for study resources.

The upload endpoint is the only place the system accepts arbitrary bytes from students, so it gets
the most adversarial coverage: spoofed extensions, oversized bodies, hostile filenames and
hostile link schemes.
"""

from __future__ import annotations

import pytest

from app.common.enums import UserRole
from tests.factories import API, auth, make_user, seed_malla

pytestmark = pytest.mark.asyncio

# A minimal but real single-page PDF.
PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj\n"
    b"4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (Hola EPN) Tj ET\nendstream endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF"
)
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


async def _course_id(client, db_session) -> tuple[str, str]:
    malla = await seed_malla(client, db_session)
    return malla["courses"][0]["course_id"], malla["admin"]


async def _upload(client, token, course_id, *, filename, content, content_type, **extra):
    return await client.post(
        f"{API}/resources",
        files={"file": (filename, content, content_type)},
        data={"course_id": course_id, "title": extra.pop("title", "Apunte"), **extra},
        headers=auth(token),
    )


# --- File type validation -----------------------------------------------------------------------


async def test_a_valid_pdf_is_accepted(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up1@epn.edu.ec")

    resp = await _upload(
        client,
        student,
        course_id,
        filename="apunte.pdf",
        content=PDF,
        content_type="application/pdf",
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["kind"] == "PDF"


async def test_an_executable_is_rejected_by_extension(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up2@epn.edu.ec")

    resp = await _upload(
        client,
        student,
        course_id,
        filename="malware.exe",
        content=b"MZ\x90\x00",
        content_type="application/octet-stream",
    )
    assert resp.status_code == 422


async def test_a_non_pdf_wearing_a_pdf_extension_is_rejected(client, db_session, fake_storage):
    """Magic bytes must agree with the claimed extension."""
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up3@epn.edu.ec")

    resp = await _upload(
        client,
        student,
        course_id,
        filename="fake.pdf",
        content=b"<html><script>alert(1)</script></html>",
        content_type="application/pdf",
    )
    assert resp.status_code == 422
    assert "PDF" in resp.json()["error"]["message"]


async def test_an_empty_file_is_rejected(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up4@epn.edu.ec")

    resp = await _upload(
        client,
        student,
        course_id,
        filename="vacio.pdf",
        content=b"",
        content_type="application/pdf",
    )
    assert resp.status_code == 422


async def test_an_oversized_upload_is_rejected(client, db_session, fake_storage, monkeypatch):
    monkeypatch.setattr("app.core.conf.settings.resource_max_upload_mb", 1)
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up5@epn.edu.ec")

    oversized = PDF + b"\x00" * (2 * 1024 * 1024)
    resp = await _upload(
        client,
        student,
        course_id,
        filename="grande.pdf",
        content=oversized,
        content_type="application/pdf",
    )
    assert resp.status_code == 422
    assert "MB" in resp.json()["error"]["message"]


# --- Content type and filename are never taken from the client ----------------------------------


async def test_a_spoofed_content_type_is_not_stored(client, db_session, fake_storage):
    """A .txt announced as text/html used to be replayed as executable markup."""
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up6@epn.edu.ec")

    created = await _upload(
        client,
        student,
        course_id,
        filename="notas.txt",
        content=b"<script>alert(1)</script>",
        content_type="text/html",
    )
    assert created.status_code == 200, created.text

    detail = await client.get(f"{API}/resources/{created.json()['id']}", headers=auth(student))
    assert detail.json()["content_type"].startswith("text/plain")


async def test_the_preview_never_serves_html(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up7@epn.edu.ec")
    created = await _upload(
        client,
        student,
        course_id,
        filename="notas.md",
        content=b"# hola",
        content_type="text/html",
    )

    content = await client.get(
        f"{API}/resources/{created.json()['id']}/content", headers=auth(student)
    )
    assert content.status_code == 200
    assert "text/html" not in content.headers["content-type"]
    # Served as an attachment so the browser never renders it in our origin.
    assert content.headers["content-disposition"].startswith("attachment")


async def test_a_hostile_filename_cannot_forge_a_header(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "up8@epn.edu.ec")

    created = await _upload(
        client,
        student,
        course_id,
        filename='ev"il\r\nX-Injected: yes.pdf',
        content=PDF,
        content_type="application/pdf",
    )
    assert created.status_code == 200, created.text

    content = await client.get(
        f"{API}/resources/{created.json()['id']}/content", headers=auth(student)
    )
    assert "X-Injected" not in content.headers
    assert '"' not in content.headers["content-disposition"].split("filename=")[1][1:-1]


# --- Link resources -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
    ],
)
async def test_a_dangerous_link_scheme_is_rejected(client, db_session, url):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "link1@epn.edu.ec")

    resp = await client.post(
        f"{API}/resources/links",
        json={"course_id": course_id, "title": "Recurso", "external_url": url},
        headers=auth(student),
    )
    assert resp.status_code == 422, f"{url} was accepted"


async def test_an_https_link_is_accepted(client, db_session):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "link2@epn.edu.ec")

    resp = await client.post(
        f"{API}/resources/links",
        json={
            "course_id": course_id,
            "title": "Playlist",
            "external_url": "https://youtube.com/watch?v=abcdefghijk",
        },
        headers=auth(student),
    )
    assert resp.status_code == 200, resp.text


async def test_an_unknown_course_on_a_link_is_a_404(client, db_session):
    student = await make_user(db_session, "link3@epn.edu.ec")
    resp = await client.post(
        f"{API}/resources/links",
        json={
            "course_id": "00000000-0000-0000-0000-000000000000",
            "title": "X",
            "external_url": "https://example.org",
        },
        headers=auth(student),
    )
    assert resp.status_code == 404


# --- Visibility and ownership -------------------------------------------------------------------


async def test_a_private_resource_is_invisible_to_others(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "priv1@epn.edu.ec")
    other = await make_user(db_session, "priv2@epn.edu.ec")

    created = await _upload(
        client,
        owner,
        course_id,
        filename="secreto.pdf",
        content=PDF,
        content_type="application/pdf",
        visibility="PRIVATE",
    )
    resource_id = created.json()["id"]

    assert (
        await client.get(f"{API}/resources/{resource_id}", headers=auth(other))
    ).status_code == 404
    assert (
        await client.get(f"{API}/resources/{resource_id}/content", headers=auth(other))
    ).status_code == 404

    listing = await client.get(
        f"{API}/resources", params={"course_id": course_id}, headers=auth(other)
    )
    assert listing.json() == []

    own_listing = await client.get(
        f"{API}/resources", params={"course_id": course_id}, headers=auth(owner)
    )
    assert [r["id"] for r in own_listing.json()] == [resource_id]


async def test_voting_on_an_invisible_resource_is_refused(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "priv3@epn.edu.ec")
    other = await make_user(db_session, "priv4@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="secreto.pdf",
        content=PDF,
        content_type="application/pdf",
        visibility="PRIVATE",
    )

    resp = await client.post(
        f"{API}/resources/{created.json()['id']}/vote", json={}, headers=auth(other)
    )
    assert resp.status_code == 404


async def test_an_owner_can_withdraw_their_own_upload(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "own1@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="error.pdf",
        content=PDF,
        content_type="application/pdf",
    )
    resource_id = created.json()["id"]

    deleted = await client.delete(f"{API}/resources/{resource_id}", headers=auth(owner))
    assert deleted.status_code == 200, deleted.text

    assert (
        await client.get(f"{API}/resources/{resource_id}", headers=auth(owner))
    ).status_code == 404
    assert fake_storage == {}, "the stored object should be gone too"


async def test_a_stranger_cannot_withdraw_someone_elses_upload(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "own2@epn.edu.ec")
    other = await make_user(db_session, "own3@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="apunte.pdf",
        content=PDF,
        content_type="application/pdf",
    )

    resp = await client.delete(f"{API}/resources/{created.json()['id']}", headers=auth(other))
    assert resp.status_code == 403


async def test_a_community_verified_resource_needs_a_moderator_to_remove(
    client, db_session, fake_storage
):
    """Once the community vouched for it, the uploader cannot unilaterally take it back."""
    course_id, admin = await _course_id(client, db_session)
    owner = await make_user(db_session, "own4@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="bueno.pdf",
        content=PDF,
        content_type="application/pdf",
    )
    resource_id = created.json()["id"]

    for i in range(3):
        voter = await make_user(db_session, f"voter{i}@epn.edu.ec")
        vote = await client.post(
            f"{API}/resources/{resource_id}/vote", json={}, headers=auth(voter)
        )
        assert vote.status_code == 200, vote.text
    assert vote.json()["status"] == "COMMUNITY_VERIFIED"

    refused = await client.delete(f"{API}/resources/{resource_id}", headers=auth(owner))
    assert refused.status_code == 403

    allowed = await client.delete(f"{API}/admin/resources/{resource_id}", headers=auth(admin))
    assert allowed.status_code == 200


async def test_the_approval_count_matches_the_number_of_votes(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "count@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="apunte.pdf",
        content=PDF,
        content_type="application/pdf",
    )
    resource_id = created.json()["id"]

    for i in range(2):
        voter = await make_user(db_session, f"cvoter{i}@epn.edu.ec")
        resp = await client.post(
            f"{API}/resources/{resource_id}/vote", json={}, headers=auth(voter)
        )
    assert resp.json()["approval_count"] == 2
    assert resp.json()["status"] == "COMMUNITY_PENDING"


async def test_a_second_vote_from_the_same_user_is_refused(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "twice1@epn.edu.ec")
    voter = await make_user(db_session, "twice2@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="apunte.pdf",
        content=PDF,
        content_type="application/pdf",
    )
    resource_id = created.json()["id"]

    assert (
        await client.post(f"{API}/resources/{resource_id}/vote", json={}, headers=auth(voter))
    ).status_code == 200
    assert (
        await client.post(f"{API}/resources/{resource_id}/vote", json={}, headers=auth(voter))
    ).status_code == 409


async def test_rejection_votes_archive_a_resource(client, db_session, fake_storage):
    """REJECT used to be recorded and then ignored entirely."""
    course_id, _ = await _course_id(client, db_session)
    owner = await make_user(db_session, "rej@epn.edu.ec")
    created = await _upload(
        client,
        owner,
        course_id,
        filename="malo.pdf",
        content=PDF,
        content_type="application/pdf",
    )
    resource_id = created.json()["id"]

    for i in range(3):
        voter = await make_user(db_session, f"rejector{i}@epn.edu.ec")
        resp = await client.post(
            f"{API}/resources/{resource_id}/vote",
            json={"vote": "REJECT"},
            headers=auth(voter),
        )
        assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "REJECTED"


# --- Pagination ---------------------------------------------------------------------------------


async def test_listing_resources_is_bounded(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "page@epn.edu.ec", role=UserRole.ADMIN)
    for i in range(5):
        await _upload(
            client,
            student,
            course_id,
            filename=f"a{i}.pdf",
            content=PDF,
            content_type="application/pdf",
            title=f"Apunte {i}",
        )

    first = await client.get(
        f"{API}/resources", params={"course_id": course_id, "limit": 2}, headers=auth(student)
    )
    assert len(first.json()) == 2

    second = await client.get(
        f"{API}/resources",
        params={"course_id": course_id, "limit": 2, "offset": 2},
        headers=auth(student),
    )
    assert {r["id"] for r in first.json()}.isdisjoint({r["id"] for r in second.json()})

    too_many = await client.get(
        f"{API}/resources", params={"course_id": course_id, "limit": 9999}, headers=auth(student)
    )
    assert too_many.status_code == 422


async def test_searching_resources_runs_on_the_server(client, db_session, fake_storage):
    course_id, _ = await _course_id(client, db_session)
    student = await make_user(db_session, "search@epn.edu.ec", role=UserRole.ADMIN)
    await _upload(
        client,
        student,
        course_id,
        filename="a.pdf",
        content=PDF,
        content_type="application/pdf",
        title="Derivadas",
    )
    await _upload(
        client,
        student,
        course_id,
        filename="b.pdf",
        content=PDF,
        content_type="application/pdf",
        title="Integrales",
    )

    resp = await client.get(
        f"{API}/resources",
        params={"course_id": course_id, "q": "deriva"},
        headers=auth(student),
    )
    assert [r["title"] for r in resp.json()] == ["Derivadas"]

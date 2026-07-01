"""End-to-end tests for the EPN email-code auth flow (ERS §RF-001, §RF-002)."""

import pytest

pytestmark = pytest.mark.asyncio

EMAIL = "estudiante.prueba@epn.edu.ec"
PASSWORD = "SuperSecret123"


async def _register(client, fake_redis, email=EMAIL, password=PASSWORD):
    resp = await client.post("/api/v1/auth/register/request-code", json={"email": email})
    assert resp.status_code == 200
    code = await fake_redis.get(f"verify:code:{email}")
    assert code is not None
    resp = await client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": email, "code": code, "password": password},
    )
    return resp


async def test_register_verify_login_me(client, fake_redis):
    resp = await _register(client, fake_redis)
    assert resp.status_code == 200
    tokens = resp.json()
    assert tokens["access_token"] and tokens["refresh_token"]

    login = await client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert login.status_code == 200
    access = login.json()["access_token"]

    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert me.json()["email"] == EMAIL
    assert me.json()["is_verified"] is True


async def test_non_epn_email_rejected(client):
    resp = await client.post(
        "/api/v1/auth/register/request-code", json={"email": "someone@gmail.com"}
    )
    assert resp.status_code == 422


async def test_wrong_code_fails(client, fake_redis):
    await client.post("/api/v1/auth/register/request-code", json={"email": EMAIL})
    resp = await client.post(
        "/api/v1/auth/register/verify-code",
        json={"email": EMAIL, "code": "000000", "password": PASSWORD},
    )
    assert resp.status_code == 401


async def test_me_requires_token(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_refresh_rotates_tokens(client, fake_redis):
    tokens = (await _register(client, fake_redis)).json()
    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]

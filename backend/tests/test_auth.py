"""Auth router tests — register, login, get current user."""

import pytest
from httpx import AsyncClient


USER_DATA = {
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword123",
    "display_name": "Test User",
}


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """POST /auth/register creates a new user and returns 201."""
    resp = await client.post("/api/v1/auth/register", json=USER_DATA)
    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "testuser"
    assert body["email"] == "test@example.com"
    assert body["display_name"] == "Test User"
    assert body["theme_preference"] == "dark"
    assert "id" in body
    assert "created_at" in body


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient):
    """POST /auth/register with existing username returns 409."""
    await client.post("/api/v1/auth/register", json=USER_DATA)
    resp = await client.post("/api/v1/auth/register", json=USER_DATA)
    assert resp.status_code == 409
    assert "already registered" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """POST /auth/register with existing email returns 409."""
    await client.post("/api/v1/auth/register", json=USER_DATA)
    dup = {**USER_DATA, "username": "otheruser"}
    resp = await client.post("/api/v1/auth/register", json=dup)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """POST /auth/login returns a JWT token."""
    await client.post("/api/v1/auth/register", json=USER_DATA)
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "securepassword123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """POST /auth/login with wrong password returns 401."""
    await client.post("/api/v1/auth/register", json=USER_DATA)
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "wrongpassword"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """POST /auth/login with nonexistent user returns 401."""
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "nobody", "password": "pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    """GET /auth/me returns current user when authenticated."""
    await client.post("/api/v1/auth/register", json=USER_DATA)
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "securepassword123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_resp.json()["access_token"]

    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    """GET /auth/me without token returns 401."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """GET /auth/me with invalid token returns 401."""
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalidtoken123"},
    )
    assert resp.status_code == 401

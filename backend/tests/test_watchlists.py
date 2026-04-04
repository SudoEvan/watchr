"""Watchlist router tests — CRUD, sharing, favorites."""

import pytest
from httpx import AsyncClient


USER_DATA = {
    "username": "wluser",
    "email": "wl@example.com",
    "password": "securepassword123",
    "display_name": "WL User",
}

USER2_DATA = {
    "username": "wluser2",
    "email": "wl2@example.com",
    "password": "securepassword123",
    "display_name": "WL User 2",
}


async def _register_and_login(client: AsyncClient, user_data: dict) -> str:
    """Helper: register a user and return their JWT token."""
    await client.post("/api/v1/auth/register", json=user_data)
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": user_data["username"], "password": user_data["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_watchlist(client: AsyncClient):
    """POST /watchlists creates a new list and returns 201."""
    token = await _register_and_login(client, USER_DATA)
    resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "Movies", "description": "My movies", "is_rewatch": False},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Movies"
    assert body["description"] == "My movies"
    assert body["is_rewatch"] is False
    assert "id" in body


@pytest.mark.asyncio
async def test_list_watchlists(client: AsyncClient):
    """GET /watchlists returns all accessible lists."""
    token = await _register_and_login(client, USER_DATA)
    await client.post(
        "/api/v1/watchlists",
        json={"name": "List 1"},
        headers=_auth(token),
    )
    await client.post(
        "/api/v1/watchlists",
        json={"name": "List 2"},
        headers=_auth(token),
    )
    resp = await client.get("/api/v1/watchlists", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_watchlist(client: AsyncClient):
    """GET /watchlists/:id returns the specific list."""
    token = await _register_and_login(client, USER_DATA)
    create_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "Detail Test"},
        headers=_auth(token),
    )
    wl_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/watchlists/{wl_id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["name"] == "Detail Test"


@pytest.mark.asyncio
async def test_update_watchlist(client: AsyncClient):
    """PATCH /watchlists/:id updates the list name."""
    token = await _register_and_login(client, USER_DATA)
    create_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "Old Name"},
        headers=_auth(token),
    )
    wl_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/watchlists/{wl_id}",
        json={"name": "New Name"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_watchlist(client: AsyncClient):
    """DELETE /watchlists/:id removes the list."""
    token = await _register_and_login(client, USER_DATA)
    create_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "To Delete"},
        headers=_auth(token),
    )
    wl_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/watchlists/{wl_id}", headers=_auth(token))
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/v1/watchlists/{wl_id}", headers=_auth(token))
    assert get_resp.status_code == 403 or get_resp.status_code == 404


@pytest.mark.asyncio
async def test_favorite_watchlist(client: AsyncClient):
    """POST/DELETE /watchlists/:id/favorite toggles favorite."""
    token = await _register_and_login(client, USER_DATA)
    create_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "Fave Test"},
        headers=_auth(token),
    )
    wl_id = create_resp.json()["id"]

    # Add favorite
    fav_resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/favorite", headers=_auth(token)
    )
    assert fav_resp.status_code == 201

    # Remove favorite
    unfav_resp = await client.delete(
        f"/api/v1/watchlists/{wl_id}/favorite", headers=_auth(token)
    )
    assert unfav_resp.status_code == 204


@pytest.mark.asyncio
async def test_share_watchlist(client: AsyncClient):
    """POST /watchlists/:id/share grants another user access."""
    token1 = await _register_and_login(client, USER_DATA)
    token2 = await _register_and_login(client, USER2_DATA)

    # Get user2's ID
    me_resp = await client.get("/api/v1/auth/me", headers=_auth(token2))
    user2_id = me_resp.json()["id"]

    # Create list as user1
    create_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "Shared List"},
        headers=_auth(token1),
    )
    wl_id = create_resp.json()["id"]

    # Share with user2
    share_resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/access",
        json={"user_id": user2_id, "role": "viewer"},
        headers=_auth(token1),
    )
    assert share_resp.status_code == 201

    # User2 can now see the list
    list_resp = await client.get("/api/v1/watchlists", headers=_auth(token2))
    assert list_resp.status_code == 200
    ids = [wl["id"] for wl in list_resp.json()]
    assert wl_id in ids


@pytest.mark.asyncio
async def test_viewer_cannot_update(client: AsyncClient):
    """Viewer role cannot PATCH a watchlist."""
    token1 = await _register_and_login(client, USER_DATA)
    token2 = await _register_and_login(client, USER2_DATA)

    me_resp = await client.get("/api/v1/auth/me", headers=_auth(token2))
    user2_id = me_resp.json()["id"]

    create_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "No Edit"},
        headers=_auth(token1),
    )
    wl_id = create_resp.json()["id"]

    await client.post(
        f"/api/v1/watchlists/{wl_id}/access",
        json={"user_id": user2_id, "role": "viewer"},
        headers=_auth(token1),
    )

    # User2 (viewer) tries to update
    resp = await client.patch(
        f"/api/v1/watchlists/{wl_id}",
        json={"name": "Hacked"},
        headers=_auth(token2),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_access_denied(client: AsyncClient):
    """Unauthenticated requests to /watchlists return 401."""
    resp = await client.get("/api/v1/watchlists")
    assert resp.status_code == 401

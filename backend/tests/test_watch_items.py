"""Watch items router tests — add/list/remove items, watch records."""

import pytest
from httpx import AsyncClient

USER_DATA = {
    "username": "itemuser",
    "email": "item@example.com",
    "password": "securepassword123",
    "display_name": "Item User",
}


async def _setup(client: AsyncClient) -> tuple[str, str]:
    """Helper: register, login, create a watchlist. Returns (token, watchlist_id)."""
    await client.post("/api/v1/auth/register", json=USER_DATA)
    login_resp = await client.post(
        "/api/v1/auth/login",
        data={"username": USER_DATA["username"], "password": USER_DATA["password"]},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = login_resp.json()["access_token"]

    wl_resp = await client.post(
        "/api/v1/watchlists",
        json={"name": "Test List"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token, wl_resp.json()["id"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


ITEM_DATA = {
    "tmdb_id": 550,
    "media_type": "movie",
    "title": "Fight Club",
    "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    "overview": "An insomniac office worker...",
    "release_year": 1999,
}


@pytest.mark.asyncio
async def test_add_item(client: AsyncClient):
    """POST /watchlists/:id/items adds an item and returns 201."""
    token, wl_id = await _setup(client)
    resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Fight Club"
    assert body["tmdb_id"] == 550
    assert body["watchlist_id"] == wl_id


@pytest.mark.asyncio
async def test_add_duplicate_item(client: AsyncClient):
    """Adding the same TMDB item twice returns 409."""
    token, wl_id = await _setup(client)
    await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_items(client: AsyncClient):
    """GET /watchlists/:id/items returns all items."""
    token, wl_id = await _setup(client)
    await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json={**ITEM_DATA, "tmdb_id": 680, "title": "Pulp Fiction"},
        headers=_auth(token),
    )

    resp = await client.get(f"/api/v1/watchlists/{wl_id}/items", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_remove_item(client: AsyncClient):
    """DELETE /watchlists/:id/items/:item_id removes the item."""
    token, wl_id = await _setup(client)
    add_resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    item_id = add_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/watchlists/{wl_id}/items/{item_id}",
        headers=_auth(token),
    )
    assert resp.status_code == 204

    # Verify it's gone
    list_resp = await client.get(f"/api/v1/watchlists/{wl_id}/items", headers=_auth(token))
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_create_watch_record(client: AsyncClient):
    """POST /watchlists/:id/items/:item_id/records creates a record."""
    token, wl_id = await _setup(client)
    add_resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    item_id = add_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/items/{item_id}/records",
        json={"start_date": "2024-12-01", "end_date": "2024-12-01", "notes": "Great movie!"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["end_date"] == "2024-12-01"
    assert body["notes"] == "Great movie!"


@pytest.mark.asyncio
async def test_list_watch_records(client: AsyncClient):
    """GET /watchlists/:id/items/:item_id/records returns records."""
    token, wl_id = await _setup(client)
    add_resp = await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    item_id = add_resp.json()["id"]

    await client.post(
        f"/api/v1/watchlists/{wl_id}/items/{item_id}/records",
        json={"start_date": "2024-12-01", "end_date": "2024-12-01"},
        headers=_auth(token),
    )
    await client.post(
        f"/api/v1/watchlists/{wl_id}/items/{item_id}/records",
        json={"start_date": "2024-12-15", "end_date": "2024-12-15"},
        headers=_auth(token),
    )

    resp = await client.get(
        f"/api/v1/watchlists/{wl_id}/items/{item_id}/records",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_watched_filter(client: AsyncClient):
    """GET /watchlists/:id/items?watched=true filters watched items."""
    token, wl_id = await _setup(client)

    # Add two items
    add1 = await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json=ITEM_DATA,
        headers=_auth(token),
    )
    item1_id = add1.json()["id"]

    await client.post(
        f"/api/v1/watchlists/{wl_id}/items",
        json={**ITEM_DATA, "tmdb_id": 680, "title": "Pulp Fiction"},
        headers=_auth(token),
    )

    # Mark only item1 as watched
    await client.post(
        f"/api/v1/watchlists/{wl_id}/items/{item1_id}/records",
        json={"start_date": "2024-12-01", "end_date": "2024-12-01"},
        headers=_auth(token),
    )

    # Filter watched=true → only item1
    resp = await client.get(
        f"/api/v1/watchlists/{wl_id}/items",
        params={"watched": True},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "Fight Club"

    # Filter watched=false → only Pulp Fiction
    resp2 = await client.get(
        f"/api/v1/watchlists/{wl_id}/items",
        params={"watched": False},
        headers=_auth(token),
    )
    assert resp2.status_code == 200
    items2 = resp2.json()
    assert len(items2) == 1
    assert items2[0]["title"] == "Pulp Fiction"

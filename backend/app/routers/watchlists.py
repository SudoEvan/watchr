"""Watchlists router — CRUD, sharing, favorites, transfer."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.watchlist import WatchList, WatchListAccess, WatchListFavorite
from app.models.watch_item import WatchItem
from app.schemas.watchlist import (
    WatchListCreate,
    WatchListUpdate,
    WatchListResponse,
    WatchListAccessCreate,
    WatchListAccessResponse,
    WatchListTransfer,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


# ── Helpers ─────────────────────────────────────────


async def _get_user_role(
    watchlist_id: str, user_id: str, db: AsyncSession
) -> str | None:
    """Return the user's role for a watchlist, or None if no access."""
    result = await db.execute(
        select(WatchListAccess.role).where(
            WatchListAccess.watchlist_id == watchlist_id,
            WatchListAccess.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    return row


async def _require_role(
    watchlist_id: str, user_id: str, db: AsyncSession, minimum: str = "viewer"
) -> str:
    """Raise 403 if user doesn't have at least the minimum role."""
    role_hierarchy = {"owner": 3, "manager": 2, "viewer": 1}
    role = await _get_user_role(watchlist_id, user_id, db)
    if role is None or role_hierarchy.get(role, 0) < role_hierarchy.get(minimum, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires at least '{minimum}' access",
        )
    return role


# ── CRUD ────────────────────────────────────────────


@router.get("", response_model=list[WatchListResponse])
async def list_watchlists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all watchlists the current user has access to."""
    result = await db.execute(
        select(WatchList, WatchListAccess.role)
        .join(WatchListAccess, WatchList.id == WatchListAccess.watchlist_id)
        .where(WatchListAccess.user_id == current_user.id)
        .order_by(WatchList.name)
    )
    rows = result.all()

    watchlists = []
    for wl, role in rows:
        # Count items
        count_result = await db.execute(
            select(func.count(WatchItem.id)).where(WatchItem.watchlist_id == wl.id)
        )
        item_count = count_result.scalar() or 0

        # Check favorite
        fav_result = await db.execute(
            select(WatchListFavorite.id).where(
                WatchListFavorite.watchlist_id == wl.id,
                WatchListFavorite.user_id == current_user.id,
            )
        )
        is_favorite = fav_result.scalar_one_or_none() is not None

        watchlists.append(
            WatchListResponse(
                id=wl.id,
                name=wl.name,
                description=wl.description,
                is_rewatch=wl.is_rewatch,
                created_at=wl.created_at,
                updated_at=wl.updated_at,
                role=role,
                is_favorite=is_favorite,
                item_count=item_count,
            )
        )

    return watchlists


@router.post("", response_model=WatchListResponse, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    body: WatchListCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new watchlist. The creating user becomes the owner."""
    watchlist = WatchList(
        name=body.name,
        description=body.description,
        is_rewatch=body.is_rewatch,
    )
    db.add(watchlist)
    await db.flush()

    access = WatchListAccess(
        watchlist_id=watchlist.id,
        user_id=current_user.id,
        role="owner",
    )
    db.add(access)
    await db.flush()
    await db.refresh(watchlist)

    return WatchListResponse(
        id=watchlist.id,
        name=watchlist.name,
        description=watchlist.description,
        is_rewatch=watchlist.is_rewatch,
        created_at=watchlist.created_at,
        updated_at=watchlist.updated_at,
        role="owner",
        is_favorite=False,
        item_count=0,
    )


@router.get("/{watchlist_id}", response_model=WatchListResponse)
async def get_watchlist(
    watchlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single watchlist by ID."""
    role = await _require_role(watchlist_id, current_user.id, db)

    result = await db.execute(select(WatchList).where(WatchList.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    count_result = await db.execute(
        select(func.count(WatchItem.id)).where(WatchItem.watchlist_id == wl.id)
    )
    item_count = count_result.scalar() or 0

    fav_result = await db.execute(
        select(WatchListFavorite.id).where(
            WatchListFavorite.watchlist_id == wl.id,
            WatchListFavorite.user_id == current_user.id,
        )
    )
    is_favorite = fav_result.scalar_one_or_none() is not None

    return WatchListResponse(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        is_rewatch=wl.is_rewatch,
        created_at=wl.created_at,
        updated_at=wl.updated_at,
        role=role,
        is_favorite=is_favorite,
        item_count=item_count,
    )


@router.patch("/{watchlist_id}", response_model=WatchListResponse)
async def update_watchlist(
    watchlist_id: str,
    body: WatchListUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a watchlist. Requires manager or owner role."""
    role = await _require_role(watchlist_id, current_user.id, db, minimum="manager")

    result = await db.execute(select(WatchList).where(WatchList.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    if body.name is not None:
        wl.name = body.name
    if body.description is not None:
        wl.description = body.description
    if body.is_rewatch is not None:
        wl.is_rewatch = body.is_rewatch

    db.add(wl)
    await db.flush()
    await db.refresh(wl)

    return WatchListResponse(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        is_rewatch=wl.is_rewatch,
        created_at=wl.created_at,
        updated_at=wl.updated_at,
        role=role,
    )


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    watchlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a watchlist. Owner only."""
    await _require_role(watchlist_id, current_user.id, db, minimum="owner")

    result = await db.execute(select(WatchList).where(WatchList.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    await db.delete(wl)


# ── Sharing ─────────────────────────────────────────


@router.get("/{watchlist_id}/access", response_model=list[WatchListAccessResponse])
async def list_access(
    watchlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with access to this watchlist."""
    await _require_role(watchlist_id, current_user.id, db)

    result = await db.execute(
        select(WatchListAccess, User.display_name)
        .join(User, WatchListAccess.user_id == User.id)
        .where(WatchListAccess.watchlist_id == watchlist_id)
    )
    rows = result.all()
    return [
        WatchListAccessResponse(
            id=access.id,
            watchlist_id=access.watchlist_id,
            user_id=access.user_id,
            role=access.role,
            user_display_name=display_name,
            created_at=access.created_at,
        )
        for access, display_name in rows
    ]


@router.post(
    "/{watchlist_id}/access",
    response_model=WatchListAccessResponse,
    status_code=status.HTTP_201_CREATED,
)
async def share_watchlist(
    watchlist_id: str,
    body: WatchListAccessCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share a watchlist with another user. Owner only."""
    await _require_role(watchlist_id, current_user.id, db, minimum="owner")

    if body.role not in ("manager", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be 'manager' or 'viewer'")

    # Check target user exists
    target_user = await db.execute(select(User).where(User.id == body.user_id))
    user = target_user.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check not already shared
    existing = await db.execute(
        select(WatchListAccess).where(
            WatchListAccess.watchlist_id == watchlist_id,
            WatchListAccess.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already has access")

    access = WatchListAccess(
        watchlist_id=watchlist_id,
        user_id=body.user_id,
        role=body.role,
    )
    db.add(access)
    await db.flush()
    await db.refresh(access)

    return WatchListAccessResponse(
        id=access.id,
        watchlist_id=access.watchlist_id,
        user_id=access.user_id,
        role=access.role,
        user_display_name=user.display_name,
        created_at=access.created_at,
    )


@router.delete("/{watchlist_id}/access/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_access(
    watchlist_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a user's access. Owner only. Cannot revoke own ownership."""
    await _require_role(watchlist_id, current_user.id, db, minimum="owner")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot revoke your own ownership")

    result = await db.execute(
        select(WatchListAccess).where(
            WatchListAccess.watchlist_id == watchlist_id,
            WatchListAccess.user_id == user_id,
        )
    )
    access = result.scalar_one_or_none()
    if not access:
        raise HTTPException(status_code=404, detail="Access entry not found")

    await db.delete(access)


# ── Favorites ───────────────────────────────────────


@router.post("/{watchlist_id}/favorite", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    watchlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Favorite a watchlist."""
    await _require_role(watchlist_id, current_user.id, db)

    existing = await db.execute(
        select(WatchListFavorite).where(
            WatchListFavorite.watchlist_id == watchlist_id,
            WatchListFavorite.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already favorited")

    fav = WatchListFavorite(watchlist_id=watchlist_id, user_id=current_user.id)
    db.add(fav)
    return {"status": "favorited"}


@router.delete("/{watchlist_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    watchlist_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unfavorite a watchlist."""
    result = await db.execute(
        select(WatchListFavorite).where(
            WatchListFavorite.watchlist_id == watchlist_id,
            WatchListFavorite.user_id == current_user.id,
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="Not favorited")

    await db.delete(fav)


# ── Transfer ────────────────────────────────────────


@router.post("/{watchlist_id}/transfer", status_code=status.HTTP_200_OK)
async def transfer_ownership(
    watchlist_id: str,
    body: WatchListTransfer,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transfer ownership to another user. Current owner becomes manager."""
    await _require_role(watchlist_id, current_user.id, db, minimum="owner")

    # Verify new owner exists
    target_result = await db.execute(select(User).where(User.id == body.new_owner_id))
    if not target_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target user not found")

    # Demote current owner to manager
    current_access = await db.execute(
        select(WatchListAccess).where(
            WatchListAccess.watchlist_id == watchlist_id,
            WatchListAccess.user_id == current_user.id,
        )
    )
    current_entry = current_access.scalar_one()
    current_entry.role = "manager"

    # Promote or create new owner
    new_access = await db.execute(
        select(WatchListAccess).where(
            WatchListAccess.watchlist_id == watchlist_id,
            WatchListAccess.user_id == body.new_owner_id,
        )
    )
    new_entry = new_access.scalar_one_or_none()
    if new_entry:
        new_entry.role = "owner"
    else:
        db.add(
            WatchListAccess(
                watchlist_id=watchlist_id,
                user_id=body.new_owner_id,
                role="owner",
            )
        )

    return {"status": "ownership transferred"}

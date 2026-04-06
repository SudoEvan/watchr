"""Watch items router — CRUD for items within a watchlist, plus watch records."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.watch_item import WatchItem, WatchRecord
from app.models.watchlist import WatchListAccess
from app.routers.watchlists import _require_role
from app.schemas.watch_item import (
    RatingUpdate,
    WatchItemCreate,
    WatchItemResponse,
    WatchRecordCreate,
    WatchRecordResponse,
    WatchRecordUpdate,
)
from app.services.auth import get_current_user

# Roles that participate in shared watching
_WATCHING_ROLES = ("owner", "manager", "watcher")

router = APIRouter(prefix="/watchlists/{watchlist_id}/items", tags=["watch_items"])


def _build_item_response(
    item: WatchItem,
    last_watched: date | None = None,
    watch_count: int = 0,
    currently_watching: bool = False,
    active_record_id: str | None = None,
) -> WatchItemResponse:
    """Build a WatchItemResponse from a WatchItem model instance."""
    return WatchItemResponse(
        id=item.id,
        watchlist_id=item.watchlist_id,
        tmdb_id=item.tmdb_id,
        media_type=item.media_type,
        title=item.title,
        poster_path=item.poster_path,
        overview=item.overview,
        release_year=item.release_year,
        added_by=item.added_by,
        sort_order=item.sort_order,
        created_at=item.created_at,
        last_watched=last_watched,
        watch_count=watch_count,
        currently_watching=currently_watching,
        active_record_id=active_record_id,
        rating=item.rating,
        rated_by=item.rated_by,
    )


@router.get("", response_model=list[WatchItemResponse])
async def list_items(
    watchlist_id: str,
    watched: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WatchItemResponse]:
    """
    List items in a watchlist.

    Query params:
    - watched=true  → only items with a completed watch record
    - watched=false → only unwatched items
    - (omit)        → all items
    """
    await _require_role(watchlist_id, current_user.id, db)

    # Subquery: latest end_date and count per item (completed watches only)
    latest_watch = (
        select(
            WatchRecord.watch_item_id,
            func.max(WatchRecord.end_date).label("last_watched"),
            func.count(WatchRecord.id).label("watch_count"),
        )
        .where(WatchRecord.end_date.isnot(None))
        .group_by(WatchRecord.watch_item_id)
        .subquery()
    )

    # Subquery: active/in-progress watch on THIS specific item (for active_record_id)
    active_watch = (
        select(
            WatchRecord.watch_item_id,
            WatchRecord.id.label("active_record_id"),
        )
        .where(
            WatchRecord.start_date.isnot(None),
            WatchRecord.end_date.is_(None),
        )
        .subquery()
    )

    # Subquery: watchlist IDs where user is owner/manager/watcher
    my_lists = (
        select(WatchListAccess.watchlist_id)
        .where(
            WatchListAccess.user_id == current_user.id,
            WatchListAccess.role.in_(_WATCHING_ROLES),
        )
        .subquery()
    )

    # Subquery: global "currently watching" — any open record on a WatchItem
    # with the same tmdb_id in ANY list the user participates in.
    global_watching = (
        select(WatchItem.tmdb_id)
        .join(WatchRecord, WatchRecord.watch_item_id == WatchItem.id)
        .where(
            WatchItem.watchlist_id.in_(select(my_lists.c.watchlist_id)),
            WatchRecord.start_date.isnot(None),
            WatchRecord.end_date.is_(None),
        )
        .distinct()
        .subquery()
    )

    query = (
        select(
            WatchItem,
            latest_watch.c.last_watched,
            latest_watch.c.watch_count,
            active_watch.c.active_record_id,
            global_watching.c.tmdb_id.label("globally_watching"),
        )
        .outerjoin(latest_watch, WatchItem.id == latest_watch.c.watch_item_id)
        .outerjoin(active_watch, WatchItem.id == active_watch.c.watch_item_id)
        .outerjoin(global_watching, WatchItem.tmdb_id == global_watching.c.tmdb_id)
        .where(WatchItem.watchlist_id == watchlist_id)
    )

    if watched is True:
        query = query.where(latest_watch.c.last_watched.isnot(None))
    elif watched is False:
        query = query.where(latest_watch.c.last_watched.is_(None))

    # Sort: currently watching first, then unwatched, then by last watched
    query = query.order_by(
        global_watching.c.tmdb_id.is_(None).asc(),  # watching items first
        latest_watch.c.last_watched.asc().nullsfirst(),
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        _build_item_response(
            item,
            last_watched,
            watch_count or 0,
            currently_watching=globally_watching is not None,
            active_record_id=active_record_id,
        )
        for item, last_watched, watch_count, active_record_id, globally_watching in rows
    ]


@router.post("", response_model=WatchItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item(
    watchlist_id: str,
    body: WatchItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchItemResponse:
    """Add a movie/show to a watchlist. Requires manager or owner role."""
    await _require_role(watchlist_id, current_user.id, db, minimum="manager")

    # Check for duplicates
    existing = await db.execute(
        select(WatchItem).where(
            WatchItem.watchlist_id == watchlist_id,
            WatchItem.tmdb_id == body.tmdb_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Item already in this watchlist")

    item = WatchItem(
        watchlist_id=watchlist_id,
        tmdb_id=body.tmdb_id,
        media_type=body.media_type,
        title=body.title,
        poster_path=body.poster_path,
        overview=body.overview,
        release_year=body.release_year,
        added_by=current_user.id,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)

    return _build_item_response(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_item(
    watchlist_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove an item from a watchlist. Requires manager or owner role."""
    await _require_role(watchlist_id, current_user.id, db, minimum="manager")

    result = await db.execute(
        select(WatchItem).where(
            WatchItem.id == item_id,
            WatchItem.watchlist_id == watchlist_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)


# ── Rating ─────────────────────────────────────────


@router.patch("/{item_id}/rating", response_model=WatchItemResponse)
async def update_rating(
    watchlist_id: str,
    item_id: str,
    body: RatingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchItemResponse:
    """Set or update the rating for an item. Any member can rate."""
    await _require_role(watchlist_id, current_user.id, db)

    if body.rating < 0.5 or body.rating > 5 or (body.rating * 2) % 1 != 0:
        raise HTTPException(status_code=400, detail="Rating must be 0.5 to 5 in 0.5 increments")

    result = await db.execute(
        select(WatchItem).where(
            WatchItem.id == item_id,
            WatchItem.watchlist_id == watchlist_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.rating = body.rating
    item.rated_by = current_user.id
    db.add(item)
    await db.flush()
    await db.refresh(item)

    return _build_item_response(item)


# ── Watch Records ───────────────────────────────────


@router.get("/{item_id}/records", response_model=list[WatchRecordResponse])
async def list_records(
    watchlist_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WatchRecord]:
    """List all watch records for an item."""
    await _require_role(watchlist_id, current_user.id, db)

    result = await db.execute(
        select(WatchRecord)
        .where(WatchRecord.watch_item_id == item_id)
        .order_by(WatchRecord.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/{item_id}/records",
    response_model=WatchRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_record(
    watchlist_id: str,
    item_id: str,
    body: WatchRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchRecord:
    """Create a watch record (start/finish watching). Requires watcher, manager, or owner."""
    await _require_role(watchlist_id, current_user.id, db, minimum="watcher")

    # Verify item exists in this watchlist
    item_result = await db.execute(
        select(WatchItem).where(
            WatchItem.id == item_id,
            WatchItem.watchlist_id == watchlist_id,
        )
    )
    if not item_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Item not found in this watchlist")

    record = WatchRecord(
        watch_item_id=item_id,
        user_id=current_user.id,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.patch(
    "/{item_id}/records/{record_id}",
    response_model=WatchRecordResponse,
)
async def update_record(
    watchlist_id: str,
    item_id: str,
    record_id: str,
    body: WatchRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WatchRecord:
    """Update a watch record (e.g. set end_date to finish watching a TV show)."""
    await _require_role(watchlist_id, current_user.id, db, minimum="watcher")

    result = await db.execute(
        select(WatchRecord).where(
            WatchRecord.id == record_id,
            WatchRecord.watch_item_id == item_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if body.start_date is not None:
        record.start_date = body.start_date
    if body.end_date is not None:
        record.end_date = body.end_date
    if body.notes is not None:
        record.notes = body.notes

    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.delete(
    "/{item_id}/records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_record(
    watchlist_id: str,
    item_id: str,
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a watch record. Requires watcher, manager, or owner."""
    await _require_role(watchlist_id, current_user.id, db, minimum="watcher")

    result = await db.execute(
        select(WatchRecord).where(
            WatchRecord.id == record_id,
            WatchRecord.watch_item_id == item_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    await db.delete(record)

"""Users router — profile, preferences, and global watching state."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.watch_item import WatchItem, WatchRecord
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.watch_item import CurrentlyWatchingResponse, WatchHistoryItem
from app.services.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=1, description="Username prefix to search"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    """Search users by username prefix. Used for sharing watchlists."""
    result = await db.execute(
        select(User).where(User.username.ilike(f"{q}%")).where(User.id != current_user.id).limit(10)
    )
    return list(result.scalars().all())


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update the current user's profile."""
    if updates.display_name is not None:
        current_user.display_name = updates.display_name
    if updates.email is not None:
        current_user.email = updates.email
    if updates.theme_preference is not None:
        if updates.theme_preference not in ("dark", "light"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="theme_preference must be 'dark' or 'light'",
            )
        current_user.theme_preference = updates.theme_preference

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return current_user


# ── Global "Currently Watching" ────────────────────────────────


@router.get("/me/watching", response_model=list[CurrentlyWatchingResponse])
async def list_currently_watching(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CurrentlyWatchingResponse]:
    """List all titles the current user is actively watching (across all lists)."""
    # Find distinct (tmdb_id, media_type, title, poster_path) where user has an
    # open WatchRecord (start_date set, end_date NULL).
    query = (
        select(
            WatchItem.tmdb_id,
            WatchItem.media_type,
            WatchItem.title,
            WatchItem.poster_path,
            func.min(WatchRecord.start_date).label("started_at"),
        )
        .join(WatchRecord, WatchRecord.watch_item_id == WatchItem.id)
        .where(
            WatchRecord.user_id == current_user.id,
            WatchRecord.start_date.isnot(None),
            WatchRecord.end_date.is_(None),
        )
        .group_by(WatchItem.tmdb_id, WatchItem.media_type, WatchItem.title, WatchItem.poster_path)
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        CurrentlyWatchingResponse(
            tmdb_id=row.tmdb_id,
            media_type=row.media_type,
            title=row.title,
            poster_path=row.poster_path,
            started_at=row.started_at,
        )
        for row in rows
    ]


@router.delete("/me/watching/{tmdb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def stop_watching_globally(
    tmdb_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Stop watching a title globally — closes all open WatchRecords for this
    tmdb_id across every list the current user has records in."""
    # Find all open records for this user + tmdb_id
    open_records_query = (
        select(WatchRecord)
        .join(WatchItem, WatchRecord.watch_item_id == WatchItem.id)
        .where(
            WatchItem.tmdb_id == tmdb_id,
            WatchRecord.user_id == current_user.id,
            WatchRecord.start_date.isnot(None),
            WatchRecord.end_date.is_(None),
        )
    )
    result = await db.execute(open_records_query)
    records = result.scalars().all()

    if not records:
        raise HTTPException(status_code=404, detail="No active watching session found")

    today = date.today()
    for record in records:
        record.end_date = today
        db.add(record)


@router.get("/me/history", response_model=list[WatchHistoryItem])
async def watch_history(
    media_type: str | None = Query(None, description="Filter by 'movie' or 'tv'"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WatchHistoryItem]:
    """Return every title the current user has a WatchRecord for, de-duped by
    tmdb_id.  Includes watch_count, last_watched, currently_watching, and the
    best available rating."""

    # Completed-watch stats per tmdb_id
    completed = (
        select(
            WatchItem.tmdb_id,
            func.count(WatchRecord.id).label("watch_count"),
            func.max(WatchRecord.end_date).label("last_watched"),
        )
        .join(WatchRecord, WatchRecord.watch_item_id == WatchItem.id)
        .where(
            WatchRecord.user_id == current_user.id,
            WatchRecord.end_date.isnot(None),
        )
        .group_by(WatchItem.tmdb_id)
        .subquery()
    )

    # Currently-watching flag per tmdb_id
    active = (
        select(WatchItem.tmdb_id)
        .join(WatchRecord, WatchRecord.watch_item_id == WatchItem.id)
        .where(
            WatchRecord.user_id == current_user.id,
            WatchRecord.start_date.isnot(None),
            WatchRecord.end_date.is_(None),
        )
        .distinct()
        .subquery()
    )

    # Best rating per tmdb_id (from any list)
    best_rating = (
        select(
            WatchItem.tmdb_id,
            func.max(WatchItem.rating).label("rating"),
        )
        .where(WatchItem.rating.isnot(None))
        .group_by(WatchItem.tmdb_id)
        .subquery()
    )

    # All distinct tmdb_ids the user has ANY record for
    all_items = (
        select(
            WatchItem.tmdb_id,
            WatchItem.media_type,
            func.max(WatchItem.title).label("title"),
            func.max(WatchItem.poster_path).label("poster_path"),
            func.max(WatchItem.overview).label("overview"),
            func.max(WatchItem.release_year).label("release_year"),
        )
        .join(WatchRecord, WatchRecord.watch_item_id == WatchItem.id)
        .where(WatchRecord.user_id == current_user.id)
        .group_by(WatchItem.tmdb_id, WatchItem.media_type)
        .subquery()
    )

    query = (
        select(
            all_items.c.tmdb_id,
            all_items.c.media_type,
            all_items.c.title,
            all_items.c.poster_path,
            all_items.c.overview,
            all_items.c.release_year,
            completed.c.watch_count,
            completed.c.last_watched,
            active.c.tmdb_id.label("is_active"),
            best_rating.c.rating,
        )
        .outerjoin(completed, all_items.c.tmdb_id == completed.c.tmdb_id)
        .outerjoin(active, all_items.c.tmdb_id == active.c.tmdb_id)
        .outerjoin(best_rating, all_items.c.tmdb_id == best_rating.c.tmdb_id)
    )

    if media_type in ("movie", "tv"):
        query = query.where(all_items.c.media_type == media_type)

    # Currently watching first, then most-recently watched
    query = query.order_by(
        active.c.tmdb_id.is_(None).asc(),
        completed.c.last_watched.desc().nullslast(),
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        WatchHistoryItem(
            tmdb_id=row.tmdb_id,
            media_type=row.media_type,
            title=row.title,
            poster_path=row.poster_path,
            overview=row.overview,
            release_year=row.release_year,
            watch_count=row.watch_count or 0,
            last_watched=row.last_watched,
            currently_watching=row.is_active is not None,
            rating=row.rating,
        )
        for row in rows
    ]

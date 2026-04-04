"""Naive recommendation service — top 3 per list by last watched ASC."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.watchlist import WatchList, WatchListAccess
from app.models.watch_item import WatchItem, WatchRecord


async def get_recommendations(
    user_id: str, db: AsyncSession
) -> list[dict]:
    """
    Return the top 3 'what to watch next' items per accessible watchlist.

    Logic:
    - For each watchlist the user can access:
      - If is_rewatch: consider all items, sort by latest end_date ASC (nulls first).
      - If not is_rewatch: consider only items with no completed watch record,
        sort by created_at ASC.
      - Take the top 3.
    """
    # Get all watchlists the user has access to
    access_result = await db.execute(
        select(WatchListAccess.watchlist_id).where(
            WatchListAccess.user_id == user_id
        )
    )
    watchlist_ids = [row[0] for row in access_result.all()]

    if not watchlist_ids:
        return []

    recommendations = []

    for wl_id in watchlist_ids:
        # Fetch the watchlist
        wl_result = await db.execute(
            select(WatchList).where(WatchList.id == wl_id)
        )
        watchlist = wl_result.scalar_one_or_none()
        if not watchlist:
            continue

        # Subquery: latest end_date per watch_item
        latest_watch = (
            select(
                WatchRecord.watch_item_id,
                func.max(WatchRecord.end_date).label("last_watched"),
            )
            .group_by(WatchRecord.watch_item_id)
            .subquery()
        )

        if watchlist.is_rewatch:
            # All items, sorted by last watched ASC (nulls first = never watched)
            query = (
                select(WatchItem)
                .outerjoin(latest_watch, WatchItem.id == latest_watch.c.watch_item_id)
                .where(WatchItem.watchlist_id == wl_id)
                .order_by(latest_watch.c.last_watched.asc().nullsfirst())
                .limit(3)
            )
        else:
            # Only unwatched items (no watch record with end_date)
            watched_ids = (
                select(WatchRecord.watch_item_id)
                .where(WatchRecord.end_date.isnot(None))
                .distinct()
                .subquery()
            )
            query = (
                select(WatchItem)
                .where(
                    WatchItem.watchlist_id == wl_id,
                    WatchItem.id.notin_(select(watched_ids)),
                )
                .order_by(WatchItem.created_at.asc())
                .limit(3)
            )

        items_result = await db.execute(query)
        items = items_result.scalars().all()

        if items:
            recommendations.append(
                {
                    "watchlist_id": watchlist.id,
                    "watchlist_name": watchlist.name,
                    "items": items,
                }
            )

    return recommendations

"""Recommendations router — naive 'what to watch next' endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.watch_item import RecommendationResponse, WatchItemResponse
from app.services.auth import get_current_user
from app.services.recommendations import get_recommendations

router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.get("", response_model=list[RecommendationResponse])
async def recommend(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get naive recommendations across all accessible watchlists.

    Returns top 3 items per list, sorted by 'least recently watched'.
    """
    raw = await get_recommendations(current_user.id, db)

    results = []
    for entry in raw:
        items = []
        for item in entry["items"]:
            items.append(
                WatchItemResponse(
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
                )
            )
        results.append(
            RecommendationResponse(
                watchlist_id=entry["watchlist_id"],
                watchlist_name=entry["watchlist_name"],
                items=items,
            )
        )

    return results

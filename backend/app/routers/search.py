"""Search router — TMDB search proxy."""

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.models.user import User
from app.services.auth import get_current_user
from app.services.tmdb import tmdb_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search_media(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Search TMDB for movies and TV shows."""
    results = await tmdb_service.search_multi(query=q, page=page)

    # Filter to only movie and tv results, enrich with full poster URLs
    filtered = []
    for item in results.get("results", []):
        if item.get("media_type") not in ("movie", "tv"):
            continue
        item["poster_url"] = tmdb_service.poster_url(item.get("poster_path"))
        filtered.append(item)

    return {
        "page": results.get("page", 1),
        "total_pages": results.get("total_pages", 1),
        "total_results": results.get("total_results", 0),
        "results": filtered,
    }


@router.get("/movie/{movie_id}")
async def get_movie_details(
    movie_id: int,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get detailed movie info from TMDB."""
    data = await tmdb_service.get_movie(movie_id)
    data["poster_url"] = tmdb_service.poster_url(data.get("poster_path"))
    return data


@router.get("/tv/{tv_id}")
async def get_tv_details(
    tv_id: int,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get detailed TV show info from TMDB."""
    data = await tmdb_service.get_tv(tv_id)
    data["poster_url"] = tmdb_service.poster_url(data.get("poster_path"))
    return data

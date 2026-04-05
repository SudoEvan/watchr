"""Watch item and watch record schemas."""

from datetime import date, datetime

from pydantic import BaseModel


class WatchItemCreate(BaseModel):
    tmdb_id: int
    media_type: str  # movie or tv
    title: str
    poster_path: str | None = None
    overview: str | None = None
    release_year: int | None = None


class WatchItemResponse(BaseModel):
    id: str
    watchlist_id: str
    tmdb_id: int
    media_type: str
    title: str
    poster_path: str | None
    overview: str | None
    release_year: int | None
    added_by: str
    sort_order: int
    created_at: datetime
    last_watched: date | None = None
    watch_count: int = 0
    currently_watching: bool = False
    active_record_id: str | None = None
    rating: float | None = None
    rated_by: str | None = None

    model_config = {"from_attributes": True}


class RatingUpdate(BaseModel):
    rating: float  # 0.5 to 5, in 0.5 increments


class WatchRecordCreate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class WatchRecordUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


class WatchRecordResponse(BaseModel):
    id: str
    watch_item_id: str
    user_id: str
    start_date: date | None
    end_date: date | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CurrentlyWatchingResponse(BaseModel):
    tmdb_id: int
    media_type: str
    title: str
    poster_path: str | None
    started_at: date | None = None


class WatchHistoryItem(BaseModel):
    tmdb_id: int
    media_type: str
    title: str
    poster_path: str | None
    overview: str | None
    release_year: int | None
    watch_count: int = 0
    last_watched: date | None = None
    currently_watching: bool = False
    rating: float | None = None


class RecommendationResponse(BaseModel):
    watchlist_id: str
    watchlist_name: str
    items: list[WatchItemResponse]

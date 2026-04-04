"""Watchlist schemas."""

from datetime import datetime

from pydantic import BaseModel


class WatchListCreate(BaseModel):
    name: str
    description: str | None = None
    is_rewatch: bool = False


class WatchListUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_rewatch: bool | None = None


class WatchListResponse(BaseModel):
    id: str
    name: str
    description: str | None
    is_rewatch: bool
    created_at: datetime
    updated_at: datetime
    role: str | None = None
    is_favorite: bool = False
    item_count: int = 0

    model_config = {"from_attributes": True}


class WatchListAccessCreate(BaseModel):
    user_id: str
    role: str  # manager or viewer


class WatchListAccessResponse(BaseModel):
    id: str
    watchlist_id: str
    user_id: str
    role: str
    user_display_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WatchListTransfer(BaseModel):
    new_owner_id: str

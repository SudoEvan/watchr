"""WatchList, WatchListAccess, and WatchListFavorite models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WatchList(Base):
    __tablename__ = "watchlists"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    is_rewatch: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    access_list: Mapped[list["WatchListAccess"]] = relationship(
        "WatchListAccess", back_populates="watchlist", cascade="all, delete-orphan"
    )
    favorites: Mapped[list["WatchListFavorite"]] = relationship(
        "WatchListFavorite", back_populates="watchlist", cascade="all, delete-orphan"
    )
    items: Mapped[list["WatchItem"]] = relationship(
        "WatchItem", back_populates="watchlist", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<WatchList {self.name}>"


class WatchListAccess(Base):
    __tablename__ = "watchlist_access"
    __table_args__ = (
        UniqueConstraint("watchlist_id", "user_id", name="uq_watchlist_user"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    watchlist_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # owner, manager, viewer
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    watchlist: Mapped["WatchList"] = relationship(
        "WatchList", back_populates="access_list"
    )
    user: Mapped["User"] = relationship("User", back_populates="watchlist_access")

    def __repr__(self) -> str:
        return f"<WatchListAccess {self.user_id} -> {self.watchlist_id} ({self.role})>"


class WatchListFavorite(Base):
    __tablename__ = "watchlist_favorites"
    __table_args__ = (
        UniqueConstraint("watchlist_id", "user_id", name="uq_favorite_watchlist_user"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    watchlist_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    watchlist: Mapped["WatchList"] = relationship(
        "WatchList", back_populates="favorites"
    )
    user: Mapped["User"] = relationship("User", back_populates="favorites")

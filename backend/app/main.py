"""Watchr API — FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import async_session, init_db, migrate_db
from app.models.user import User
from app.routers import auth, recommend, search, users, watch_items, watchlists
from app.services.auth import hash_password


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup, seed dev user if needed."""
    await init_db()
    await migrate_db()
    if settings.app_env == "development":
        await _seed_dev_user()
    yield


async def _seed_dev_user() -> None:
    """Create a default dev user if it doesn't already exist."""
    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == "dev"))
        if result.scalar_one_or_none() is None:
            session.add(
                User(
                    username="dev",
                    email="dev@watchr.local",
                    hashed_password=hash_password("dev"),
                    display_name="Dev User",
                )
            )
            await session.commit()


app = FastAPI(
    title="Watchr API",
    description="Self-hosted watchlist management API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers under /api/v1
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(watchlists.router, prefix=API_PREFIX)
app.include_router(watch_items.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(recommend.router, prefix=API_PREFIX)


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

"""Async SQLAlchemy engine and session factory."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    connect_args={"check_same_thread": False},  # Required for SQLite
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


async def get_db() -> AsyncSession:
    """Dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables. Used for initial setup / development."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def migrate_db() -> None:
    """Run lightweight column migrations for SQLite (no Alembic)."""
    async with engine.begin() as conn:
        # Collect existing columns per table
        import sqlalchemy

        def _migrate(connection):
            inspector = sqlalchemy.inspect(connection)
            for table in Base.metadata.sorted_tables:
                existing = {c["name"] for c in inspector.get_columns(table.name)}
                for col in table.columns:
                    if col.name not in existing:
                        col_type = col.type.compile(connection.dialect)
                        connection.execute(
                            sqlalchemy.text(
                                f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}"
                            )
                        )

        await conn.run_sync(_migrate)

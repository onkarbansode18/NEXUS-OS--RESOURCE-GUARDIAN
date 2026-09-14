"""
Nexus DB — async session factory and engine.
Swapping to Postgres: change DATABASE_URL in .env — nothing else changes.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from .models import Base

# ── Engine ────────────────────────────────────────────────────────────────────
# connect_args only applies to SQLite (needed to allow multiple threads)
_connect_args = {"check_same_thread": False} if "sqlite" in settings.database_url else {}

engine = create_async_engine(
    settings.database_url,
    connect_args=_connect_args,
    echo=settings.debug,        # logs SQL in dev; disable in prod
    future=True,
)

# ── Session factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Startup: create tables ────────────────────────────────────────────────────
async def init_db() -> None:
    """Create all tables (idempotent — safe to call on every startup)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_default_policy()


async def _seed_default_policy() -> None:
    """Insert the default policy row if it doesn't exist yet."""
    from .models import PolicyRecord
    async with AsyncSessionLocal() as session:
        existing = await session.get(PolicyRecord, 1)
        if existing is None:
            session.add(PolicyRecord(id=1))
            await session.commit()


# ── Dependency injection helper (for FastAPI) ─────────────────────────────────
async def get_db() -> AsyncSession:
    """
    FastAPI dependency — yields an AsyncSession and commits / rolls back.
    Usage:
        @router.get("/...")
        async def handler(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

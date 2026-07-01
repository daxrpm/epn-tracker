"""Integration test harness: in-memory SQLite database and a fake Redis.

The app is exercised through an ASGI transport so every request goes through the real routing,
dependencies and exception handlers.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import fakeredis.aioredis
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.db import get_db
from app.database.models import Base as _ModelsBase  # noqa: F401  (registers every model)
from app.main import app


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession]:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        yield session


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch) -> fakeredis.aioredis.FakeRedis:
    """Replace the shared Redis client everywhere it is imported."""
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr("app.database.redis.redis_client", client)
    monkeypatch.setattr("app.core.rate_limit.redis_client", client)
    monkeypatch.setattr("app.modules.iam.service.redis_client", client)
    monkeypatch.setattr("app.modules.iam.token_store.redis_client", client)
    return client


@pytest_asyncio.fixture
async def client(db_engine) -> AsyncGenerator[AsyncClient]:
    factory = async_sessionmaker(db_engine, expire_on_commit=False, autoflush=False)

    async def _override_get_db() -> AsyncGenerator[AsyncSession]:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

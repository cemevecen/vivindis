"""Async SQLAlchemy engine ve oturum fabrikası."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


class DatabaseConfigurationError(RuntimeError):
    """DATABASE_URL tanımlı değilken DB kullanılmak istendiğinde."""


@lru_cache
def get_async_engine() -> AsyncEngine:
    url = get_settings().database_url.strip()
    if not url:
        raise DatabaseConfigurationError(
            "DATABASE_URL ortam değişkeni tanımlı değil; async engine oluşturulamıyor.",
        )
    return create_async_engine(
        url,
        connect_args={"statement_cache_size": 0},
        pool_pre_ping=True,
        echo=get_settings().database_echo,
    )


@lru_cache
def get_async_session_maker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        get_async_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: istek sonunda başarılıysa commit, aksi halde rollback."""
    factory = get_async_session_maker()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

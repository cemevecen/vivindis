"""Async SQLAlchemy engine ve oturum fabrikası.

Railway → Supabase: IPv4 egress bazen doğrudan Postgres (5432) için
``Network is unreachable`` verir. Supabase **Transaction pooler** bağlantı dizesini
kullanın (genelde port **6543**, ``pgbouncer`` / ``pooler`` host).
``DATABASE_URL`` ortam değişkeninde bu URL'yi ayarlayın.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.exc import OperationalError
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


def _is_transient_connect_failure(exc: BaseException) -> bool:
    """IPv4 routing / geçici ağ kopması gibi yeniden denemeye uygun bağlantı hataları."""
    if isinstance(exc, OSError):
        return exc.errno in (101, 113)  # Network unreachable, No route to host
    if isinstance(exc, OperationalError):
        cause = exc.__cause__ or exc.orig
        if isinstance(cause, OSError):
            return cause.errno in (101, 113)
    cause = getattr(exc, "__cause__", None)
    if isinstance(cause, OSError):
        return cause.errno in (101, 113)
    return False


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: istek sonunda başarılıysa commit, aksi halde rollback.

    İlk oturum açılışında geçici ``OSError`` (ör. errno 101) için sınırlı yeniden deneme.
    """
    factory = get_async_session_maker()
    max_attempts = 5
    base_delay_s = 0.12

    for attempt in range(max_attempts):
        try:
            async with factory() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise
            return
        except (OSError, OperationalError) as exc:
            if attempt >= max_attempts - 1 or not _is_transient_connect_failure(exc):
                raise
            await asyncio.sleep(base_delay_s * (2**attempt))

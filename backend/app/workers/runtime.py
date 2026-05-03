"""Celery (sync) içinden async SQLAlchemy oturumu çalıştırma."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


async def _session_wrapped(
    coro: Callable[..., Awaitable[T]],
    *args: object,
    **kwargs: object,
) -> T:
    from app.db.session import get_async_session_maker

    factory = get_async_session_maker()
    async with factory() as session:
        try:
            result = await coro(session, *args, **kwargs)
            await session.commit()
            return result
        except Exception:
            await session.rollback()
            raise


def run_async_db(
    coro: Callable[..., Awaitable[T]],
    *args: object,
    **kwargs: object,
) -> T:
    """Async fonksiyonu yeni event loop ile çalıştırır ve tek transaction commit eder."""
    return asyncio.run(_session_wrapped(coro, *args, **kwargs))


def run_async(coro: Awaitable[T]) -> T:
    """Düz coroutine (session dışı) için."""
    return asyncio.run(coro)

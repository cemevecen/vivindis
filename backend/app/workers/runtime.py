"""Celery (sync) içinden async SQLAlchemy oturumu çalıştırma."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")
_loop: asyncio.AbstractEventLoop | None = None


def _get_persistent_loop() -> asyncio.AbstractEventLoop:
    global _loop
    if _loop is None or _loop.is_closed():
        try:
            _loop = asyncio.get_running_loop()
        except RuntimeError:
            _loop = asyncio.new_event_loop()
            asyncio.set_event_loop(_loop)
    return _loop


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
    """Async fonksiyonu kalıcı event loop ile çalıştırır ve tek transaction commit eder."""
    return _get_persistent_loop().run_until_complete(_session_wrapped(coro, *args, **kwargs))


def run_async(coro: Awaitable[T]) -> T:
    """Düz coroutine (session dışı) için kalıcı loop."""
    return _get_persistent_loop().run_until_complete(coro)

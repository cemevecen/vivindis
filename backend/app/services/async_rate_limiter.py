"""Async token-bucket rate limiter — insan benzeri istek ritmi."""

from __future__ import annotations

import asyncio
import time


class AsyncTokenBucketRateLimiter:
    """Saniyede en fazla `rate_per_second` izin verir; `burst` kadar kısa patlama."""

    def __init__(self, rate_per_second: float, burst: float | None = None) -> None:
        if rate_per_second <= 0:
            msg = "rate_per_second must be positive"
            raise ValueError(msg)
        self._rate = float(rate_per_second)
        self._burst = float(burst) if burst is not None else max(1.0, self._rate)
        self._tokens = self._burst
        self._last = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, cost: float = 1.0) -> None:
        if cost <= 0:
            return
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self._last
                self._last = now
                self._tokens = min(self._burst, self._tokens + elapsed * self._rate)
                if self._tokens >= cost:
                    self._tokens -= cost
                    return
                deficit = cost - self._tokens
                await asyncio.sleep(deficit / self._rate)

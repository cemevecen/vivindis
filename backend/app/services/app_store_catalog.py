"""App Store katalog araması (çoklu sonuç).

PyPI ``app-store-scraper`` paketi tekil uygulama + yorum API’si sunar; mağaza
**arama listesi** için Apple iTunes Search kullanılır. Worker ile aynı bağımlılık
ailesinde kalınması için bu modül ``search(q, lang, country, num)`` imzasını
sağlar (içeride ``httpx``).
"""

from __future__ import annotations

from typing import Any

import httpx

_ITUNES_SEARCH = "https://itunes.apple.com/search"


async def search(
    q: str,
    lang: str,
    country: str,
    num: int = 20,
    *,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """iTunes Search API — ``lang`` şimdilik yanıtta yerelleştirme için saklanır (isteğe bağlı genişletme)."""
    _ = lang
    lim = max(1, min(num, 200))
    off = max(0, min(offset, 10_000))
    params = {
        "term": q,
        "entity": "software",
        "limit": str(lim),
        "offset": str(off),
        "country": country.lower(),
    }
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.get(_ITUNES_SEARCH, params=params)
        res.raise_for_status()
        data = res.json()
    return list(data.get("results") or [])

"""Mağaza arama — Google Play + App Store katalog.

Google Play: ``google-play-scraper``.

App Store **çoklu arama sonucu** için Apple’ın resmi iTunes Search API’si kullanılır
(``httpx``). PyPI ``app-store-scraper`` paketi tekil uygulama + yorum akışına yöneliktir
(``app.workers.scraper``); çoklu anahtar kelime listesi sunmaz.
"""

from __future__ import annotations

import asyncio
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.store_search import StoreSearchResponse, StoreSearchResultItem

router = APIRouter(prefix="/store", tags=["store"])

_ITUNES_SEARCH = "https://itunes.apple.com/search"


def _google_play_search_sync(query: str, lang: str, country: str) -> list[StoreSearchResultItem]:
    from google_play_scraper import search as gp_search

    raw = gp_search(query, n_hits=30, lang=lang, country=country)
    out: list[StoreSearchResultItem] = []
    for row in raw:
        app_id = str(row.get("appId") or "").strip()
        if not app_id:
            continue
        score = row.get("score")
        out.append(
            StoreSearchResultItem(
                id=app_id,
                name=str(row.get("title") or app_id).strip() or app_id,
                developer=(str(row["developer"]).strip() if row.get("developer") else None),
                icon=(str(row["icon"]).strip() if row.get("icon") else None),
                rating=float(score) if isinstance(score, (int, float)) else None,
                reviews=None,
                platform="google_play",
            ),
        )
    return out


async def _app_store_search_itunes(query: str, country: str) -> list[StoreSearchResultItem]:
    params = {"term": query, "entity": "software", "limit": "30", "country": country.lower()}
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.get(_ITUNES_SEARCH, params=params)
        res.raise_for_status()
        data = res.json()
    out: list[StoreSearchResultItem] = []
    for row in data.get("results") or []:
        tid = row.get("trackId")
        if tid is None:
            continue
        bid = str(tid).strip()
        name = str(row.get("trackName") or bid).strip()
        rating = row.get("averageUserRating")
        reviews_raw = row.get("userRatingCount")
        reviews = int(reviews_raw) if isinstance(reviews_raw, int) else None
        out.append(
            StoreSearchResultItem(
                id=bid,
                name=name or bid,
                developer=(str(row["artistName"]).strip() if row.get("artistName") else None),
                icon=(str(row["artworkUrl100"]).strip() if row.get("artworkUrl100") else None),
                rating=float(rating) if isinstance(rating, (int, float)) else None,
                reviews=reviews,
                platform="app_store",
            ),
        )
    return out


@router.get("/search", response_model=StoreSearchResponse)
async def search_stores(
    current_user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str, Query(min_length=2, max_length=200)],
    platform: Annotated[str, Query(pattern="^(google_play|app_store)$")],
    lang: Annotated[str, Query(min_length=2, max_length=8)] = "tr",
    country: Annotated[str, Query(min_length=2, max_length=8)] = "tr",
) -> StoreSearchResponse:
    """Google Play veya App Store kataloğunda uygulama arar."""
    _ = current_user
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query too short.")

    if platform == "google_play":
        try:
            rows = await asyncio.to_thread(_google_play_search_sync, query, lang, country)
            return StoreSearchResponse(results=rows)
        except Exception as exc:  # noqa: BLE001 — mağaza yanıtı öngörülemez
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google Play araması başarısız.",
            ) from exc

    try:
        rows = await _app_store_search_itunes(query, country)
        return StoreSearchResponse(results=rows)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="App Store araması başarısız.",
        ) from exc

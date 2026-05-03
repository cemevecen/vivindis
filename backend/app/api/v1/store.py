"""Mağaza arama (Play / iTunes) — uygulama ekleme öncesi keşif."""

from __future__ import annotations

import asyncio
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.store_search import StoreSearchHit

router = APIRouter(prefix="/store", tags=["store"])

_ITUNES_SEARCH = "https://itunes.apple.com/search"


def _google_play_search_sync(query: str, lang: str, country: str) -> list[StoreSearchHit]:
    from google_play_scraper import search as gp_search

    raw = gp_search(query, n_hits=30, lang=lang, country=country)
    out: list[StoreSearchHit] = []
    for row in raw:
        app_id = str(row.get("appId") or "").strip()
        if not app_id:
            continue
        score = row.get("score")
        out.append(
            StoreSearchHit(
                store="google_play",
                package_name=app_id,
                bundle_id=None,
                name=str(row.get("title") or app_id).strip() or app_id,
                icon_url=(str(row["icon"]).strip() if row.get("icon") else None),
                developer=(str(row["developer"]).strip() if row.get("developer") else None),
                category=(str(row["genre"]).strip() if row.get("genre") else None),
                score=float(score) if isinstance(score, (int, float)) else None,
            ),
        )
    return out


async def _app_store_search_http(query: str, country: str) -> list[StoreSearchHit]:
    params = {"term": query, "entity": "software", "limit": "30", "country": country.lower()}
    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.get(_ITUNES_SEARCH, params=params)
        res.raise_for_status()
        data = res.json()
    out: list[StoreSearchHit] = []
    for row in data.get("results") or []:
        tid = row.get("trackId")
        if tid is None:
            continue
        bid = str(tid).strip()
        name = str(row.get("trackName") or bid).strip()
        rating = row.get("averageUserRating")
        out.append(
            StoreSearchHit(
                store="app_store",
                package_name="",
                bundle_id=bid,
                name=name or bid,
                icon_url=(str(row["artworkUrl100"]).strip() if row.get("artworkUrl100") else None),
                developer=(str(row["artistName"]).strip() if row.get("artistName") else None),
                category=(str(row["primaryGenreName"]).strip() if row.get("primaryGenreName") else None),
                score=float(rating) if isinstance(rating, (int, float)) else None,
            ),
        )
    return out


@router.get("/search", response_model=list[StoreSearchHit])
async def search_stores(
    current_user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str, Query(min_length=2, max_length=200)],
    platform: Annotated[str, Query(pattern="^(google_play|app_store)$")],
    lang: Annotated[str, Query(min_length=2, max_length=8)] = "tr",
    country: Annotated[str, Query(min_length=2, max_length=8)] = "tr",
) -> list[StoreSearchHit]:
    """Google Play veya App Store (iTunes Search API) ile uygulama arar."""
    _ = current_user
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query too short.")

    if platform == "google_play":
        try:
            return await asyncio.to_thread(_google_play_search_sync, query, lang, country)
        except Exception as exc:  # noqa: BLE001 — mağaza yanıtı öngörülemez
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google Play araması başarısız.",
            ) from exc

    try:
        return await _app_store_search_http(query, country)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="App Store araması başarısız.",
        ) from exc

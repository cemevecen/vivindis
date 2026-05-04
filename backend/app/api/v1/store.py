"""Mağaza arama — Google Play + App Store katalog.

- Google Play: ``google_play_scraper.search`` (``n_hits`` = istenen ``num``).
- App Store listesi: ``app.services.app_store_catalog.search`` → Apple iTunes Search
  (``httpx``). PyPI ``app-store-scraper`` tekil uygulama/yorum içindir (worker).
"""

from __future__ import annotations

import asyncio
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.store_search import StoreSearchResponse, StoreSearchResultItem
from app.services import app_store_catalog

log = get_logger(__name__)
router = APIRouter(prefix="/store", tags=["store"])


def _play_store_url(package_name: str) -> str:
    return f"https://play.google.com/store/apps/details?id={package_name}"


def _app_store_url(country: str, track_id: str, fallback: str | None) -> str:
    if fallback and fallback.startswith("http"):
        return fallback
    cc = country.lower()
    return f"https://apps.apple.com/{cc}/app/id{track_id}"


def _google_play_fetch_raw(query: str, lang: str, country: str, num: int) -> list[dict[str, Any]]:
    """google_play_scraper.search — boş liste veya satır listesi; None olmaz."""
    from google_play_scraper import search as gp_search

    raw = gp_search(query, n_hits=num, lang=lang, country=country)
    if raw is None:
        return []
    return raw


def _google_play_rows_from_raw(raw: list[dict[str, Any]]) -> list[StoreSearchResultItem]:
    """Satır bazlı try/except: Google HTML değişince tek kötü satır tüm aramayı düşürmez."""
    out: list[StoreSearchResultItem] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        try:
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
                    review_count=None,
                    platform="google_play",
                    store_url=_play_store_url(app_id),
                ),
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("google_play_row_parse_failed", error=repr(exc))
    return out


def _google_play_search_sync(query: str, lang: str, country: str, num: int) -> list[StoreSearchResultItem]:
    """Önce istenen dil/ülke; hata veya parse edilemeyen yanıtta en/us (Play şablonu / IP farkları)."""
    attempts: list[tuple[str, str]] = [(lang, country)]
    if (lang, country) != ("en", "us"):
        attempts.append(("en", "us"))

    last_exc: BaseException | None = None
    for attempt_lang, attempt_country in attempts:
        try:
            raw = _google_play_fetch_raw(query, attempt_lang, attempt_country, num)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            log.warning(
                "google_play_search_failed",
                query=query[:80],
                lang=attempt_lang,
                country=attempt_country,
                error=repr(exc),
            )
            continue
        items = _google_play_rows_from_raw(raw)
        if items or not raw:
            return items

    if last_exc is not None:
        raise last_exc
    return []


def _itunes_row_to_item(row: dict[str, Any], country: str) -> StoreSearchResultItem | None:
    tid = row.get("trackId")
    if tid is None:
        return None
    bid = str(tid).strip()
    name = str(row.get("trackName") or bid).strip()
    rating = row.get("averageUserRating")
    reviews_raw = row.get("userRatingCount")
    review_count = int(reviews_raw) if isinstance(reviews_raw, int) else None
    view = row.get("trackViewUrl")
    view_s = str(view).strip() if isinstance(view, str) else None
    return StoreSearchResultItem(
        id=bid,
        name=name or bid,
        developer=(str(row["artistName"]).strip() if row.get("artistName") else None),
        icon=(str(row["artworkUrl100"]).strip() if row.get("artworkUrl100") else None),
        rating=float(rating) if isinstance(rating, (int, float)) else None,
        review_count=review_count,
        platform="app_store",
        store_url=_app_store_url(country, bid, view_s),
    )


async def _app_store_search_async(query: str, lang: str, country: str, num: int) -> list[StoreSearchResultItem]:
    raw_rows = await app_store_catalog.search(query, lang, country, num=num)
    out: list[StoreSearchResultItem] = []
    for row in raw_rows:
        item = _itunes_row_to_item(row, country)
        if item is not None:
            out.append(item)
    return out


@router.get("/search", response_model=StoreSearchResponse)
async def search_stores(
    current_user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str, Query(min_length=2, max_length=200)],
    platform: Annotated[str, Query(pattern="^(google_play|app_store|both)$")],
    lang: Annotated[str, Query(min_length=2, max_length=8)] = "tr",
    country: Annotated[str, Query(min_length=2, max_length=8)] = "tr",
    num: Annotated[int, Query(ge=1, le=50)] = 20,
) -> StoreSearchResponse:
    """Google Play, App Store veya her ikisinde uygulama arar."""
    _ = current_user
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query too short.")

    if platform == "google_play":
        try:
            rows = await asyncio.to_thread(_google_play_search_sync, query, lang, country, num)
            return StoreSearchResponse(results=rows)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google Play araması başarısız.",
            ) from exc

    if platform == "app_store":
        try:
            rows = await _app_store_search_async(query, lang, country, num)
            return StoreSearchResponse(results=rows)
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="App Store araması başarısız.",
            ) from exc

    try:
        gp_task = asyncio.to_thread(_google_play_search_sync, query, lang, country, num)
        as_task = _app_store_search_async(query, lang, country, num)
        gp_rows, as_rows = await asyncio.gather(gp_task, as_task)
        return StoreSearchResponse(results=list(gp_rows) + list(as_rows))
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="App Store araması başarısız.",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Mağaza araması başarısız.",
        ) from exc

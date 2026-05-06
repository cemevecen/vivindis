"""Play / App Store yorum çekme (Celery `scraper` kuyruğu)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, date, datetime, time as dt_time
from typing import Any

from google_play_scraper import Sort
from google_play_scraper import reviews as gp_reviews
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import selectinload

from app.core.celery import celery_app
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.app import App
from app.models.enums import AnalysisStatus, AnalysisType, AppPlatform, FetchStatus, StorePlatform
from app.models.analysis import Analysis
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.workers.runtime import run_async_db

log = get_logger(__name__)


class VivindisAppStoreImportError(ImportError):
    """app_store_scraper yüklenemedi."""


def _load_app_store_class() -> type:
    try:
        import urllib3
        import urllib3.util.ssl_

        if not hasattr(urllib3.util.ssl_, "DEFAULT_CIPHERS"):
            urllib3.util.ssl_.DEFAULT_CIPHERS = "DEFAULT"

        from app_store_scraper import AppStore as _AppStore
    except ImportError as exc:
        raise VivindisAppStoreImportError(
            "app_store_scraper bağımlılığı yüklenemedi (requests/urllib3 uyumu).",
        ) from exc

    class VivindisAppStore(_AppStore):
        def _parse_data(self, after: datetime | None) -> None:
            if not hasattr(self, "_vivindis_stop"):
                self._vivindis_stop = False
            if self._vivindis_stop:
                return

            response = self._response.json()
            for data in response["data"]:
                review = dict(data["attributes"])
                review["_vivindis_review_id"] = str(data.get("id", ""))
                review["date"] = datetime.strptime(review["date"], "%Y-%m-%dT%H:%M:%SZ")
                if after and review["date"] < after:
                    self._vivindis_stop = True
                    break
                self.reviews.append(review)
                self.reviews_count += 1
                self._fetched_count += 1

    return VivindisAppStore


def _dmin(d: date) -> datetime:
    return datetime.combine(d, dt_time.min, tzinfo=UTC)


def _dmax(d: date) -> datetime:
    return datetime.combine(d, dt_time.max, tzinfo=UTC)


def _in_range(at: datetime | None, lo: date, hi: date) -> bool:
    if at is None:
        return False
    if at.tzinfo is None:
        at = at.replace(tzinfo=UTC)
    ad = at.date()
    return lo <= ad <= hi


def _calendar_span_days(lo: date, hi: date) -> int:
    """Tarih penceresinin takvim günü genişliği (uçlar dahil, `hi - lo`)."""
    return max(0, (hi - lo).days)


def _play_batch_sleep_for_window(base: float, lo: date, hi: date) -> float:
    _ = (base, lo, hi)
    return 0.0


def _app_store_sleep_for_window(base: int, lo: date, hi: date) -> int:
    _ = (base, lo, hi)
    return 0


async def _upsert_review(
    session: Any,
    *,
    app_id: uuid.UUID,
    fetch_id: uuid.UUID,
    platform: StorePlatform,
    store_review_id: str,
    rating: int,
    title: str | None,
    body: str,
    author: str | None,
    lang: str,
    review_date: date,
    thumbs_up: int,
    developer_reply: str | None,
    reply_date: date | None,
) -> None:
    rating = max(1, min(5, int(rating)))
    stmt = (
        insert(Review)
        .values(
            app_id=app_id,
            fetch_id=fetch_id,
            store_review_id=store_review_id[:255],
            platform=platform,
            rating=rating,
            title=title[:1024] if title else None,
            body=body or "",
            author=author[:512] if author else None,
            lang=lang[:16],
            review_date=review_date,
            thumbs_up=thumbs_up,
            developer_reply=developer_reply,
            reply_date=reply_date,
        )
        .on_conflict_do_nothing(constraint="uq_reviews_platform_store_id")
    )
    await session.execute(stmt)


async def _scrape_google_play(
    session: Any,
    *,
    fetch: ReviewFetch,
    app: App,
    settings: Any,
    review_scope: str,
    app: App,
    fetch: ReviewFetch,
    review_scope: str,
    req_lang: str | None = None,
    req_country: str | None = None,
) -> int:
    settings = get_settings()
    pkg = (app.package_name or "").strip()
    if not pkg:
        log.warning("scrape_play_skip_empty_package", app_id=str(app.id))
        return 0

    PLAY_STORE_MATRIX = [
        ("tr", "tr"), ("en", "us"), ("en", "gb"), ("en", "au"), ("en", "ca"),
        ("en", "in"), ("en", "sg"), ("en", "za"), ("en", "ie"), ("en", "nz"),
        ("ar", "sa"), ("ar", "ae"), ("ar", "eg"), ("ar", "ma"),
        ("de", "de"), ("de", "at"), ("de", "ch"), ("fr", "fr"), ("fr", "be"),
        ("es", "es"), ("es", "mx"), ("it", "it"), ("nl", "nl"), ("pt", "br"),
        ("pt", "pt"), ("ru", "ru"), ("ru", "kz"), ("ru", "by"), ("uk", "ua"),
        ("ja", "jp"), ("ko", "kr"), ("zh", "tw"), ("zh", "hk"), ("id", "id"), ("th", "th")
    ]

    if review_scope == "local":
        locale_candidates = [(req_lang or "tr", req_country or "tr"), ("en", "us")]
    else:
        locale_candidates = PLAY_STORE_MATRIX

    max_inserted = int(settings.scrape_max_reviews or 10000)
    lo, hi = fetch.from_date, fetch.to_date
    total_inserted = 0
    sem = asyncio.Semaphore(15)

    async def _scrape_locale_score(lang: str, country: str, score: int):
        nonlocal total_inserted
        if total_inserted >= max_inserted:
            return 0
        inserted = 0
        continuation = None
        for page in range(1, 11):
            if total_inserted >= max_inserted:
                break
            async with sem:
                try:
                    loop = asyncio.get_event_loop()
                    batch, next_token = await loop.run_in_executor(
                        None,
                        lambda: gp_reviews(
                            pkg, lang=lang, country=country, sort=Sort.NEWEST,
                            count=200, score=score, continuation_token=continuation
                        )
                    )
                    continuation = next_token
                except Exception as exc:
                    log.warning("play_store_batch_failed", lang=lang, country=country, score=score, error=str(exc))
                    break
            if not batch:
                break
            for rev in batch:
                if total_inserted >= max_inserted:
                    break
                at = rev.get("at")
                if isinstance(at, datetime) and at.tzinfo is None:
                    at = at.replace(tzinfo=UTC)
                if at and not _in_range(at, lo, hi):
                    if at.date() < lo: return inserted
                    continue
                rid = str(rev.get("reviewId") or "")[:255]
                if not rid: continue
                await _upsert_review(
                    session, app_id=app.id, fetch_id=fetch.id,
                    platform=StorePlatform.GOOGLE_PLAY, store_review_id=rid,
                    rating=int(rev.get("score") or 0), title=None,
                    body=str(rev.get("content") or ""), author=str(rev.get("userName") or "Anon"),
                    lang=lang, review_date=at.date() if at else lo,
                    thumbs_up=int(rev.get("thumbsUpCount") or 0),
                    developer_reply=str(rev.get("replyContent")) if rev.get("replyContent") else None,
                    reply_date=rev.get("repliedAt").date() if rev.get("repliedAt") else None,
                )
                inserted += 1
                total_inserted += 1
            if not continuation or not continuation.token:
                break
        return inserted

    tasks = [_scrape_locale_score(l, c, s) for (l, c) in locale_candidates for s in [1, 2, 3, 4, 5]]
    await asyncio.gather(*tasks)
    return total_inserted


async def _scrape_app_store(
    session: Any,
    app: App,
    fetch: ReviewFetch,
    review_scope: str,
    req_lang: str | None = None,
    req_country: str | None = None,
) -> int:
    settings = get_settings()
    numeric_id = (app.bundle_id or "").strip()
    if not numeric_id:
        return 0

    APP_STORE_COUNTRIES = [
        "tr", "us", "gb", "de", "fr", "ca", "au", "it", "es", "sa", "ae", "qa", "kw", "jo", "lb", "eg", "ly", "dz", "ma", "tn",
        "ru", "kz", "uz", "tm", "kg", "cy", "gr", "ro", "bg", "pl", "hu", "cz", "se", "no", "dk", "nl", "be", "ch"
    ]

    countries = [req_country or "tr", "us"] if review_scope == "local" else APP_STORE_COUNTRIES
    max_inserted = int(settings.scrape_max_reviews or 10000)
    lo, hi = fetch.from_date, fetch.to_date
    total_inserted = 0
    sem = asyncio.Semaphore(20)

    async def _fetch_rss_page(country: str, page: int):
        nonlocal total_inserted
        if total_inserted >= max_inserted: return 0
        url = f"https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={numeric_id}/sortBy=mostRecent/json"
        async with sem:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url)
                    if resp.status_code != 200: return 0
                    data = resp.json()
            except Exception: return 0
        entries = data.get("feed", {}).get("entry", [])
        if not isinstance(entries, list): entries = [entries] if entries else []
        inserted = 0
        for entry in entries:
            if "author" not in entry or total_inserted >= max_inserted: continue
            try:
                rid = entry.get("id", {}).get("label", "")
                date_str = entry.get("updated", {}).get("label", "")
                at = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                rd = at.date()
                if not (lo <= rd <= hi): continue
                await _upsert_review(
                    session, app_id=app.id, fetch_id=fetch.id, platform=StorePlatform.APP_STORE,
                    store_review_id=rid, rating=int(entry.get("im:rating", {}).get("label", "0")),
                    title=entry.get("title", {}).get("label", ""), body=entry.get("content", {}).get("label", ""),
                    author=entry.get("author", {}).get("name", {}).get("label", "Anon"),
                    lang="und", review_date=rd,
                )
                inserted += 1
                total_inserted += 1
            except Exception: continue
        return inserted

    tasks = [_fetch_rss_page(c, p) for c in countries for p in range(1, 11)]
    await asyncio.gather(*tasks)
    return total_inserted


async def _execute_review_fetch(
    session: Any,
    fetch_id: uuid.UUID,
    review_scope: str,
    req_lang: str | None,
    req_country: str | None,
) -> tuple[list[str], list[str]]:
    res = await session.execute(
        select(ReviewFetch)
        .options(selectinload(ReviewFetch.app))
        .where(ReviewFetch.id == fetch_id),
    )
    fetch = res.scalar_one_or_none()
    if fetch is None:
        return [], []

    app = fetch.app
    fetch.status = FetchStatus.RUNNING
    fetch.started_at = datetime.now(UTC)
    fetch.error_message = None
    await session.flush()

    total_inserted = 0
    try:
        if app.platform in (AppPlatform.GOOGLE_PLAY, AppPlatform.BOTH):
            total_inserted += await _scrape_google_play(
                session,
                fetch=fetch,
                app=app,
                settings=settings,
                review_scope=review_scope,
                req_lang=req_lang,
                req_country=req_country,
            )
        if app.platform in (AppPlatform.APP_STORE, AppPlatform.BOTH):
            total_inserted += await _scrape_app_store(
                session,
                fetch=fetch,
                app=app,
                settings=settings,
                review_scope=review_scope,
                req_country=req_country,
            )

        cnt_r = await session.execute(
            select(func.count()).select_from(Review).where(Review.fetch_id == fetch.id),
        )
        fetch.review_count = int(cnt_r.scalar_one())
        fetch.status = FetchStatus.COMPLETED
        fetch.completed_at = datetime.now(UTC)
        await session.flush()
        log.info("fetch_completed", fetch_id=str(fetch_id), reviews=fetch.review_count)
    except Exception as exc:
        fetch.status = FetchStatus.FAILED
        fetch.error_message = str(exc)[:8000]
        fetch.completed_at = datetime.now(UTC)
        log.exception("fetch_failed", fetch_id=str(fetch_id))
        raise

    ar = await session.execute(select(Analysis).where(Analysis.fetch_id == fetch.id))
    existing = list(ar.scalars().all())
    if not existing:
        for atype in (AnalysisType.HEURISTIC, AnalysisType.AI):
            row = Analysis(
                app_id=fetch.app_id,
                fetch_id=fetch.id,
                type=atype,
                status=AnalysisStatus.PENDING,
            )
            session.add(row)
        await session.flush()
        ar2 = await session.execute(select(Analysis).where(Analysis.fetch_id == fetch.id))
        existing = list(ar2.scalars().all())

    heuristic_ids = [
        str(r.id)
        for r in existing
        if r.type == AnalysisType.HEURISTIC and r.status == AnalysisStatus.PENDING
    ]
    ai_ids = [
        str(r.id) for r in existing if r.type == AnalysisType.AI and r.status == AnalysisStatus.PENDING
    ]
    return heuristic_ids, ai_ids


async def _mark_fetch_failed(session: Any, fetch_id: uuid.UUID, message: str) -> None:
    res = await session.execute(select(ReviewFetch).where(ReviewFetch.id == fetch_id))
    fetch = res.scalar_one_or_none()
    if fetch is None:
        return
    fetch.status = FetchStatus.FAILED
    fetch.error_message = message[:8000]
    fetch.completed_at = datetime.now(UTC)


@celery_app.task(name="app.workers.scraper.review_fetch_task")
def review_fetch_task(
    fetch_id: str,
    review_scope: str = "global",
    lang: str | None = None,
    country: str | None = None,
) -> None:
    fid = uuid.UUID(fetch_id)
    normalized_scope = "local" if review_scope == "local" else "global"
    try:
        heuristic_ids, ai_ids = run_async_db(
            _execute_review_fetch,
            fid,
            normalized_scope,
            (lang or "").strip().lower() or None,
            (country or "").strip().lower() or None,
        )
    except VivindisAppStoreImportError as exc:
        run_async_db(_mark_fetch_failed, fid, str(exc))
        log.error("fetch_aborted_import", fetch_id=fetch_id)
        return
    except Exception as exc:
        try:
            run_async_db(_mark_fetch_failed, fid, str(exc))
        except Exception:
            log.exception("fetch_failed_mark_error", fetch_id=fetch_id)
        raise

    from app.workers.ai import ai_analysis_task
    from app.workers.heuristic import heuristic_analysis_task

    for aid in heuristic_ids:
        heuristic_analysis_task.apply_async(args=[aid], queue="analysis")
    for aid in ai_ids:
        ai_analysis_task.apply_async(args=[aid], queue="analysis")

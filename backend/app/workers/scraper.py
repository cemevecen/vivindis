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
            response = self._response.json()
            for data in response["data"]:
                self._scanned_total = getattr(self, "_scanned_total", 0) + 1
                if hasattr(self, "_vivindis_max_scanned") and self._scanned_total > self._vivindis_max_scanned:
                    raise StopIteration()

                review = dict(data["attributes"])
                review["_vivindis_review_id"] = str(data.get("id", ""))
                review["date"] = datetime.strptime(review["date"], "%Y-%m-%dT%H:%M:%SZ")
                rd = review["date"].date()

                hi_date = getattr(self, "_vivindis_hi_date", None)
                lo_date = getattr(self, "_vivindis_lo_date", None)

                if hi_date and rd > hi_date:
                    continue
                if lo_date and rd < lo_date:
                    raise StopIteration()

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
) -> int:
    pkg = (app.package_name or "").strip()
    if not pkg:
        log.warning("scrape_play_skip_empty_package", app_id=str(app.id))
        return 0

    lang = settings.scrape_play_lang.strip() or "en"
    country = settings.scrape_play_country.strip() or "us"
    sleep_s = float(settings.scrape_play_sleep_seconds or 1.5)
    max_inserted = int(settings.scrape_max_reviews or 5000)
    max_scanned = 100_000

    inserted = 0
    continuation = None
    total_seen = 0
    lo, hi = fetch.from_date, fetch.to_date
    batch_sleep = _play_batch_sleep_for_window(sleep_s, lo, hi)

    while inserted < max_inserted and total_seen < max_scanned:
        batch, continuation = gp_reviews(
            pkg,
            lang=lang,
            country=country,
            sort=Sort.NEWEST,
            count=min(200, max_scanned - total_seen),
            continuation_token=continuation,
        )
        if not batch:
            break

        stop_all = False
        for rev in batch:
            if inserted >= max_inserted:
                stop_all = True
                break

            total_seen += 1
            at = rev.get("at")
            if isinstance(at, datetime) and at.tzinfo is None:
                at = at.replace(tzinfo=UTC)
            
            if at:
                ad = at.date()
                if ad > hi:
                    continue
                if ad < lo:
                    stop_all = True
                    break

            rid = str(rev.get("reviewId") or "")[:255]
            if not rid:
                continue

            rd = at.date() if isinstance(at, datetime) else lo
            score = int(rev.get("score") or 0)
            thumbs = int(rev.get("thumbsUpCount") or 0)
            body = str(rev.get("content") or "")
            author = rev.get("userName")
            title = None
            rep = rev.get("replyContent")
            rep_at = rev.get("repliedAt")
            rep_d = rep_at.date() if isinstance(rep_at, datetime) else None

            await _upsert_review(
                session,
                app_id=app.id,
                fetch_id=fetch.id,
                platform=StorePlatform.GOOGLE_PLAY,
                store_review_id=rid,
                rating=score,
                title=title,
                body=body,
                author=str(author) if author else None,
                lang="und",
                review_date=rd,
                thumbs_up=thumbs,
                developer_reply=str(rep) if rep else None,
                reply_date=rep_d,
            )
            inserted += 1

        if stop_all or continuation is None or continuation.token is None:
            break
        if batch_sleep > 0:
            await asyncio.sleep(batch_sleep)

    return inserted


async def _scrape_app_store(
    session: Any,
    *,
    fetch: ReviewFetch,
    app: App,
    settings: Any,
) -> int:
    VivindisAppStore = _load_app_store_class()
    numeric_id = (app.bundle_id or "").strip()
    if not numeric_id or not numeric_id.isdigit():
        log.warning("scrape_app_store_skip_missing_bundle", app_id=str(app.id))
        return 0

    country = settings.scrape_app_store_country.strip() or "tr"
    sleep_s = int(settings.scrape_app_store_sleep_seconds or 2)
    max_inserted = int(settings.scrape_max_reviews or 5000)
    max_scanned = 100_000

    slug = (app.name or "app").lower().replace(" ", "-")
    slug = "".join(c if c.isalnum() or c == "-" else "-" for c in slug).strip("-") or "app"

    store = VivindisAppStore(country=country, app_name=slug, app_id=int(numeric_id))
    
    lo, hi = fetch.from_date, fetch.to_date
    store._vivindis_lo_date = lo
    store._vivindis_hi_date = hi
    store._vivindis_max_scanned = max_scanned
    store._scanned_total = 0

    effective_sleep = _app_store_sleep_for_window(sleep_s, lo, hi)
    # We pass effective_how_many to let the library fetch enough to reach our dates,
    # but we will break out of `_parse_data` early when we hit max_inserted or lo_date.
    effective_how_many = max(max_inserted, max_scanned)
    store.review(how_many=effective_how_many, sleep=effective_sleep if effective_sleep > 0 else None)

    inserted = 0
    for rev in store.reviews:
        if inserted >= max_inserted:
            break
        rid = str(rev.get("_vivindis_review_id") or "").strip()
        if not rid:
            key_src = f"{numeric_id}|{rev.get('date')}|{rev.get('userName','')}|{str(rev.get('review',''))[:200]}"
            import hashlib

            rid = hashlib.sha256(key_src.encode("utf-8")).hexdigest()[:120]

        rd_raw = rev.get("date")
        if isinstance(rd_raw, datetime):
            rd = rd_raw.date()
        else:
            rd = lo

        # Additional safety check
        if not (lo <= rd <= hi):
            continue

        rating = int(rev.get("rating") or 0)
        title = rev.get("title")
        body = str(rev.get("review") or rev.get("body") or "")
        author = rev.get("userName")

        await _upsert_review(
            session,
            app_id=app.id,
            fetch_id=fetch.id,
            platform=StorePlatform.APP_STORE,
            store_review_id=rid[:255],
            rating=rating,
            title=str(title)[:1024] if title else None,
            body=body,
            author=str(author) if author else None,
            lang="und",
            review_date=rd,
            thumbs_up=0,
            developer_reply=None,
            reply_date=None,
        )
        inserted += 1

    return inserted


async def _execute_review_fetch(session: Any, fetch_id: uuid.UUID) -> tuple[list[str], list[str]]:
    settings = get_settings()
    res = await session.execute(
        select(ReviewFetch)
        .options(selectinload(ReviewFetch.app))
        .where(ReviewFetch.id == fetch_id),
    )
    fetch = res.scalar_one_or_none()
    if fetch is None:
        log.error("fetch_not_found", fetch_id=str(fetch_id))
        return [], []

    app = fetch.app
    fetch.status = FetchStatus.RUNNING
    fetch.started_at = datetime.now(UTC)
    fetch.error_message = None
    await session.flush()

    total_inserted = 0
    try:
        if app.platform in (AppPlatform.GOOGLE_PLAY, AppPlatform.BOTH):
            total_inserted += await _scrape_google_play(session, fetch=fetch, app=app, settings=settings)
        if app.platform in (AppPlatform.APP_STORE, AppPlatform.BOTH):
            total_inserted += await _scrape_app_store(session, fetch=fetch, app=app, settings=settings)

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
def review_fetch_task(fetch_id: str) -> None:
    fid = uuid.UUID(fetch_id)
    try:
        heuristic_ids, ai_ids = run_async_db(_execute_review_fetch, fid)
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

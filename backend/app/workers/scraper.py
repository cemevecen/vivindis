"""Play / App Store yorum çekme (Celery `scraper` kuyruğu)."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, date, datetime
from typing import Any

import httpx
from google_play_scraper import Sort
from google_play_scraper import reviews as gp_reviews
from google_play_scraper import reviews_all as gp_reviews_all
from google_play_scraper.exceptions import ExtraHTTPError, NotFoundError
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import selectinload

from app.core.celery import celery_app
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.analysis import Analysis
from app.models.app import App
from app.models.enums import AnalysisStatus, AnalysisType, AppPlatform, FetchStatus, StorePlatform
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.db.session import get_async_session_maker
from app.services.async_rate_limiter import AsyncTokenBucketRateLimiter
from app.services.play_scraper_headers import ensure_play_request_user_agents
from app.services.user_agents import pick_user_agent
from app.workers.runtime import run_async_db

ensure_play_request_user_agents()

log = get_logger(__name__)


async def _commit_reviews_and_sync_fetch_count(session: Any, fetch_id: uuid.UUID) -> None:
    """Yorum satırlarını kalıcı yap, ardından fetch.review_count'u DB'deki gerçek sayıma eşitle (polling UI)."""
    await session.commit()
    cnt_r = await session.execute(select(func.count()).select_from(Review).where(Review.fetch_id == fetch_id))
    n = int(cnt_r.scalar_one())
    await session.execute(update(ReviewFetch).where(ReviewFetch.id == fetch_id).values(review_count=n))
    await session.commit()


def _in_range(at: datetime | None, lo: date, hi: date) -> bool:
    if at is None:
        return False
    if at.tzinfo is None:
        at = at.replace(tzinfo=UTC)
    ad = at.date()
    return lo <= ad <= hi


def _rss_label(entry: dict[str, Any], key: str) -> str | None:
    node = entry.get(key)
    if not isinstance(node, dict):
        return None
    lab = node.get("label")
    if lab is None:
        return None
    return str(lab)


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
    author_uri: str | None,
    app_version_label: str | None,
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
            author_uri=author_uri[:2048] if author_uri else None,
            app_version_label=app_version_label[:64] if app_version_label else None,
            lang=lang[:16],
            review_date=review_date,
            thumbs_up=thumbs_up,
            developer_reply=developer_reply,
            reply_date=reply_date,
        )
        .on_conflict_do_nothing(constraint="uq_reviews_fetch_platform_store_id")
    )
    await session.execute(stmt)


async def _scrape_google_play(
    session: Any,
    *,
    fetch: ReviewFetch,
    app: App,
    settings: Any,
    review_scope: str,
    req_lang: str | None,
    req_country: str | None,
    global_langs: list[str] | None,
    limiter: AsyncTokenBucketRateLimiter,
) -> int:
    pkg = (app.package_name or "").strip()
    if not pkg:
        log.warning("scrape_play_skip_empty_package", app_id=str(app.id))
        return 0

    play_blacklist: set[tuple[str, str]] = set()

    PLAY_STORE_MATRIX = [
        ("tr", "tr"),
        ("en", "us"),
        ("en", "gb"),
        ("en", "au"),
        ("en", "ca"),
        ("en", "in"),
        ("en", "sg"),
        ("en", "za"),
        ("en", "ie"),
        ("en", "nz"),
        ("ar", "sa"),
        ("ar", "ae"),
        ("ar", "eg"),
        ("ar", "ma"),
        ("de", "de"),
        ("de", "at"),
        ("de", "ch"),
        ("fr", "fr"),
        ("fr", "be"),
        ("es", "es"),
        ("es", "mx"),
        ("it", "it"),
        ("nl", "nl"),
        ("pt", "br"),
        ("pt", "pt"),
        ("ru", "ru"),
        ("ru", "kz"),
        ("ru", "by"),
        ("uk", "ua"),
        ("ja", "jp"),
        ("ko", "kr"),
        ("zh", "tw"),
        ("zh", "hk"),
        ("id", "id"),
        ("th", "th"),
    ]

    if review_scope == "local":
        target_lang = (req_lang or "tr").strip().lower()
        preferred_country = (req_country or "tr").strip().lower()
        lang_locales = [pair for pair in PLAY_STORE_MATRIX if pair[0] == target_lang]
        if not lang_locales:
            lang_locales = [(target_lang, preferred_country)]
        locale_candidates = sorted(
            dict.fromkeys(lang_locales),
            key=lambda pair: (0 if pair[1] == preferred_country else 1, pair[1]),
        )
    else:
        max_global_locales = max(2, int(getattr(settings, "scrape_play_global_locale_limit", 12) or 12))
        requested_langs = {x.strip().lower() for x in (global_langs or []) if x and x.strip()}
        if requested_langs:
            locale_candidates = [pair for pair in PLAY_STORE_MATRIX if pair[0] in requested_langs][:max_global_locales]
            if not locale_candidates:
                locale_candidates = PLAY_STORE_MATRIX[:max_global_locales]
        else:
            locale_candidates = PLAY_STORE_MATRIX[:max_global_locales]

    max_inserted = int(settings.scrape_max_reviews or 250000)
    lo, hi = fetch.from_date, fetch.to_date
    total_inserted = 0
    # NOTE: Her shard ayrı DB session açıyor; shard sayısı connection pool'u aşarsa
    # Railway worker'da çoğu shard timeout verip çok az yorum kalabiliyor.
    # Bu yüzden shard paralelliğini havuz limitinin altında tutuyoruz.
    shard_parallelism = 8 if review_scope == "global" else 4
    sem = asyncio.Semaphore(shard_parallelism)

    # Package variants for case-sensitivity: try original then lowercase if needed.
    pkg_variants = [pkg]
    if pkg.lower() != pkg:
        pkg_variants.append(pkg.lower())

    # Try variants sequentially: first original case, then lowercase if 0 found.
    for variant in pkg_variants:
        factory = get_async_session_maker()

        async def _shard_task(l: str, c: str, s: int, v: str) -> int:
            async with sem:
                async with factory() as shard_session:
                    return await _scrape_locale_score(
                        shard_session, l, c, s, v, limiter, lo, hi, app, fetch, max_inserted
                    )

        tasks = [
            _shard_task(l, c, s, variant)
            for (l, c) in locale_candidates
            for s in (1, 2, 3, 4, 5)
        ]
        counts = await asyncio.gather(*tasks)
        total_inserted = sum(counts)
        if total_inserted > 0:
            break

    # Safety net: if shard model yields 0 (often due transient Play throttling),
    # fallback to low-pressure baseline scraping without score filter.
    if total_inserted == 0:
        fallback_locales = (
            [(req_lang or "tr", req_country or "tr")]
            if review_scope == "local"
            else [(req_lang or "tr", req_country or "tr"), ("tr", "tr"), ("en", "us")]
        )
        unique_locales = list(dict.fromkeys(fallback_locales))
        for variant in pkg_variants:
            baseline_count = await _scrape_google_play_baseline(
                session,
                pkg=variant,
                fetch=fetch,
                app=app,
                lo=lo,
                hi=hi,
                limiter=limiter,
                max_inserted=max_inserted,
                locales=unique_locales,
            )
            total_inserted += baseline_count
            if total_inserted > 0:
                break

    return total_inserted


async def _scrape_google_play_baseline(
    session: Any,
    *,
    pkg: str,
    fetch: ReviewFetch,
    app: App,
    lo: date,
    hi: date,
    limiter: AsyncTokenBucketRateLimiter,
    max_inserted: int,
    locales: list[tuple[str, str]],
) -> int:
    inserted = 0
    loop = asyncio.get_running_loop()
    for lang, country in locales:
        await limiter.acquire()
        try:
            def _sync_all():
                return gp_reviews_all(
                    pkg,
                    sleep_milliseconds=0,
                    lang=lang,
                    country=country,
                    sort=Sort.NEWEST,
                )

            rows = await loop.run_in_executor(None, _sync_all)
        except Exception as exc:
            log.warning("play_baseline_failed", pkg=pkg, lang=lang, country=country, error=str(exc))
            continue

        for rev in rows:
            at = rev.get("at")
            if isinstance(at, datetime) and at.tzinfo is None:
                at = at.replace(tzinfo=UTC)
            if at and (at.date() < lo or at.date() > hi):
                continue

            rid = str(rev.get("reviewId") or "")[:255]
            if not rid:
                continue
            await _upsert_review(
                session,
                app_id=app.id,
                fetch_id=fetch.id,
                platform=StorePlatform.GOOGLE_PLAY,
                store_review_id=rid,
                rating=int(rev.get("score") or 0),
                title=None,
                body=str(rev.get("content") or ""),
                author=str(rev.get("userName") or "") or None,
                author_uri=str(rev.get("userImage") or "") or None,
                app_version_label=str(rev.get("reviewCreatedVersion") or "") or None,
                lang=lang,
                review_date=at.date() if at else lo,
                thumbs_up=int(rev.get("thumbsUpCount") or 0),
                developer_reply=str(rev.get("replyContent")) if rev.get("replyContent") else None,
                reply_date=rev.get("repliedAt").date() if isinstance(rev.get("repliedAt"), datetime) else None,
            )
            inserted += 1
            if inserted >= max_inserted:
                break
        await _commit_reviews_and_sync_fetch_count(session, fetch.id)
        if inserted >= max_inserted:
            break
    return inserted


async def _scrape_locale_score(
    session: Any, lang: str, country: str, score: int, target_pkg: str,
    limiter: Any, lo: date, hi: date, app: App, fetch: ReviewFetch, max_inserted: int
) -> int:
    from app.core.logging import get_logger
    from google_play_scraper import reviews as gp_reviews, Sort
    from datetime import datetime, UTC
    from app.models.enums import StorePlatform
    
    log = get_logger(__name__)
    inserted = 0
    continuation = None
    batches = 0
    max_batches = 100
    loop = asyncio.get_running_loop()

    while batches < max_batches:
        await limiter.acquire()
        cont = continuation

        try:
            def _sync():
                return gp_reviews(
                    target_pkg, lang=lang, country=country, sort=Sort.NEWEST,
                    count=200, filter_score_with=score, continuation_token=cont
                )
            batch, next_tok = await loop.run_in_executor(None, _sync)
        except Exception as exc:
            log.warning("play_shard_failed", pkg=target_pkg, lang=lang, country=country, error=str(exc))
            break

        if not batch: break
        batches += 1
        continuation = next_tok

        for rev in batch:
            at = rev.get("at")
            if isinstance(at, datetime) and at.tzinfo is None:
                at = at.replace(tzinfo=UTC)
            
            if at and (at.date() < lo or at.date() > hi):
                if at.date() < lo:
                    await _commit_reviews_and_sync_fetch_count(session, fetch.id)
                    return inserted
                continue
            
            rid = str(rev.get("reviewId") or "")[:255]
            if not rid: continue

            await _upsert_review(
                session,
                app_id=app.id, fetch_id=fetch.id,
                platform=StorePlatform.GOOGLE_PLAY,
                store_review_id=rid,
                rating=int(rev.get("score") or 0),
                title=None,
                body=str(rev.get("content") or ""),
                author=str(rev.get("userName") or "") or None,
                author_uri=str(rev.get("userImage") or "") or None,
                app_version_label=str(rev.get("reviewCreatedVersion") or "") or None,
                lang=lang,
                review_date=at.date() if at else lo,
                thumbs_up=int(rev.get("thumbsUpCount") or 0),
                developer_reply=str(rev.get("replyContent")) if rev.get("replyContent") else None,
                reply_date=rev.get("repliedAt").date() if isinstance(rev.get("repliedAt"), datetime) else None,
            )
            inserted += 1
        
        await _commit_reviews_and_sync_fetch_count(session, fetch.id)
        if continuation is None or getattr(continuation, "token", None) is None:
            break
            
    return inserted


async def _scrape_app_store(
    session: Any,
    *,
    fetch: ReviewFetch,
    app: App,
    settings: Any,
    review_scope: str,
    req_lang: str | None,
    req_country: str | None,
    global_langs: list[str] | None,
    limiter: AsyncTokenBucketRateLimiter,
) -> int:
    _ = settings, req_lang
    numeric_id = (app.bundle_id or "").strip()
    if not numeric_id:
        return 0

    APP_STORE_COUNTRIES = [
        "tr",
        "us",
        "gb",
        "de",
        "fr",
        "ca",
        "au",
        "it",
        "es",
        "sa",
        "ae",
        "qa",
        "kw",
        "jo",
        "lb",
        "eg",
        "ly",
        "dz",
        "ma",
        "tn",
        "ru",
        "kz",
        "uz",
        "tm",
        "kg",
        "cy",
        "gr",
        "ro",
        "bg",
        "pl",
        "hu",
        "cz",
        "se",
        "no",
        "dk",
        "nl",
        "be",
        "ch",
    ]

    if review_scope == "local":
        target_lang = (req_lang or "tr").strip().lower()
        preferred_country = (req_country or "tr").strip().lower()
        lang_country_map = {
            "tr": ["tr"],
            "en": ["us", "gb", "ca", "au"],
            "de": ["de", "at", "ch"],
            "fr": ["fr", "ca", "be"],
            "es": ["es", "mx"],
            "it": ["it"],
            "pt": ["br", "pt"],
            "ru": ["ru", "kz"],
            "ar": ["sa", "ae", "eg"],
            "ja": ["jp"],
            "ko": ["kr"],
            "zh": ["hk", "tw"],
            "nl": ["nl", "be"],
            "sv": ["se"],
            "no": ["no"],
            "da": ["dk"],
        }
        by_lang = [c for c in lang_country_map.get(target_lang, []) if c in APP_STORE_COUNTRIES]
        if not by_lang:
            countries = [preferred_country]
        else:
            countries = sorted(
                dict.fromkeys(by_lang),
                key=lambda c: (0 if c == preferred_country else 1, c),
            )
    else:
        max_global_countries = max(
            4,
            int(getattr(settings, "scrape_app_store_global_country_limit", 16) or 16),
        )
        requested_langs = [x.strip().lower() for x in (global_langs or []) if x and x.strip()]
        if requested_langs:
            lang_country_map = {
                "tr": ["tr"],
                "en": ["us", "gb", "ca", "au"],
                "de": ["de", "at", "ch"],
                "fr": ["fr", "ca", "be"],
                "es": ["es", "mx"],
                "it": ["it"],
                "pt": ["br", "pt"],
                "ru": ["ru", "kz"],
                "ar": ["sa", "ae", "eg"],
                "ja": ["jp"],
                "ko": ["kr"],
                "zh": ["hk", "tw"],
                "nl": ["nl", "be"],
                "sv": ["se"],
                "no": ["no"],
                "da": ["dk"],
            }
            expanded: list[str] = []
            for lang in requested_langs:
                expanded.extend(lang_country_map.get(lang, []))
            deduped = [c for c in dict.fromkeys(expanded) if c in APP_STORE_COUNTRIES]
            countries = (deduped or APP_STORE_COUNTRIES)[:max_global_countries]
        else:
            countries = APP_STORE_COUNTRIES[:max_global_countries]
    max_inserted = int(settings.scrape_max_reviews or 250000)
    max_pages_per_country = max(1, int(getattr(settings, "scrape_app_store_max_pages", 250) or 250))
    country_parallelism = 2 if review_scope == "local" else 6
    lo, hi = fetch.from_date, fetch.to_date
    total_inserted = 0
    rss_404_countries: set[str] = set()
    country_sem = asyncio.Semaphore(country_parallelism)

    async def _fetch_rss_page(client: httpx.AsyncClient, country: str, page: int) -> tuple[int, bool]:
        nonlocal total_inserted
        if total_inserted >= max_inserted:
            return 0, True
        if country in rss_404_countries:
            return 0, True

        url = (
            f"https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={numeric_id}/"
            "sortBy=mostRecent/json"
        )
        await limiter.acquire()
        try:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": pick_user_agent(),
                    "Accept": "application/json,text/plain,*/*",
                },
            )
        except Exception:
            return 0, True

        if resp.status_code == 404:
            rss_404_countries.add(country)
            log.warning(
                "scrape_app_store_rss_404",
                fetch_id=str(fetch.id),
                country=country,
                page=page,
                bundle_id=numeric_id,
            )
            return 0, True

        if resp.status_code != 200:
            log.warning(
                "scrape_app_store_rss_http",
                fetch_id=str(fetch.id),
                country=country,
                page=page,
                status=resp.status_code,
            )
            return 0, True

        try:
            data = resp.json()
        except Exception:
            return 0, True

        entries = data.get("feed", {}).get("entry", [])
        if not isinstance(entries, list):
            entries = [entries] if entries else []
        if not entries:
            return 0, True

        inserted = 0
        saw_older_than_range = False
        has_review_entries = False
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if "author" not in entry or total_inserted >= max_inserted:
                continue
            has_review_entries = True
            try:
                rid = _rss_label(entry, "id") or ""
                if not rid:
                    continue
                date_str = _rss_label(entry, "updated") or ""
                at = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                rd = at.date()
                if not (lo <= rd <= hi):
                    if rd < lo:
                        saw_older_than_range = True
                    continue

                author_block = entry.get("author")
                author_name = None
                author_uri = None
                if isinstance(author_block, dict):
                    author_name = _rss_label(author_block, "name")
                    author_uri = _rss_label(author_block, "uri")

                title = _rss_label(entry, "title")
                body = _rss_label(entry, "content") or ""
                version = _rss_label(entry, "im:version")
                rating_raw = _rss_label(entry, "im:rating") or "0"

                await _upsert_review(
                    session,
                    app_id=app.id,
                    fetch_id=fetch.id,
                    platform=StorePlatform.APP_STORE,
                    store_review_id=rid,
                    rating=int(rating_raw),
                    title=title,
                    body=body,
                    author=author_name,
                    author_uri=author_uri,
                    app_version_label=version,
                    lang="und",
                    review_date=rd,
                    thumbs_up=0,
                    developer_reply=None,
                    reply_date=None,
                )
                inserted += 1
                total_inserted += 1
            except Exception:
                continue
        should_stop = saw_older_than_range or (not has_review_entries)
        return inserted, should_stop

    async def _fetch_country(country: str) -> int:
        nonlocal total_inserted
        country_total = 0
        page = 1
        async with country_sem:
            async with httpx.AsyncClient(timeout=15.0) as client:
                while page <= max_pages_per_country and total_inserted < max_inserted:
                    inserted, should_stop = await _fetch_rss_page(client, country, page)
                    country_total += inserted
                    if should_stop:
                        break
                    page += 1
        return country_total

    async def _fetch_country_group(country_list: list[str]) -> int:
        unique_countries = list(dict.fromkeys(country_list))
        counts = await asyncio.gather(*[_fetch_country(c) for c in unique_countries])
        return sum(counts)

    total_inserted = await _fetch_country_group(countries)

    # "Local" modda yalnızca seçili ülke taranır; otomatik ülke genişletmesi yapılmaz.
    return total_inserted


async def _execute_review_fetch(
    session: Any,
    fetch_id: uuid.UUID,
    review_scope: str,
    req_lang: str | None,
    req_country: str | None,
    global_langs: list[str] | None,
) -> tuple[list[str], list[str]]:
    settings = get_settings()
    rps = float(settings.scrape_requests_per_second or 7.0)
    rps = max(0.5, min(20.0, rps))
    limiter = AsyncTokenBucketRateLimiter(rate_per_second=rps, burst=max(2.0, rps))

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
    # Make pending->running transition visible to polling UI immediately.
    await session.commit()

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
                global_langs=global_langs,
                limiter=limiter,
            )
            fetch.review_count = total_inserted
            await session.flush()
            await session.commit()
        if app.platform in (AppPlatform.APP_STORE, AppPlatform.BOTH):
            total_inserted += await _scrape_app_store(
                session,
                fetch=fetch,
                app=app,
                settings=settings,
                review_scope=review_scope,
                req_lang=req_lang,
                req_country=req_country,
                global_langs=global_langs,
                limiter=limiter,
            )
            fetch.review_count = total_inserted
            await session.flush()
            await session.commit()

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
    global_langs: list[str] | None = None,
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
            [x.strip().lower() for x in (global_langs or []) if x and str(x).strip()] or None,
        )
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

from __future__ import annotations

import concurrent.futures
from datetime import datetime, timedelta
from typing import Any, Callable, List, Optional, cast

from google_play_scraper import Sort, reviews as play_reviews

from .lang_filter import filter_local_reviews


def fetch_google_play_reviews(
    app_id: str,
    days_limit: int,
    _progress_callback: Optional[Callable[[float], None]] = None,
    scope: str = "global",
) -> List[dict[str, Any]]:
    """Parallel Google Play fetch.

    scope:
      - "global": tüm dil/ülke matrisi üzerinden paralel çekim (varsayılan davranış).
      - "local" : yalnızca TR (tr-tr) üzerinden çekim — Türkiye Play Store yorumları.
    """
    all_fetched_map: dict[str, dict[str, Any]] = {}
    now = datetime.now()
    threshold_date = now - timedelta(days=days_limit)

    if scope == "local":
        # Yerel: yalnız TR storefront + yalnız tr lang.
        LANG_COUNTRY_PAIRS = [("tr", "tr")]
    else:
        # Global: TR dahil geniş ülke matrisi. "Global" semantiği gereği
        # yerel de bunun alt kümesidir; bu nedenle global ≥ yerel olur.
        # Kapsamı genişletmek için coğrafi çeşitlilik yüksek tutuldu.
        LANG_COUNTRY_PAIRS = [
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
            ("fr", "ca"),
            ("ru", "ru"),
            ("ru", "by"),
            ("nl", "nl"),
            ("es", "es"),
            ("es", "mx"),
            ("es", "ar"),
            ("es", "co"),
            ("pt", "br"),
            ("pt", "pt"),
            ("it", "it"),
            ("pl", "pl"),
            ("ro", "ro"),
            ("bg", "bg"),
            ("uk", "ua"),
            ("kk", "kz"),
            ("ja", "jp"),
            ("ko", "kr"),
            ("zh", "tw"),
            ("id", "id"),
            ("th", "th"),
            ("vi", "vn"),
        ]

    sort_strategies = [Sort.NEWEST, Sort.MOST_RELEVANT]
    scores = [1, 2, 3, 4, 5]
    channels: list[tuple[Any, int, str, str]] = []
    for s in sort_strategies:
        for sc in scores:
            for lang, country in LANG_COUNTRY_PAIRS:
                channels.append((s, sc, lang, country))

    def fetch_channel(sort_type: Any, score: int, lang: str, country: str):
        channel_data: list[dict[str, Any]] = []
        token = None
        old_streak = 0
        for _ in range(30):
            try:
                result, token = play_reviews(
                    app_id,
                    lang=lang,
                    country=country,
                    sort=sort_type,
                    count=200,
                    filter_score_with=score,
                    continuation_token=token,
                )
                if not result:
                    break
                page_has_new = False
                for r in result:
                    r_at_raw = r.get("at")
                    if r_at_raw:
                        r_at = cast(datetime, r_at_raw)
                        if r_at.tzinfo:
                            r_at = r_at.replace(tzinfo=None)
                        if r_at >= threshold_date:
                            content = str(r.get("content", ""))
                            if content and len(content.strip()) >= 2:
                                r_id = r.get("reviewId", content)
                                channel_data.append(
                                    {
                                        "id": r_id,
                                        "text": content,
                                        "date": r_at,
                                        "rating": str(score),
                                        "lang": lang,
                                        "version": r.get("appVersion", "Bilinmiyor"),
                                    }
                                )
                            page_has_new = True
                            old_streak = 0
                        else:
                            if sort_type == Sort.NEWEST:
                                old_streak += 1
                if sort_type == Sort.NEWEST and not page_has_new:
                    old_streak += 1
                if sort_type == Sort.NEWEST and old_streak >= 3:
                    break
                if not token:
                    break
            except Exception:
                break
        return channel_data

    def fetch_unfiltered(lang: str, country: str):
        fresh_data: list[dict[str, Any]] = []
        token = None
        old_streak = 0
        for _ in range(20):
            try:
                result, token = play_reviews(
                    app_id,
                    lang=lang,
                    country=country,
                    sort=Sort.NEWEST,
                    count=200,
                    continuation_token=token,
                )
                if not result:
                    break
                page_has_new = False
                for r in result:
                    r_at_raw = r.get("at")
                    if r_at_raw:
                        r_at = cast(datetime, r_at_raw)
                        if r_at.tzinfo:
                            r_at = r_at.replace(tzinfo=None)
                        if r_at >= threshold_date:
                            content = str(r.get("content", ""))
                            if content and len(content.strip()) >= 2:
                                r_id = r.get("reviewId", content)
                                rating = str(r.get("score", "0"))
                                fresh_data.append(
                                    {
                                        "id": r_id,
                                        "text": content,
                                        "date": r_at,
                                        "rating": rating,
                                        "lang": lang,
                                        "version": r.get("appVersion", "Bilinmiyor"),
                                    }
                                )
                            page_has_new = True
                            old_streak = 0
                        else:
                            old_streak += 1
                if not page_has_new:
                    old_streak += 1
                if old_streak >= 3:
                    break
                if not token:
                    break
            except Exception:
                break
        return fresh_data

    initial_pairs = (
        [("tr", "tr")] if scope == "local"
        else [("tr", "tr"), ("en", "us"), ("de", "de"), ("ru", "ru")]
    )
    # İlerleme budget'ı: ilk faz ~%10, kanal fazı %10–%99
    init_total = len(initial_pairs)
    init_done = 0
    if _progress_callback:
        _progress_callback(0.01)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(initial_pairs)) as init_executor:
        init_futures = [init_executor.submit(fetch_unfiltered, lp, cp) for lp, cp in initial_pairs]
        for f in concurrent.futures.as_completed(init_futures):
            init_done += 1
            if _progress_callback:
                _progress_callback(min(0.10, 0.01 + 0.09 * (init_done / max(1, init_total))))
            for r in f.result():
                all_fetched_map[str(r["id"])] = r

    total_channels = len(channels)
    completed_channels = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=60) as executor:
        future_to_channel = {
            executor.submit(fetch_channel, s, sc, l, c): (s, sc, l, c) for s, sc, l, c in channels
        }
        for future in concurrent.futures.as_completed(future_to_channel):
            completed_channels += 1
            if _progress_callback:
                # 0.10 → 0.99 arası eşit dağıtım
                ratio = completed_channels / max(1, total_channels)
                _progress_callback(min(0.99, 0.10 + 0.89 * ratio))
            for r in future.result():
                all_fetched_map[str(r["id"])] = r

    if _progress_callback:
        _progress_callback(1.0)

    results = list(all_fetched_map.values())
    # Storefront `country=tr` olsa bile Google Play yabancı dildeki yorumları
    # da döndürebiliyor; "yerel" semantiğini garanti altına almak için
    # sonuçta bir script-filtresi uygulanır.
    if scope == "local":
        results, _dropped = filter_local_reviews(results, locale="tr")
    return results

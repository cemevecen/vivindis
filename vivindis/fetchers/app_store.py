from __future__ import annotations

import concurrent.futures
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, List, Optional

import requests

from .lang_filter import filter_local_reviews


def get_app_store_reviews(
    app_id: str,
    _progress_callback: Optional[Callable[[float], None]] = None,
    _days_limit: int = 30,
    scope: str = "global",
) -> List[Dict[str, Any]]:
    """Parallel App Store RSS fetch.

    scope:
      - "global": 40 ülke storefront'u üzerinden paralel çekim (varsayılan).
      - "local" : yalnızca TR storefront'u — Türkiye App Store yorumları.
    """
    all_reviews_map: Dict[str, Dict[str, Any]] = {}
    now = datetime.now()
    threshold_dt = now - timedelta(days=_days_limit)

    if scope == "local":
        countries = ["tr"]
    else:
        countries = [
            "tr",
            "us",
            "de",
            "az",
            "nl",
            "fr",
            "gb",
            "at",
            "be",
            "ch",
            "kz",
            "uz",
            "tm",
            "kg",
            "ru",
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
            "it",
            "es",
            "ca",
            "au",
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
        ]

    def fetch_country_reviews(country: str):
        country_reviews: list[dict[str, Any]] = []
        for page in range(1, 11):
            try:
                url = f"https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={app_id}/sortBy=mostRecent/json"
                resp = requests.get(url, timeout=5)
                if resp.status_code != 200:
                    break
                data = resp.json()
                entries = data.get("feed", {}).get("entry", [])
                if not entries:
                    break
                if isinstance(entries, dict):
                    entries = [entries]

                found_old = 0
                for entry in entries:
                    content = entry.get("content", {}).get("label", "")
                    if not content or len(content.strip()) < 2:
                        continue

                    updated = entry.get("updated", {}).get("label", "")
                    try:
                        r_date = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                        r_date = r_date.replace(tzinfo=None)
                    except Exception:
                        continue

                    if r_date >= threshold_dt:
                        r_id = entry.get("id", {}).get("label", content)
                        rating = str(entry.get("im:rating", {}).get("label", "0"))
                        country_reviews.append(
                            {
                                "id": r_id,
                                "text": content,
                                "date": r_date,
                                "rating": rating,
                                "lang": country,
                            }
                        )
                    else:
                        found_old += 1

                if found_old >= 5:
                    break
            except Exception:
                break
        return country_reviews

    total_countries = len(countries)
    completed = 0
    if _progress_callback:
        _progress_callback(0.02)
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as executor:
        future_to_country = {executor.submit(fetch_country_reviews, c): c for c in countries}
        for future in concurrent.futures.as_completed(future_to_country):
            completed += 1
            if _progress_callback:
                ratio = completed / max(1, total_countries)
                _progress_callback(min(0.99, 0.02 + 0.97 * ratio))
            for r in future.result():
                all_reviews_map[str(r["id"])] = r

    if _progress_callback:
        _progress_callback(1.0)

    results = list(all_reviews_map.values())
    # TR storefront yabancı-dildeki yorumları da döndürebiliyor; "yerel"
    # semantiğini garantilemek için script-filtresi uygulanır.
    if scope == "local":
        results, _dropped = filter_local_reviews(results, locale="tr")
    return results

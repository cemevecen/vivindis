"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings


async def run_marketplace_review_aggregator(
    *,
    settings: Settings,
    search_query: str,
    platforms: list[str],
    max_reviews_per_product: int,
) -> list[dict[str, Any]]:
    """Runs `turkish-e-commerce-review-aggregator` (or configured actor) with a marketplace search query."""
    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_reviews_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_MARKETPLACE_REVIEWS_ACTOR eksik.")
    actor_enc = quote(actor_raw, safe="")

    url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1"
    )
    q = search_query.strip()
    if len(q) < 2:
        raise RuntimeError("Arama terimi çok kısa.")
    plats = [p.strip().lower() for p in platforms if p and str(p).strip()]
    if not plats:
        raise RuntimeError("platforms boş.")

    # Do not send minRating when unset: actor schema is integer 1–5; null fails validation (400).
    payload: dict[str, Any] = {
        "searchQuery": q[:500],
        "platforms": plats[:3],
        "maxReviewsPerProduct": max(5, min(200, int(max_reviews_per_product))),
        "sortBy": "recent",
        "proxyConfig": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
            "apifyProxyCountry": "TR",
        },
    }
    timeout_seconds = max(120, int(settings.external_scraper_timeout_seconds or 180) * 2)
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code >= 400:
            detail = (resp.text or "").strip()
            if len(detail) > 800:
                detail = detail[:800] + "…"
            raise RuntimeError(
                f"Apify yorum aktörü HTTP {resp.status_code}: {detail or 'gövde yok'}"
            )
        data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError("Apify beklenmeyen yanıt döndü (liste değil).")
    rows: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            rows.append(item)
    return rows

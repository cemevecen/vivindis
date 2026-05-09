"""Apify: Turkish e-commerce product reviews (Trendyol / Hepsiburada / N11)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings


def _apify_actor_run_failed_retryable(status_code: int, body: str) -> bool:
    """Apify returns HTTP 400 with run-failed when the actor started but exited with status FAILED."""
    if status_code != 400:
        return False
    low = body.lower()
    return (
        "run-failed" in low
        or "did not succeed" in low
        or "status: failed" in low
        or '"status":"failed"' in low.replace(" ", "")
    )


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

    # timeout: align with actor defaultRunOptions (300s). restartOnError: one automatic retry on Apify side.
    url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1&timeout=300&restartOnError=1"
    )
    q = search_query.strip()
    if len(q) < 2:
        raise RuntimeError("Arama terimi çok kısa.")
    plats = [p.strip().lower() for p in platforms if p and str(p).strip()]
    if not plats:
        raise RuntimeError("platforms boş.")

    # Do not send minRating when unset: actor schema is integer 1–5; null fails validation (400).
    base_payload: dict[str, Any] = {
        "searchQuery": q[:500],
        "platforms": plats[:3],
        "maxReviewsPerProduct": max(5, min(200, int(max_reviews_per_product))),
        "sortBy": "recent",
    }
    # Actor stats show many FAILED runs; residential TR can fail (quota, blocks). Fall back automatically.
    proxy_strategies: list[tuple[str, dict[str, Any]]] = [
        (
            "residential_tr",
            {
                "useApifyProxy": True,
                "apifyProxyGroups": ["RESIDENTIAL"],
                "apifyProxyCountry": "TR",
            },
        ),
        (
            "datacenter_auto_tr",
            {
                "useApifyProxy": True,
                "apifyProxyCountry": "TR",
            },
        ),
        ("no_proxy", {"useApifyProxy": False}),
    ]
    # Sync run can take up to ~300s; keep client read timeout comfortably above that.
    timeout_seconds = max(360, int(settings.external_scraper_timeout_seconds or 180) * 2)
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for idx, (_label, proxy_cfg) in enumerate(proxy_strategies):
            payload = {**base_payload, "proxyConfig": proxy_cfg}
            resp = await client.post(url, json=payload)
            if resp.status_code < 400:
                data = resp.json()
                break
            detail = (resp.text or "").strip()
            if len(detail) > 800:
                detail = detail[:800] + "…"
            retryable = _apify_actor_run_failed_retryable(resp.status_code, resp.text or "")
            if retryable and idx + 1 < len(proxy_strategies):
                continue
            raise RuntimeError(
                f"Apify yorum aktörü HTTP {resp.status_code}: {detail or 'gövde yok'}"
            )
    if not isinstance(data, list):
        raise RuntimeError("Apify beklenmeyen yanıt döndü (liste değil).")
    rows: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            rows.append(item)
    return rows

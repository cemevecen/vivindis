"""Apify: Turkish Marketplace Seller Intelligence (TR pazaryeri satıcı profili)."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings


async def run_marketplace_seller_intelligence(
    *,
    settings: Settings,
    seller_urls: list[str],
    max_sellers: int = 1,
) -> list[dict[str, Any]]:
    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_marketplace_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_MARKETPLACE_ACTOR eksik.")
    actor_enc = quote(actor_raw, safe="")

    url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1"
    )
    urls = [u.strip() for u in seller_urls if u and str(u).strip()]
    if not urls:
        raise RuntimeError("seller_urls boş.")

    payload: dict[str, Any] = {
        "sellerUrls": urls[:50],
        "maxSellers": max(1, min(100, int(max_sellers))),
    }
    timeout_seconds = max(60, int(settings.external_scraper_timeout_seconds or 180))
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError("Apify beklenmeyen yanıt döndü (liste değil).")
    rows: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            rows.append(item)
    return rows

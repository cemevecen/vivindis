"""Apify actor üzerinden Google Maps yorumlarını çeker."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings


async def run_google_maps_actor(
    *,
    settings: Settings,
    search_term: str,
    max_reviews: int,
    sort_by: str,
    target_language: str,
) -> list[dict[str, Any]]:
    token = (settings.external_scraper_apify_token or "").strip()
    if not token:
        raise RuntimeError("EXTERNAL_SCRAPER_APIFY_TOKEN eksik.")

    actor_raw = (settings.external_scraper_google_maps_actor or "").strip()
    if not actor_raw:
        raise RuntimeError("EXTERNAL_SCRAPER_GOOGLE_MAPS_ACTOR eksik.")
    actor_enc = quote(actor_raw, safe="")

    url = (
        f"https://api.apify.com/v2/acts/{actor_enc}/run-sync-get-dataset-items"
        f"?token={token}&format=json&clean=1"
    )
    payload = {
        "search_term": search_term,
        "max_reviews": max(50, min(500, int(max_reviews))),
        "sort_by": sort_by,
        "target_language": target_language,
    }
    timeout_seconds = max(30, int(settings.external_scraper_timeout_seconds or 120))
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError("External scraper beklenmeyen yanıt döndü (liste değil).")
    rows: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            rows.append(item)
    return rows

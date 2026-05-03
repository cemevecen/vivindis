"""Mağaza keşfi ve yorum çekme — `vivindis.fetchers` üzerinden."""

from __future__ import annotations

from typing import Any

from vivindis.fetchers.app_discovery import (
    resolve_direct_input,
    search_app_store_itunes,
    search_play_store,
)
from vivindis.fetchers.app_store import get_app_store_reviews
from vivindis.fetchers.google_play import fetch_google_play_reviews
from vivindis.web.schemas.apps import FetchBody, ResolveBody, SearchQuery


class AppsService:
    def search(self, body: SearchQuery) -> dict[str, Any]:
        q = body.q.strip()
        rows: list[dict[str, Any]] = []
        if body.filter in ("all", "android"):
            rows.extend(search_play_store(q, n_hits=body.limit))
        if body.filter in ("all", "ios"):
            rows.extend(search_app_store_itunes(q, country="TR", limit=body.limit))
        return {"query": q, "count": len(rows), "hits": rows}

    def resolve(self, body: ResolveBody) -> dict[str, Any]:
        app, err = resolve_direct_input(body.raw.strip())
        if app is None:
            return {"resolved": None, "error": err or "not_found"}
        return {
            "resolved": {"platform": app.platform, "app_id": app.app_id},
            "error": None,
        }

    def fetch_reviews(self, body: FetchBody) -> dict[str, Any]:
        if body.platform == "android":
            pool = fetch_google_play_reviews(
                body.app_id,
                days_limit=body.days_limit,
                scope=body.scope,
            )
        else:
            pool = get_app_store_reviews(
                body.app_id,
                _days_limit=body.days_limit,
                scope=body.scope,
            )
        return {"count": len(pool), "reviews": pool}

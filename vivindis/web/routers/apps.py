from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from vivindis.fetchers.app_discovery import (
    resolve_direct_input,
    search_app_store_itunes,
    search_play_store,
)
from vivindis.fetchers.app_store import get_app_store_reviews
from vivindis.fetchers.google_play import fetch_google_play_reviews

router = APIRouter(prefix="/apps", tags=["apps"])


class SearchQuery(BaseModel):
    q: str = Field(min_length=1)
    filter: Literal["all", "android", "ios"] = "all"
    limit: int = 24


@router.post("/search")
def search_apps(body: SearchQuery) -> dict[str, Any]:
    q = body.q.strip()
    rows: list[dict[str, Any]] = []
    if body.filter in ("all", "android"):
        rows.extend(search_play_store(q, n_hits=body.limit))
    if body.filter in ("all", "ios"):
        rows.extend(search_app_store_itunes(q, country="TR", limit=body.limit))
    return {"query": q, "count": len(rows), "hits": rows}


class ResolveBody(BaseModel):
    raw: str = Field(min_length=1)


@router.post("/resolve")
def resolve_store_input(body: ResolveBody) -> dict[str, Any]:
    app, err = resolve_direct_input(body.raw.strip())
    if app is None:
        return {"resolved": None, "error": err or "not_found"}
    return {
        "resolved": {
            "platform": app.platform,
            "app_id": app.app_id,
        },
        "error": None,
    }


class FetchBody(BaseModel):
    platform: Literal["android", "ios"]
    app_id: str = Field(min_length=1)
    days_limit: int = 30
    scope: Literal["local", "global"] = "global"


@router.post("/fetch-reviews")
def fetch_reviews(body: FetchBody) -> dict[str, Any]:
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

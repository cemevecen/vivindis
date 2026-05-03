from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from vivindis.web.dependencies import get_apps_service
from vivindis.web.schemas.apps import FetchBody, ResolveBody, SearchQuery
from vivindis.web.services.apps_service import AppsService

router = APIRouter(prefix="/apps", tags=["apps"])


@router.post("/search")
def search_apps(
    body: SearchQuery,
    svc: AppsService = Depends(get_apps_service),
) -> dict[str, Any]:
    return svc.search(body)


@router.post("/resolve")
def resolve_store_input(
    body: ResolveBody,
    svc: AppsService = Depends(get_apps_service),
) -> dict[str, Any]:
    return svc.resolve(body)


@router.post("/fetch-reviews")
def fetch_reviews(
    body: FetchBody,
    svc: AppsService = Depends(get_apps_service),
) -> dict[str, Any]:
    return svc.fetch_reviews(body)

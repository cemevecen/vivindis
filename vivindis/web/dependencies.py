"""FastAPI `Depends` için servis fabrikaları (istek başına veya önbellekli)."""

from __future__ import annotations

from functools import lru_cache

from vivindis.web.services.analysis_service import AnalysisService
from vivindis.web.services.apps_service import AppsService
from vivindis.web.services.reviews_service import ReviewsService


@lru_cache
def get_analysis_service() -> AnalysisService:
    return AnalysisService()


@lru_cache
def get_reviews_service() -> ReviewsService:
    return ReviewsService()


@lru_cache
def get_apps_service() -> AppsService:
    return AppsService()

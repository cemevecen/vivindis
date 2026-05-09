"""Harici entegrasyonların yapılandırma/durum uçları."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.integrations import ExternalScraperStatusResponse

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/external-scraper/status", response_model=ExternalScraperStatusResponse)
async def external_scraper_status() -> ExternalScraperStatusResponse:
    settings = get_settings()
    missing: list[str] = []
    if not settings.external_scraper_apify_token.strip():
        missing.append("EXTERNAL_SCRAPER_APIFY_TOKEN")
    actor = (settings.external_scraper_google_maps_actor or "").strip()
    if not actor:
        missing.append("EXTERNAL_SCRAPER_GOOGLE_MAPS_ACTOR")
    return ExternalScraperStatusResponse(
        provider="apify",
        enabled=len(missing) == 0,
        actor=actor or "dadhalfdev/google-maps-reviews-scraper",
        timeout_seconds=max(30, int(settings.external_scraper_timeout_seconds or 120)),
        missing=missing,
    )

"""Harici entegrasyonların yapılandırma/durum uçları."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.integrations import ExternalScraperStatusResponse

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/external-scraper/status", response_model=ExternalScraperStatusResponse)
async def external_scraper_status() -> ExternalScraperStatusResponse:
    settings = get_settings()
    token_ok = bool(settings.external_scraper_apify_token.strip())
    return ExternalScraperStatusResponse(
        enabled=token_ok,
        marketplace_analysis_ready=token_ok,
    )

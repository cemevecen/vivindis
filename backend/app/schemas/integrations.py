"""Dış entegrasyon durum şemaları."""

from __future__ import annotations

from pydantic import BaseModel


class ExternalScraperStatusResponse(BaseModel):
    """Apify pazaryeri çekimi: token tanımlıysa tam yetki."""

    enabled: bool
    marketplace_analysis_ready: bool

"""Dış entegrasyon durum şemaları."""

from __future__ import annotations

from pydantic import BaseModel


class ExternalScraperStatusResponse(BaseModel):
    provider: str
    enabled: bool
    actor: str
    timeout_seconds: int
    missing: list[str]

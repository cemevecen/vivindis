"""Mağaza arama sonuçları (Play / App Store arama API)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

StorePlatform = Literal["google_play", "app_store"]


class StoreSearchHit(BaseModel):
    """Tek bir arama sonucu — uygulama oluşturma formu ile uyumlu alanlar."""

    store: StorePlatform
    package_name: str = Field(default="", max_length=255)
    bundle_id: str | None = Field(default=None, max_length=255)
    name: str = Field(default="", max_length=512)
    icon_url: str | None = Field(default=None, max_length=2048)
    developer: str | None = Field(default=None, max_length=512)
    category: str | None = Field(default=None, max_length=255)
    score: float | None = None

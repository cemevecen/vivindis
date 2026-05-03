"""Mağaza arama — birleşik JSON cevap (Play / App Store katalog)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

StoreSearchPlatform = Literal["google_play", "app_store"]


class StoreSearchResultItem(BaseModel):
    """Tek arama satırı."""

    id: str = Field(..., max_length=255, description="Play: package name; App Store: trackId")
    name: str = Field(default="", max_length=512)
    developer: str | None = Field(default=None, max_length=512)
    icon: str | None = Field(default=None, max_length=2048)
    rating: float | None = Field(default=None, description="Ortalama puan")
    review_count: int | None = Field(default=None, description="Yorum sayısı (varsa)")
    platform: StoreSearchPlatform
    store_url: str | None = Field(default=None, max_length=2048)


class StoreSearchResponse(BaseModel):
    results: list[StoreSearchResultItem] = Field(default_factory=list)

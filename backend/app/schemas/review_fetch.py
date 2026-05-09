"""Yorum çekme işi şemaları."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.enums import FetchStatus


_ALLOWED_REVIEW_LIMITS = frozenset({100, 500, 1000, 5000})


class ReviewFetchCreate(BaseModel):
    from_date: date
    to_date: date
    review_scope: str = "global"
    lang: str | None = None
    country: str | None = None
    global_langs: list[str] | None = None
    review_limit: int | None = None

    @field_validator("review_limit")
    @classmethod
    def validate_review_limit(cls, v: int | None) -> int | None:
        if v is None:
            return None
        if v not in _ALLOWED_REVIEW_LIMITS:
            msg = "review_limit yalnızca 100, 500, 1000 veya 5000 olabilir (veya boş bırakılabilir)."
            raise ValueError(msg)
        return v

    @model_validator(mode="after")
    def check_range(self) -> ReviewFetchCreate:
        if self.from_date > self.to_date:
            msg = "from_date, to_date'den sonra olamaz."
            raise ValueError(msg)
        if self.review_scope not in {"local", "global"}:
            msg = "review_scope yalnızca 'local' veya 'global' olabilir."
            raise ValueError(msg)
        if self.lang is not None:
            self.lang = self.lang.strip().lower()[:8] or None
        if self.country is not None:
            self.country = self.country.strip().lower()[:8] or None
        if self.global_langs is not None:
            normalized: list[str] = []
            seen: set[str] = set()
            for item in self.global_langs:
                clean = str(item).strip().lower()[:8]
                if not clean or clean in seen:
                    continue
                seen.add(clean)
                normalized.append(clean)
            self.global_langs = normalized[:24] or None
        return self


class ReviewFetchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    app_id: uuid.UUID
    status: FetchStatus
    from_date: date
    to_date: date
    review_limit: int | None
    review_scope: str
    source: str
    review_count: int
    error_message: str | None
    seller_intelligence_json: dict[str, Any] | None = None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class ReviewFetchWithAppNameResponse(ReviewFetchResponse):
    """Kullanıcının tüm uygulamalarındaki son çekimler listesi için."""

    app_name: str


class MarketplaceSellerFetchCreate(BaseModel):
    """TR pazaryeri satıcı profili — Apify `turkish-marketplace-seller-intelligence`."""

    from_date: date
    to_date: date
    seller_url: str
    max_sellers: int = 1

    @staticmethod
    def _normalize_tr_marketplace_url(raw: str) -> str:
        u = raw.strip()
        if len(u) < 12:
            msg = "seller_url geçerli bir bağlantı olmalıdır."
            raise ValueError(msg)
        lower = u.lower()
        if "amazon." in lower or "amazon.com" in lower:
            msg = "Amazon satıcı URL'leri bu entegrasyonla desteklenmiyor (aktör yalnızca TR pazaryerleri)."
            raise ValueError(msg)
        hosts = ("trendyol.com", "hepsiburada.com", "n11.com")
        if not any(h in lower for h in hosts):
            msg = "Yalnızca Trendyol, Hepsiburada veya N11 satıcı mağaza bağlantıları kabul edilir."
            raise ValueError(msg)
        return u[:2048]

    @model_validator(mode="after")
    def validate_marketplace_request(self) -> MarketplaceSellerFetchCreate:
        if self.from_date > self.to_date:
            msg = "from_date, to_date'den sonra olamaz."
            raise ValueError(msg)
        self.seller_url = self._normalize_tr_marketplace_url(self.seller_url)
        self.max_sellers = max(1, min(10, int(self.max_sellers)))
        return self

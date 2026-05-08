"""Yorum çekme işi şemaları."""

from __future__ import annotations

import uuid
from datetime import date, datetime

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
    review_count: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class ReviewFetchWithAppNameResponse(ReviewFetchResponse):
    """Kullanıcının tüm uygulamalarındaki son çekimler listesi için."""

    app_name: str

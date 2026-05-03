"""Yorum şemaları."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import StorePlatform


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    app_id: uuid.UUID
    fetch_id: uuid.UUID
    store_review_id: str
    platform: StorePlatform
    rating: int = Field(ge=1, le=5)
    title: str | None
    body: str
    author: str | None
    lang: str
    review_date: date
    thumbs_up: int
    developer_reply: str | None
    reply_date: date | None
    created_at: datetime


class ReviewListResponse(BaseModel):
    items: list[ReviewResponse]
    total: int

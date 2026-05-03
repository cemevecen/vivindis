"""Yorum çekme işi şemaları."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import FetchStatus


class ReviewFetchCreate(BaseModel):
    from_date: date
    to_date: date

    @model_validator(mode="after")
    def check_range(self) -> ReviewFetchCreate:
        if self.from_date > self.to_date:
            msg = "from_date, to_date'den sonra olamaz."
            raise ValueError(msg)
        return self


class ReviewFetchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    app_id: uuid.UUID
    status: FetchStatus
    from_date: date
    to_date: date
    review_count: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

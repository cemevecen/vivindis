"""Manuel yorum içe aktarma (dosya / yapıştırma) — tamamlanmış fetch üretir."""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field, model_validator


class ReviewImportItem(BaseModel):
    body: str = Field(min_length=1, max_length=20000)
    rating: int | None = Field(default=None, ge=1, le=5)


class ReviewImportCreate(BaseModel):
    from_date: date
    to_date: date
    items: list[ReviewImportItem] = Field(min_length=1, max_length=3000)

    @model_validator(mode="after")
    def check_range(self) -> ReviewImportCreate:
        if self.from_date > self.to_date:
            msg = "from_date, to_date'den sonra olamaz."
            raise ValueError(msg)
        return self


class ReviewImportResponse(BaseModel):
    fetch_id: uuid.UUID
    review_count: int

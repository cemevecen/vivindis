"""Uygulama istatistik uçları (hafif sorgular)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class ReviewVolumeDay(BaseModel):
    model_config = ConfigDict()

    date: date
    count: int


class AppReviewVolumeStats(BaseModel):
    points: list[ReviewVolumeDay]

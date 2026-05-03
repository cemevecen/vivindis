from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ReviewIn(BaseModel):
    text: str
    id: str | None = None
    date: Any = None
    rating: float | int | None = None
    version: str | None = None
    lang: str | None = None


class AnalyzeRequest(BaseModel):
    reviews: list[ReviewIn] = Field(default_factory=list)
    use_heuristic_only: bool = True
    analysis_mode: int = 0
    provider: str = "Google Gemini"
    model: str | None = None

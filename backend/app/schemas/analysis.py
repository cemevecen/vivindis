"""Analiz şemaları."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnalysisStatus, AnalysisType


class AnalysisStartRequest(BaseModel):
    """Oturum 4'te Celery tetiklenecek; şimdilik yalnızca DB kaydı oluşturulur."""

    types: list[AnalysisType] = Field(
        default_factory=lambda: [AnalysisType.HEURISTIC, AnalysisType.AI],
        min_length=1,
    )


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    app_id: uuid.UUID
    fetch_id: uuid.UUID
    type: AnalysisType
    status: AnalysisStatus
    result: dict[str, Any] | list[Any] | None
    model_used: str | None
    tokens_used: int | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


class AnalysisListResponse(BaseModel):
    items: list[AnalysisResponse]

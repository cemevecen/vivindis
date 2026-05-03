"""Heuristic veya AI analiz çalışması ve sonucu."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisStatus, AnalysisType

if TYPE_CHECKING:
    from app.models.app import App
    from app.models.review_fetch import ReviewFetch


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    app_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("apps.id", ondelete="CASCADE"),
        index=True,
    )
    fetch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("review_fetches.id", ondelete="CASCADE"),
        index=True,
    )
    type: Mapped[AnalysisType] = mapped_column(
        SAEnum(AnalysisType, name="analysis_type", native_enum=False, length=32),
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        SAEnum(AnalysisStatus, name="analysis_status", native_enum=False, length=32),
        default=AnalysisStatus.PENDING,
    )
    result: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSONB, nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(128), nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    app: Mapped["App"] = relationship("App", back_populates="analyses")
    fetch: Mapped["ReviewFetch"] = relationship("ReviewFetch", back_populates="analyses")

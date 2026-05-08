"""Bir uygulama için tarih aralığında yorum çekme işi."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import FetchStatus

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.app import App
    from app.models.review import Review


class ReviewFetch(Base):
    __tablename__ = "review_fetches"

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
    status: Mapped[FetchStatus] = mapped_column(
        SAEnum(FetchStatus, name="fetch_status", native_enum=False, length=32),
        default=FetchStatus.PENDING,
    )
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    review_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    app: Mapped["App"] = relationship("App", back_populates="review_fetches")
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="fetch",
        cascade="all, delete-orphan",
    )
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis",
        back_populates="fetch",
        cascade="all, delete-orphan",
    )

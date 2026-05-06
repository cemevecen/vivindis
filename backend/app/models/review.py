"""Tek bir mağaza yorumu."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import StorePlatform

if TYPE_CHECKING:
    from app.models.app import App
    from app.models.review_fetch import ReviewFetch


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("platform", "store_review_id", name="uq_reviews_platform_store_id"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
    )

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
    store_review_id: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[StorePlatform] = mapped_column(
        SAEnum(StorePlatform, name="review_platform", native_enum=False, length=32),
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    body: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str | None] = mapped_column(String(512), nullable=True)
    author_uri: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    app_version_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lang: Mapped[str] = mapped_column(String(16), default="und")
    review_date: Mapped[date] = mapped_column("review_date", Date, nullable=False)
    thumbs_up: Mapped[int] = mapped_column(Integer, default=0)
    developer_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    app: Mapped["App"] = relationship("App", back_populates="reviews")
    fetch: Mapped["ReviewFetch"] = relationship("ReviewFetch", back_populates="reviews")

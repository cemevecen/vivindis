"""Kullanıcının takip ettiği mağaza uygulaması kaydı."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AppPlatform

if TYPE_CHECKING:
    from app.models.analysis import Analysis
    from app.models.review import Review
    from app.models.review_fetch import ReviewFetch
    from app.models.user import User


class App(Base):
    __tablename__ = "apps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    platform: Mapped[AppPlatform] = mapped_column(
        SAEnum(AppPlatform, name="app_platform", native_enum=False, length=32),
    )
    package_name: Mapped[str] = mapped_column(String(255), default="")
    bundle_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(512), default="")
    icon_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    developer: Mapped[str | None] = mapped_column(String(512), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship("User", back_populates="apps")
    review_fetches: Mapped[list["ReviewFetch"]] = relationship(
        "ReviewFetch",
        back_populates="app",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="app",
        cascade="all, delete-orphan",
    )
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis",
        back_populates="app",
        cascade="all, delete-orphan",
    )

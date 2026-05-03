"""SQLAlchemy modelleri — Alembic metadata için tüm tablolar import edilir."""

from __future__ import annotations

from app.models.analysis import Analysis
from app.models.app import App
from app.models.base import Base
from app.models.enums import (
    AnalysisStatus,
    AnalysisType,
    AppPlatform,
    FetchStatus,
    Plan,
    StorePlatform,
)
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.models.user import User

__all__ = [
    "Analysis",
    "AnalysisStatus",
    "AnalysisType",
    "App",
    "AppPlatform",
    "Base",
    "FetchStatus",
    "Plan",
    "Review",
    "ReviewFetch",
    "StorePlatform",
    "User",
]

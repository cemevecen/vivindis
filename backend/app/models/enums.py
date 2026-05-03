"""PostgreSQL ile uyumlu string enum değerleri."""

from __future__ import annotations

from enum import StrEnum


class Plan(StrEnum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class AppPlatform(StrEnum):
    GOOGLE_PLAY = "google_play"
    APP_STORE = "app_store"
    BOTH = "both"


class StorePlatform(StrEnum):
    """Yorum kaydı hangi mağazadan geldiği (App.platform `both` olabilir; satır bazında tek mağaza)."""

    GOOGLE_PLAY = "google_play"
    APP_STORE = "app_store"


class FetchStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisType(StrEnum):
    HEURISTIC = "heuristic"
    AI = "ai"


class AnalysisStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

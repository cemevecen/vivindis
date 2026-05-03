"""Celery uygulaması — görevler Oturum 4'te eklenecek."""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

_s = get_settings()
_broker = _s.celery_broker_url or _s.redis_url
_backend = _s.celery_result_backend or _s.redis_url

celery_app = Celery(
    "vivindis",
    broker=_broker,
    backend=_backend,
    include=[],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

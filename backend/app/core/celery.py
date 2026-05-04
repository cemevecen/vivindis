"""Celery uygulaması — scraper ve analysis kuyrukları."""

from __future__ import annotations

from celery import Celery

from app.core.redis_url import patch_process_environ_rediss_urls

# Celery ``conf.result_backend`` önce ``CELERY_RESULT_BACKEND`` env okur; config'ten önce düzelt.
patch_process_environ_rediss_urls()

from app.core.config import get_settings

_s = get_settings()
_broker = _s.celery_broker_url or _s.redis_url
_backend = _s.celery_result_backend or _s.redis_url

celery_app = Celery(
    "vivindis",
    broker=_broker,
    backend=_backend,
    include=[
        "app.workers.scraper",
        "app.workers.heuristic",
        "app.workers.ai",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.scraper.review_fetch_task": {"queue": "scraper"},
        "app.workers.heuristic.heuristic_analysis_task": {"queue": "analysis"},
        "app.workers.ai.ai_analysis_task": {"queue": "analysis"},
    },
    task_default_queue="celery",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

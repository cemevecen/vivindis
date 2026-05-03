"""Gemini tabanlı AI analiz — `analysis` kuyruğu."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from app.core.celery import celery_app
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.analysis import Analysis
from app.models.enums import AnalysisStatus, AnalysisType
from app.models.review import Review
from app.services import gemini as gemini_svc
from app.workers.runtime import run_async_db

log = get_logger(__name__)

_BATCH = 50


def _build_batches(reviews: list[Review]) -> list[str]:
    chunks: list[str] = []
    buf: list[str] = []
    for i, r in enumerate(reviews):
        line = f"{int(r.rating)}\t{(r.body or '').replace(chr(10), ' ')[:1500]}"
        buf.append(line)
        if len(buf) >= _BATCH or i == len(reviews) - 1:
            chunks.append("\n".join(buf))
            buf = []
    return chunks


async def _run_ai(session: Any, analysis_id: uuid.UUID) -> None:
    row = await session.get(Analysis, analysis_id)
    if row is None or row.type != AnalysisType.AI:
        log.warning("ai_skip_missing", analysis_id=str(analysis_id))
        return
    if row.status != AnalysisStatus.PENDING:
        log.info("ai_skip_status", analysis_id=str(analysis_id), status=row.status.value)
        return

    settings = get_settings()
    if not settings.gemini_api_key.strip():
        row.status = AnalysisStatus.FAILED
        row.error_message = "GEMINI_API_KEY tanımlı değil."
        row.completed_at = datetime.now(UTC)
        return

    row.status = AnalysisStatus.RUNNING
    await session.flush()

    res = await session.execute(select(Review).where(Review.fetch_id == row.fetch_id))
    revs = list(res.scalars().all())
    if not revs:
        row.result = {
            "overall_score": 0.0,
            "sentiment": {"positive": 0.0, "neutral": 1.0, "negative": 0.0},
            "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
            "top_topics": [],
            "top_issues": [],
            "highlights": [],
            "recommendations": ["Yorum yok; AI analizi atlandı."],
            "lang_distribution": {},
        }
        row.status = AnalysisStatus.COMPLETED
        row.completed_at = datetime.now(UTC)
        row.model_used = gemini_svc.get_gemini_model_name()
        return

    batches = _build_batches(revs)
    parts: list[dict[str, Any]] = []
    for idx, payload in enumerate(batches):
        parts.append(gemini_svc.generate_review_batch_json(idx, payload))

    merged = gemini_svc.merge_batch_results(parts)
    row.result = merged
    row.status = AnalysisStatus.COMPLETED
    row.completed_at = datetime.now(UTC)
    row.model_used = gemini_svc.get_gemini_model_name()
    log.info("ai_done", analysis_id=str(analysis_id), batches=len(batches))


async def _fail_ai(session: Any, analysis_id: uuid.UUID, message: str) -> None:
    row = await session.get(Analysis, analysis_id)
    if row is None:
        return
    row.status = AnalysisStatus.FAILED
    row.error_message = message[:8000]
    row.completed_at = datetime.now(UTC)


@celery_app.task(name="app.workers.ai.ai_analysis_task")
def ai_analysis_task(analysis_id: str) -> None:
    aid = uuid.UUID(analysis_id)
    try:
        run_async_db(_run_ai, aid)
    except Exception as exc:
        log.exception("ai_failed", analysis_id=analysis_id)
        run_async_db(_fail_ai, aid, str(exc))
        raise


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

_ONE_SHOT_REVIEW_LIMIT = 500
_MAX_BODY_CHARS = 300
_MAX_PAYLOAD_BYTES = 6 * 1024 * 1024


def _build_one_shot_payload(revs: list[Review]) -> tuple[str, int]:
    lines: list[str] = []
    used = 0
    included = 0
    for r in revs[:_ONE_SHOT_REVIEW_LIMIT]:
        line = f"{int(r.rating)}\t{(r.body or '').replace(chr(10), ' ')[:_MAX_BODY_CHARS]}"
        line_b = len(line.encode("utf-8"))
        extra = line_b if not lines else line_b + 1
        if used + extra > _MAX_PAYLOAD_BYTES:
            break
        lines.append(line)
        used += extra
        included += 1
    return "\n".join(lines), included


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

    payload, included_reviews = _build_one_shot_payload(revs)
    row.result = gemini_svc.generate_reviews_one_shot_json(payload)
    row.status = AnalysisStatus.COMPLETED
    row.completed_at = datetime.now(UTC)
    row.model_used = gemini_svc.get_gemini_model_name()
    log.info("ai_done", analysis_id=str(analysis_id), reviews=included_reviews)


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


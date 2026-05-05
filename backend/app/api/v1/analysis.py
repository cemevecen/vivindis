"""Analiz başlatma ve sonuç okuma (Oturum 4: Celery ile işlenecek)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.analysis import Analysis
from app.models.app import App
from app.models.enums import AnalysisStatus, AnalysisType, FetchStatus
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.analysis import AnalysisResponse, AnalysisStartRequest

router = APIRouter(tags=["analysis"])
log = get_logger(__name__)


async def _require_fetch_for_user(
    fetch_id: uuid.UUID,
    session: AsyncSession,
    current_user: User,
) -> ReviewFetch:
    _ = current_user
    result = await session.execute(
        select(ReviewFetch)
        .where(
            ReviewFetch.id == fetch_id,
        ),
    )
    fetch = result.scalar_one_or_none()
    if fetch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fetch bulunamadı.",
        )
    return fetch


@router.post(
    "/fetches/{fetch_id}/analyze",
    response_model=list[AnalysisResponse],
    status_code=status.HTTP_201_CREATED,
)
async def start_analyze(
    fetch_id: uuid.UUID,
    body: AnalysisStartRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Analysis]:
    from app.workers.ai import _run_ai
    from app.workers.heuristic import _run_heuristic

    fetch = await _require_fetch_for_user(fetch_id, session, current_user)
    if fetch.status != FetchStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analiz yalnızca yorum çekimi tamamlandıktan sonra başlatılabilir.",
        )

    created: list[Analysis] = []
    for atype in body.types:
        dup = await session.execute(
            select(Analysis).where(
                Analysis.fetch_id == fetch.id,
                Analysis.type == atype,
                Analysis.status.in_(
                    (
                        AnalysisStatus.PENDING,
                        AnalysisStatus.RUNNING,
                    ),
                ),
            ),
        )
        if dup.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Bu fetch için {atype.value} analizi zaten bekliyor veya çalışıyor.",
            )
        row = Analysis(
            app_id=fetch.app_id,
            fetch_id=fetch.id,
            type=atype,
            status=AnalysisStatus.PENDING,
        )
        session.add(row)
        await session.flush()
        if atype == AnalysisType.HEURISTIC:
            await _run_heuristic(session, row.id)
        elif atype == AnalysisType.AI:
            await _run_ai(session, row.id)
        created.append(row)
        log.info("analysis_completed_inline", analysis_id=str(row.id), analysis_type=atype.value)

    return created


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Analysis:
    result = await session.execute(
        select(Analysis)
        .where(
            Analysis.id == analysis_id,
        ),
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analiz bulunamadı.",
        )
    return row

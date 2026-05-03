"""Analiz başlatma ve sonuç okuma (Oturum 4: Celery ile işlenecek)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_app_owned
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.analysis import Analysis
from app.models.app import App
from app.models.enums import AnalysisStatus
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.analysis import AnalysisListResponse, AnalysisResponse, AnalysisStartRequest

router = APIRouter(tags=["analysis"])
log = get_logger(__name__)


async def _require_fetch_for_user(
    fetch_id: uuid.UUID,
    session: AsyncSession,
    current_user: User,
) -> ReviewFetch:
    result = await session.execute(
        select(ReviewFetch)
        .join(App, ReviewFetch.app_id == App.id)
        .where(
            ReviewFetch.id == fetch_id,
            App.user_id == current_user.id,
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
    fetch = await _require_fetch_for_user(fetch_id, session, current_user)

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
        created.append(row)
        log.info("analysis_enqueued_stub", analysis_id=str(row.id), analysis_type=atype.value)

    return created


@router.get("/apps/{app_id}/analyses", response_model=AnalysisListResponse)
async def list_analyses(
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AnalysisListResponse:
    result = await session.execute(
        select(Analysis)
        .where(Analysis.app_id == app.id)
        .order_by(Analysis.created_at.desc()),
    )
    rows = list(result.scalars().all())
    return AnalysisListResponse(items=[AnalysisResponse.model_validate(r) for r in rows])


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Analysis:
    result = await session.execute(
        select(Analysis)
        .join(App, Analysis.app_id == App.id)
        .where(
            Analysis.id == analysis_id,
            App.user_id == current_user.id,
        ),
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analiz bulunamadı.",
        )
    return row

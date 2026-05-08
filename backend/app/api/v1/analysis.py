"""Analiz başlatma ve sonuç okuma (Oturum 4: Celery ile işlenecek)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.analysis import Analysis
from app.models.app import App
from app.models.enums import AnalysisStatus, AnalysisType, FetchStatus
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.analysis import AnalysisResponse, AnalysisStartRequest
from app.schemas.insights import (
    ActionItem,
    AlertItem,
    BenchmarkBlock,
    BenchmarkScore,
    InsightsResponse,
    ReleaseImpactBlock,
    SegmentRow,
)

router = APIRouter(tags=["analysis"])
log = get_logger(__name__)


def _enqueue_heuristic_analysis(analysis_id: str) -> None:
    from app.workers.heuristic import heuristic_analysis_task

    heuristic_analysis_task.apply_async(args=[analysis_id], queue="analysis")


def _enqueue_ai_analysis(analysis_id: str) -> None:
    from app.workers.ai import ai_analysis_task

    ai_analysis_task.apply_async(args=[analysis_id], queue="analysis")


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


async def _require_app_for_user(
    app_id: uuid.UUID,
    session: AsyncSession,
    current_user: User,
) -> App:
    result = await session.execute(
        select(App).where(
            App.id == app_id,
            App.user_id == current_user.id,
        ),
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uygulama bulunamadı.",
        )
    return app


def _trend_direction(delta: float, eps: float = 0.05) -> str:
    if delta > eps:
        return "up"
    if delta < -eps:
        return "down"
    return "flat"


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
    background_tasks: BackgroundTasks,
) -> list[Analysis]:
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
        created.append(row)
        if atype == AnalysisType.HEURISTIC:
            background_tasks.add_task(_enqueue_heuristic_analysis, str(row.id))
        elif atype == AnalysisType.AI:
            background_tasks.add_task(_enqueue_ai_analysis, str(row.id))
        log.info("analysis_enqueued", analysis_id=str(row.id), analysis_type=atype.value)

    return created


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


@router.get("/apps/{app_id}/insights", response_model=InsightsResponse)
async def get_app_insights(
    app_id: uuid.UUID,
    fetch_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> InsightsResponse:
    app = await _require_app_for_user(app_id, session, current_user)
    fetch = await _require_fetch_for_user(fetch_id, session, current_user)
    if fetch.app_id != app.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fetch bu uygulamaya ait değil.")

    # App baseline metrics (selected fetch)
    app_metric_q = await session.execute(
        select(
            func.avg(Review.rating),
            func.count().filter(Review.rating <= 2),
            func.count().filter(Review.rating >= 4),
            func.count(),
        ).where(Review.fetch_id == fetch.id),
    )
    app_avg_rating, app_low_count, app_high_count, app_total = app_metric_q.one()
    app_avg_rating = float(app_avg_rating or 0.0)
    app_total_n = int(app_total or 0)
    app_low_share = float((app_low_count or 0) / app_total_n) if app_total_n else 0.0
    app_high_share = float((app_high_count or 0) / app_total_n) if app_total_n else 0.0

    # Category benchmark across all apps (excluding current app)
    category_filters = [App.category == app.category] if app.category else []
    category_metric_stmt = (
        select(
            func.avg(Review.rating),
            func.count().filter(Review.rating <= 2),
            func.count().filter(Review.rating >= 4),
            func.count(),
            func.count(func.distinct(App.id)),
        )
        .select_from(Review)
        .join(App, App.id == Review.app_id)
        .where(App.id != app.id, *category_filters)
    )
    cat_avg_rating, cat_low_count, cat_high_count, cat_total, cat_app_count = (await session.execute(category_metric_stmt)).one()
    cat_total_n = int(cat_total or 0)
    cat_avg_rating_f = float(cat_avg_rating or app_avg_rating or 0.0)
    cat_low_share = float((cat_low_count or 0) / cat_total_n) if cat_total_n else app_low_share
    cat_high_share = float((cat_high_count or 0) / cat_total_n) if cat_total_n else app_high_share
    category_sample_apps = int(cat_app_count or 0)

    benchmark_scores = [
        BenchmarkScore(
            label="rating",
            value=round(app_avg_rating, 3),
            delta_vs_category=round(app_avg_rating - cat_avg_rating_f, 3),
            direction=_trend_direction(app_avg_rating - cat_avg_rating_f),
        ),
        BenchmarkScore(
            label="positive_share",
            value=round(app_high_share, 3),
            delta_vs_category=round(app_high_share - cat_high_share, 3),
            direction=_trend_direction(app_high_share - cat_high_share),
        ),
        BenchmarkScore(
            label="low_star_share",
            value=round(app_low_share, 3),
            delta_vs_category=round(cat_low_share - app_low_share, 3),
            direction=_trend_direction(cat_low_share - app_low_share),
        ),
    ]

    # Alerts: low-star spike + keyword burst
    # Safer date boundaries without db-specific arithmetic
    from datetime import timedelta

    cur_start = fetch.to_date - timedelta(days=7)
    prev_start = fetch.to_date - timedelta(days=14)
    prev_end = cur_start

    current_7_stmt = select(
        func.count().filter(Review.rating <= 2),
        func.count(),
    ).where(Review.fetch_id == fetch.id, Review.review_date >= cur_start)
    previous_7_stmt = select(
        func.count().filter(Review.rating <= 2),
        func.count(),
    ).where(Review.fetch_id == fetch.id, Review.review_date >= prev_start, Review.review_date < prev_end)
    cur_low, cur_total = (await session.execute(current_7_stmt)).one()
    prev_low, prev_total = (await session.execute(previous_7_stmt)).one()

    cur_ratio = float((cur_low or 0) / int(cur_total or 1))
    prev_ratio = float((prev_low or 0) / int(prev_total or 1))
    low_star_spike = cur_ratio > (prev_ratio + 0.08) and int(cur_total or 0) >= 10

    review_rows = (
        await session.execute(
            select(Review.body).where(Review.fetch_id == fetch.id, Review.body.is_not(None)).limit(4000),
        )
    ).scalars().all()
    text_blob = "\n".join(r.lower() for r in review_rows if r)
    keyword_groups = {
        "crash": ["crash", "dondu", "çöktü", "force close"],
        "payment": ["payment", "ödeme", "kart", "checkout"],
        "login": ["login", "giriş", "otp", "şifre"],
    }
    keyword_counts = {k: sum(text_blob.count(t) for t in terms) for k, terms in keyword_groups.items()}
    total_kw = sum(keyword_counts.values()) or 1

    alerts = [
        AlertItem(
            key="low_star_spike",
            title="1-2 yıldız artışı",
            severity="high" if low_star_spike else "low",
            detail=f"Son 7 gün düşük yıldız oranı: %{cur_ratio*100:.1f} (önceki: %{prev_ratio*100:.1f})",
            triggered=low_star_spike,
        ),
    ]
    for key, count in keyword_counts.items():
        share = count / total_kw
        alerts.append(
            AlertItem(
                key=f"{key}_burst",
                title=f"{key} konusu artışı",
                severity="medium" if share >= 0.2 else "low",
                detail=f"Toplam kritik anahtar eşleşmesi içinde payı %{share*100:.1f} (adet: {count})",
                triggered=share >= 0.2 and count >= 8,
            ),
        )

    # Action items (top 5)
    actions: list[ActionItem] = []
    for key, count in sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True):
        if count <= 0:
            continue
        if key == "crash":
            actions.append(
                ActionItem(
                    problem="Çökme/kitlenme şikayetleri artıyor",
                    recommendation="Crash-free oranını release bazında kır ve en çok etkilenen sürümler için hotfix planla.",
                    owner="Engineering",
                    priority="P0",
                ),
            )
        elif key == "payment":
            actions.append(
                ActionItem(
                    problem="Ödeme akışıyla ilgili olumsuz geri bildirim yoğun",
                    recommendation="Ödeme funnel’ında drop noktalarını ölç, başarısız ödeme hatalarını kullanıcıya anlaşılır mesajlarla geri ver.",
                    owner="Product",
                    priority="P1",
                ),
            )
        elif key == "login":
            actions.append(
                ActionItem(
                    problem="Giriş/hesap erişimi sorunları tekrarlanıyor",
                    recommendation="OTP, şifre sıfırlama ve device binding adımlarında friction analizini tamamla, destek makrolarını güncelle.",
                    owner="Support",
                    priority="P1",
                ),
            )
    if low_star_spike:
        actions.append(
            ActionItem(
                problem="Düşük yıldız oranı son dönemde anlamlı arttı",
                recommendation="Son release notlarıyla olumsuz konuları eşleştirip rollback/hotfix kararını 24 saat içinde netleştir.",
                owner="PM",
                priority="P0",
            ),
        )
    actions = actions[:5]

    # Release impact
    version_rows = (
        await session.execute(
            select(
                Review.app_version_label,
                func.count(),
                func.avg(Review.rating),
                func.count().filter(Review.rating >= 4),
                func.count().filter(Review.rating <= 2),
            )
            .where(Review.fetch_id == fetch.id, Review.app_version_label.is_not(None))
            .group_by(Review.app_version_label)
            .order_by(func.count().desc()),
        )
    ).all()
    current_version = version_rows[0] if len(version_rows) > 0 else None
    previous_version = version_rows[1] if len(version_rows) > 1 else None
    cur_avg = float(current_version[2]) if current_version and current_version[2] is not None else None
    prev_avg = float(previous_version[2]) if previous_version and previous_version[2] is not None else None
    delta = (cur_avg - prev_avg) if (cur_avg is not None and prev_avg is not None) else None
    summary = (
        "Sürüm karşılaştırması için yeterli veri yok."
        if delta is None
        else ("Son sürümde puan yükselişi var." if delta > 0.1 else "Son sürümde puan düşüşü var." if delta < -0.1 else "Sürüm etkisi nötr görünüyor.")
    )

    # Segmentation (lang/platform/version)
    segment_rows_raw = []
    for segment_key, col in (
        ("lang", Review.lang),
        ("platform", Review.platform),
        ("version", Review.app_version_label),
    ):
        rows = (
            await session.execute(
                select(
                    col,
                    func.count(),
                    func.avg(Review.rating),
                )
                .where(Review.fetch_id == fetch.id, col.is_not(None))
                .group_by(col)
                .order_by(func.count().desc())
                .limit(4),
            )
        ).all()
        for value, count, avg in rows:
            segment_rows_raw.append(
                SegmentRow(
                    segment=f"{segment_key}: {value}",
                    reviews=int(count or 0),
                    avg_rating=round(float(avg or 0.0), 3),
                ),
            )
    segments = sorted(segment_rows_raw, key=lambda r: r.reviews, reverse=True)[:8]

    return InsightsResponse(
        benchmark=BenchmarkBlock(
            app_name=app.name,
            category=app.category or "unknown",
            category_sample_apps=category_sample_apps,
            scores=benchmark_scores,
        ),
        alerts=alerts,
        actions=actions,
        release_impact=ReleaseImpactBlock(
            current_version=str(current_version[0]) if current_version else None,
            previous_version=str(previous_version[0]) if previous_version else None,
            current_avg_rating=round(cur_avg, 3) if cur_avg is not None else None,
            previous_avg_rating=round(prev_avg, 3) if prev_avg is not None else None,
            rating_delta=round(delta, 3) if delta is not None else None,
            summary=summary,
        ),
        segments=segments,
    )

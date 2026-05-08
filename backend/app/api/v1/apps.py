"""Uygulama CRUD ve uygulama kapsamındaki fetch / yorum listeleri."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_app_owned
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.analysis import Analysis
from app.models.app import App
from app.models.enums import AppPlatform, FetchStatus, StorePlatform
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.analysis import AnalysisListResponse, AnalysisResponse
from app.schemas.app import AppCreate, AppResponse, AppUpdate
from app.schemas.review import ReviewListResponse, ReviewResponse
from app.schemas.review_fetch import ReviewFetchCreate, ReviewFetchResponse, ReviewFetchWithAppNameResponse
from app.schemas.review_import import ReviewImportCreate, ReviewImportResponse
from app.workers.scraper import review_fetch_task

router = APIRouter(prefix="/apps", tags=["apps"])
log = get_logger(__name__)


def _enqueue_review_fetch(
    fetch_id: str,
    review_scope: str,
    lang: str | None,
    country: str | None,
    global_langs: list[str] | None,
) -> None:
    review_fetch_task.apply_async(
        args=[fetch_id, review_scope, lang, country, global_langs],
        queue="scraper",
    )


def _store_platform_for_app(app: App) -> StorePlatform:
    if app.platform == AppPlatform.APP_STORE:
        return StorePlatform.APP_STORE
    return StorePlatform.GOOGLE_PLAY


@router.get("", response_model=list[AppResponse])
async def list_apps(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[App]:
    result = await session.execute(
        select(App).where(App.user_id == current_user.id).order_by(App.created_at.desc()),
    )
    return list(result.scalars().all())


@router.get("/recent-fetches", response_model=list[ReviewFetchWithAppNameResponse])
async def list_recent_fetches_for_user(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[ReviewFetchWithAppNameResponse]:
    """Kullanıcının tüm uygulamalarına ait son yorum çekimleri (uygulamalar listesi özeti)."""
    result = await session.execute(
        select(ReviewFetch, App.name)
        .join(App, App.id == ReviewFetch.app_id)
        .where(App.user_id == current_user.id)
        .order_by(ReviewFetch.created_at.desc())
        .limit(limit),
    )
    out: list[ReviewFetchWithAppNameResponse] = []
    for fetch_row, app_name in result.all():
        base = ReviewFetchResponse.model_validate(fetch_row).model_dump()
        out.append(ReviewFetchWithAppNameResponse(**base, app_name=app_name or ""))
    return out


@router.post("", response_model=AppResponse, status_code=status.HTTP_201_CREATED)
async def create_app(
    body: AppCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> App:
    app = App(
        user_id=current_user.id,
        platform=body.platform,
        package_name=body.package_name,
        bundle_id=body.bundle_id,
        name=body.name,
        icon_url=body.icon_url,
        developer=body.developer,
        category=body.category,
        is_active=body.is_active,
    )
    session.add(app)
    await session.flush()
    log.info("app_created", app_id=str(app.id), user_id=str(current_user.id))
    return app


@router.get("/{app_id}", response_model=AppResponse)
async def get_app(
    app: Annotated[App, Depends(require_app_owned)],
) -> App:
    return app


@router.put("/{app_id}", response_model=AppResponse)
async def update_app(
    body: AppUpdate,
    app: Annotated[App, Depends(require_app_owned)],
) -> App:
    data = body.model_dump(exclude_unset=True)
    for key, val in data.items():
        setattr(app, key, val)
    log.info("app_updated", app_id=str(app.id))
    return app


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app(
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> Response:
    await session.delete(app)
    log.info("app_deleted", app_id=str(app.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{app_id}/fetch",
    response_model=ReviewFetchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_fetch(
    body: ReviewFetchCreate,
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    background_tasks: BackgroundTasks,
) -> ReviewFetch:
    scope = "local" if body.review_scope == "local" else "global"
    fetch = ReviewFetch(
        app_id=app.id,
        status=FetchStatus.PENDING,
        from_date=body.from_date,
        to_date=body.to_date,
        review_limit=body.review_limit,
        review_scope=scope,
        review_count=0,
    )
    session.add(fetch)
    await session.flush()
    log.info("review_fetch_created", fetch_id=str(fetch.id), app_id=str(app.id))
    # Commit hemen: istemci polling GET'i yanıt dönmeden önce çalıştırabilir; ayrıca Celery worker
    # ayrı bağlantıda kaydı görmeli (dependency sonundaki commit bazen yanıttan sonra kalır).
    await session.commit()
    background_tasks.add_task(
        _enqueue_review_fetch,
        str(fetch.id),
        body.review_scope,
        body.lang,
        body.country,
        body.global_langs,
    )
    return fetch


@router.post(
    "/{app_id}/import-reviews",
    response_model=ReviewImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_manual_reviews(
    body: ReviewImportCreate,
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> ReviewImportResponse:
    """Dosya veya yapıştırılan metinden yorum satırları ekler; fetch tamamlanmış sayılır (worker yok)."""
    now = datetime.now(timezone.utc)
    store_platform = _store_platform_for_app(app)
    fetch = ReviewFetch(
        app_id=app.id,
        status=FetchStatus.COMPLETED,
        from_date=body.from_date,
        to_date=body.to_date,
        review_scope="global",
        review_count=len(body.items),
        started_at=now,
        completed_at=now,
    )
    session.add(fetch)
    await session.flush()

    review_date = body.to_date
    for item in body.items:
        rid = uuid.uuid4()
        row = Review(
            app_id=app.id,
            fetch_id=fetch.id,
            store_review_id=f"import-{rid.hex}",
            platform=store_platform,
            rating=item.rating if item.rating is not None else 3,
            title=None,
            body=item.body.strip(),
            author=None,
            lang="und",
            review_date=review_date,
            thumbs_up=0,
            developer_reply=None,
            reply_date=None,
        )
        session.add(row)

    log.info(
        "manual_review_import",
        fetch_id=str(fetch.id),
        app_id=str(app.id),
        count=len(body.items),
    )
    return ReviewImportResponse(fetch_id=fetch.id, review_count=len(body.items))


@router.get("/{app_id}/analyses", response_model=AnalysisListResponse)
async def list_analyses_for_app(
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AnalysisListResponse:
    """Uygulamaya ait tüm analiz kayıtları (polling bu uç üzerinden yapılır)."""
    result = await session.execute(
        select(Analysis)
        .where(Analysis.app_id == app.id)
        .order_by(Analysis.created_at.desc()),
    )
    rows = list(result.scalars().all())
    return AnalysisListResponse(items=[AnalysisResponse.model_validate(r) for r in rows])


@router.get("/{app_id}/fetches", response_model=list[ReviewFetchResponse])
async def list_fetches(
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> list[ReviewFetch]:
    result = await session.execute(
        select(ReviewFetch)
        .where(ReviewFetch.app_id == app.id)
        .order_by(ReviewFetch.created_at.desc()),
    )
    return list(result.scalars().all())


@router.get("/{app_id}/fetches/{fetch_id}", response_model=ReviewFetchResponse)
async def get_fetch(
    fetch_id: uuid.UUID,
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> ReviewFetch:
    result = await session.execute(
        select(ReviewFetch).where(
            ReviewFetch.id == fetch_id,
            ReviewFetch.app_id == app.id,
        ),
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fetch bulunamadı.")
    return row


@router.get("/{app_id}/reviews", response_model=ReviewListResponse)
async def list_reviews(
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    fetch_id: Annotated[uuid.UUID | None, Query()] = None,
) -> ReviewListResponse:
    filters = [Review.app_id == app.id]
    if fetch_id is not None:
        filters.append(Review.fetch_id == fetch_id)

    count_q = await session.execute(select(func.count()).select_from(Review).where(*filters))
    total = int(count_q.scalar_one())

    result = await session.execute(
        select(Review)
        .where(*filters)
        .order_by(Review.review_date.desc(), Review.created_at.desc(), Review.id.desc())
        .limit(limit)
        .offset(offset),
    )
    rows = list(result.scalars().all())
    return ReviewListResponse(
        items=[ReviewResponse.model_validate(r) for r in rows],
        total=total,
    )

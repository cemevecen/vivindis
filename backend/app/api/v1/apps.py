"""Uygulama CRUD ve uygulama kapsamındaki fetch / yorum listeleri."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_app_owned
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.app import App
from app.models.enums import FetchStatus
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.app import AppCreate, AppResponse, AppUpdate
from app.schemas.review import ReviewListResponse, ReviewResponse
from app.schemas.review_fetch import ReviewFetchCreate, ReviewFetchResponse

router = APIRouter(prefix="/apps", tags=["apps"])
log = get_logger(__name__)


@router.get("", response_model=list[AppResponse])
async def list_apps(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[App]:
    result = await session.execute(
        select(App).where(App.user_id == current_user.id).order_by(App.created_at.desc()),
    )
    return list(result.scalars().all())


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
) -> ReviewFetch:
    fetch = ReviewFetch(
        app_id=app.id,
        status=FetchStatus.PENDING,
        from_date=body.from_date,
        to_date=body.to_date,
        review_count=0,
    )
    session.add(fetch)
    await session.flush()
    log.info("review_fetch_created", fetch_id=str(fetch.id), app_id=str(app.id))
    return fetch


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


@router.get("/{app_id}/reviews", response_model=ReviewListResponse)
async def list_reviews(
    app: Annotated[App, Depends(require_app_owned)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReviewListResponse:
    count_q = await session.execute(
        select(func.count()).select_from(Review).where(Review.app_id == app.id),
    )
    total = int(count_q.scalar_one())

    result = await session.execute(
        select(Review)
        .where(Review.app_id == app.id)
        .order_by(Review.review_date.desc(), Review.created_at.desc())
        .limit(limit)
        .offset(offset),
    )
    rows = list(result.scalars().all())
    return ReviewListResponse(
        items=[ReviewResponse.model_validate(r) for r in rows],
        total=total,
    )

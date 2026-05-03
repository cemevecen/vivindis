"""Fetch durumu (tekil) — Oturum 4'te worker durumu güncelleyecek."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_async_session
from app.models.app import App
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.review_fetch import ReviewFetchResponse

router = APIRouter(tags=["reviews"])


@router.get("/fetches/{fetch_id}", response_model=ReviewFetchResponse)
async def get_fetch(
    fetch_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
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

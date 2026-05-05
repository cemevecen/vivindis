"""FastAPI bağımlılıkları."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.models.app import App
from app.models.user import User


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> User:
    result = await session.execute(select(User).where(User.clerk_id == "public"))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            clerk_id="public",
            email="public@vivindis.local",
        )
        session.add(user)
        await session.flush()
    return user


async def require_app_owned(
    app_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> App:
    _ = current_user
    result = await session.execute(
        select(App).where(App.id == app_id),
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uygulama bulunamadı.",
        )
    return app

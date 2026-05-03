"""FastAPI bağımlılıkları."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_clerk_session_token
from app.db.session import get_async_session
from app.models.app import App
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token gerekli.",
        )
    clerk_id = verify_clerk_session_token(creds.credentials)
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı; Clerk webhook ile senkron gerekli olabilir.",
        )
    return user


async def require_app_owned(
    app_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> App:
    result = await session.execute(
        select(App).where(App.id == app_id, App.user_id == current_user.id),
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uygulama bulunamadı.",
        )
    return app

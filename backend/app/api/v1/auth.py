"""Clerk webhook ve mevcut kullanıcı."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.enums import Plan
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()
log = get_logger(__name__)


def _clerk_primary_email(data: dict[str, Any]) -> str | None:
    addresses = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    for addr in addresses:
        if isinstance(addr, dict) and addr.get("id") == primary_id:
            e = addr.get("email_address")
            return str(e) if e else None
    if addresses and isinstance(addresses[0], dict):
        e0 = addresses[0].get("email_address")
        return str(e0) if e0 else None
    return None


def _placeholder_email(clerk_user_id: str) -> str:
    safe = clerk_user_id.replace("|", "_").replace("/", "_")[:200]
    return f"{safe}@clerk.placeholder"


@router.post("/sync", status_code=status.HTTP_200_OK)
async def clerk_webhook_sync(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> dict[str, bool]:
    settings = get_settings()
    secret = settings.clerk_webhook_secret.strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_WEBHOOK_SECRET yapılandırılmadı.",
        )

    body = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    try:
        wh = Webhook(secret)
        payload = wh.verify(body.decode("utf-8"), headers)
    except WebhookVerificationError as exc:
        log.warning("webhook_verify_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook imzası doğrulanamadı.",
        ) from exc

    etype = payload.get("type")
    inner = payload.get("data") or {}
    if not isinstance(inner, dict):
        inner = {}

    clerk_user_id = inner.get("id")
    if not clerk_user_id or not isinstance(clerk_user_id, str):
        log.warning("webhook_missing_user_id", event_type=etype)
        return {"ok": True}

    if etype in ("user.created", "user.updated"):
        email = _clerk_primary_email(inner) or _placeholder_email(clerk_user_id)
        result = await session.execute(select(User).where(User.clerk_id == clerk_user_id))
        user = result.scalar_one_or_none()
        if user is None:
            session.add(
                User(
                    clerk_id=clerk_user_id,
                    email=email,
                    plan=Plan.FREE,
                ),
            )
            log.info("user_created_from_webhook", clerk_id=clerk_user_id)
        else:
            user.email = email
            log.info("user_updated_from_webhook", clerk_id=clerk_user_id)

    elif etype == "user.deleted":
        result = await session.execute(select(User).where(User.clerk_id == clerk_user_id))
        user = result.scalar_one_or_none()
        if user is not None:
            await session.delete(user)
            log.info("user_deleted_from_webhook", clerk_id=clerk_user_id)
    else:
        log.debug("webhook_ignored", event_type=etype)

    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def auth_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user

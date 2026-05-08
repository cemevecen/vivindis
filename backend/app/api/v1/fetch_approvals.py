"""Yönetici onayı (Telegram linki) — kimlik doğrulaması yok; token gizlidir."""

from __future__ import annotations

import html
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.enums import FetchStatus
from app.models.review_fetch import ReviewFetch
from app.services.fetch_approval import hash_approval_token, parse_pending_enqueue
from app.workers.scraper import review_fetch_task

router = APIRouter(tags=["fetch-approvals"])
log = get_logger(__name__)


def _html_page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(
        content=(
            "<!DOCTYPE html><html lang=\"tr\"><head><meta charset=\"utf-8\"/>"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
            f"<title>{html.escape(title)}</title></head><body><p>{html.escape(body)}</p></body></html>"
        ),
        status_code=200,
    )


@router.get("/fetch-approvals/approve", response_class=HTMLResponse)
async def approve_large_fetch(
    token: Annotated[str, Query(min_length=16, max_length=256)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> HTMLResponse:
    """Tek kullanımlık token ile çekimi pending yapar ve Celery kuyruğuna atar."""
    h = hash_approval_token(token)
    result = await session.execute(select(ReviewFetch).where(ReviewFetch.approval_token_hash == h))
    fetch = result.scalar_one_or_none()
    if fetch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geçersiz onay bağlantısı.",
        )

    if fetch.status == FetchStatus.COMPLETED:
        return _html_page("Tamam", "Bu çekim zaten tamamlanmış.")
    if fetch.status in (FetchStatus.RUNNING, FetchStatus.PENDING):
        return _html_page("Tamam", "Bu çekim zaten onaylanmış veya işleniyor.")
    if fetch.status == FetchStatus.FAILED:
        return _html_page("Hata", "Bu çekim kaydı başarısız durumda; yeni bir çekim oluşturun.")
    if fetch.status != FetchStatus.WAITING_APPROVAL:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Beklenmeyen çekim durumu.")

    payload = fetch.pending_enqueue_json
    review_scope, lang, country, global_langs = parse_pending_enqueue(payload)

    fetch.status = FetchStatus.PENDING
    fetch.approval_token_hash = None
    fetch.pending_enqueue_json = None
    await session.commit()

    review_fetch_task.apply_async(
        args=[str(fetch.id), review_scope, lang, country, global_langs],
        queue="scraper",
    )
    log.info("fetch_approval_granted", fetch_id=str(fetch.id))
    return _html_page("Onaylandı", "Çekim kuyruğa alındı. Uygulamadan ilerlemeyi izleyebilirsiniz.")

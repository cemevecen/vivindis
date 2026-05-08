"""Yönetici onayı (Telegram linki) — kimlik doğrulaması yok; token gizlidir."""

from __future__ import annotations

import html
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
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


def _html_page(title: str, body: str, *, status_code: int = 200) -> HTMLResponse:
    return HTMLResponse(
        content=(
            "<!DOCTYPE html><html lang=\"tr\"><head><meta charset=\"utf-8\"/>"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
            f"<title>{html.escape(title)}</title></head><body><p>{html.escape(body)}</p></body></html>"
        ),
        status_code=status_code,
    )


async def _approve_fetch_core(session: AsyncSession, token: str) -> HTMLResponse:
    """Tarayıcıdan açıldığında JSON yerine UTF-8 HTML döner (Telefon Safari uyumu)."""
    raw = token.strip()
    if len(raw) < 16 or len(raw) > 256:
        log.warning("fetch_approval_token_bad_length", length=len(raw))
        return _html_page(
            "Geçersiz bağlantı",
            "Onay bağlantısı eksik veya bozulmuş görünüyor.",
            status_code=404,
        )

    h = hash_approval_token(raw)
    result = await session.execute(select(ReviewFetch).where(ReviewFetch.approval_token_hash == h))
    fetch = result.scalar_one_or_none()
    if fetch is None:
        log.warning("fetch_approval_unknown_token", token_hash_prefix=h[:16])
        return _html_page(
            "Onay başarısız",
            "Geçersiz veya daha önce kullanılmış onay bağlantısı. Yeni bir çekim talebi oluşturabilir "
            "veya uygulama üzerinden durumu kontrol edebilirsiniz.",
            status_code=404,
        )

    if fetch.status == FetchStatus.COMPLETED:
        return _html_page("Tamam", "Bu çekim zaten tamamlanmış.")
    if fetch.status in (FetchStatus.RUNNING, FetchStatus.PENDING):
        return _html_page("Tamam", "Bu çekim zaten onaylanmış veya işleniyor.")
    if fetch.status == FetchStatus.FAILED:
        return _html_page("Hata", "Bu çekim kaydı başarısız durumda; yeni bir çekim oluşturun.")
    if fetch.status != FetchStatus.WAITING_APPROVAL:
        return _html_page(
            "Durum",
            "Bu çekim için onay beklenmiyor.",
            status_code=409,
        )

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


@router.get("/fetch-approvals/approve", response_class=HTMLResponse)
async def approve_large_fetch_query(
    token: Annotated[str, Query(min_length=16, max_length=256)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> HTMLResponse:
    """Sorgu parametreli onay (eski Telegram mesajları ile uyumluluk)."""
    return await _approve_fetch_core(session, token)


@router.get("/fetch-approvals/approve/{token}", response_class=HTMLResponse)
async def approve_large_fetch_path(
    token: Annotated[str, Path(min_length=16, max_length=256)],
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> HTMLResponse:
    """Path tabanlı onay (Telegram ve istemcilerde daha güvenilir)."""
    return await _approve_fetch_core(session, token)

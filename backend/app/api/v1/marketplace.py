"""Pazaryeri (Trendyol, Hepsiburada, N11) özel işlemleri."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_async_session
from app.models.app import App
from app.models.enums import AppPlatform, FetchStatus
from app.models.review_fetch import ReviewFetch
from app.models.user import User
from app.schemas.review_fetch import MarketplaceSellerFetchCreate, ReviewFetchResponse
from app.services.apify_marketplace_seller import run_marketplace_seller_intelligence
from app.workers.scraper import marketplace_seller_fetch_task

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
log = get_logger(__name__)


@router.post(
    "/fetch-seller",
    response_model=ReviewFetchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_decoupled_marketplace_fetch(
    body: MarketplaceSellerFetchCreate,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
) -> ReviewFetch:
    """
    Uygulama bağımlılığı olmadan pazaryeri çekimi başlatır.
    Satıcı ismini otomatik tespit edip gerekirse yeni bir App (Store) oluşturur.
    """
    settings = get_settings()
    if not settings.external_scraper_apify_token.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pazaryeri bağlayıcı yapılandırılmamış (EXTERNAL_SCRAPER_APIFY_TOKEN).",
        )

    # 1. Satıcı ismini tespit et (Apify sync call - profile fetch)
    log.info("marketplace_auto_detect_start", seller_url=body.seller_url)
    try:
        profiles = await run_marketplace_seller_intelligence(
            settings=settings,
            seller_urls=[body.seller_url],
            max_sellers=1,
        )
        if not profiles or not isinstance(profiles[0], dict):
            raise RuntimeError("Satıcı bilgileri alınamadı.")
        
        # summary kayıtlarını atla
        primary = None
        for p in profiles:
            if p.get("sellerName") and not str(p.get("dataVersion") or "").lower().startswith("run_summary"):
                primary = p
                break
        
        if not primary:
            raise RuntimeError("Satıcı ismi profil verisinde bulunamadı.")
            
        seller_name = str(primary.get("sellerName") or "Bilinmeyen Mağaza").strip()
    except Exception as exc:
        log.warning("marketplace_auto_detect_failed", error=str(exc))
        # Fallback: URL'den bir isim türetmeye çalış
        # Örn: https://www.trendyol.com/magaza/shopist-m-357212 -> Shopist
        raw_url = body.seller_url.lower()
        derived_name = "Bilinmeyen Mağaza"
        try:
            if "magaza/" in raw_url:
                parts = raw_url.split("magaza/")[1].split("/")[0].split("-m-")[0].split("?")[0]
                derived_name = parts.capitalize()
            elif "satici/" in raw_url:
                parts = raw_url.split("satici/")[1].split("/")[0].split("-m-")[0].split("?")[0]
                derived_name = parts.capitalize()
        except:
            pass
        
        seller_name = derived_name
        primary = {"sellerName": seller_name, "sellerId": "derived"}
        log.info("marketplace_auto_detect_fallback", derived_name=seller_name)

    # 2. Bu isimle bir 'App' var mı kontrol et, yoksa oluştur
    # Not: platform=BOTH veya özel bir MARKETPLACE platformu eklenebilir. 
    # Mevcut şemada AppStore/GooglePlay dışında generic bir yapı için BOTH kullanıyoruz.
    res = await session.execute(
        select(App).where(
            App.user_id == current_user.id,
            App.name == seller_name,
            App.platform == AppPlatform.BOTH
        )
    )
    app = res.scalar_one_or_none()
    
    if not app:
        app = App(
            user_id=current_user.id,
            name=seller_name,
            platform=AppPlatform.BOTH,
            developer=primary.get("sellerId") or "Pazaryeri",
            category="E-Ticaret Mağazası",
            is_active=True,
            icon_url=primary.get("sellerAvatar") or primary.get("sellerImage") or "",
        )
        session.add(app)
        await session.flush()
        log.info("marketplace_auto_app_created", app_id=str(app.id), name=seller_name)
    else:
        log.info("marketplace_existing_app_found", app_id=str(app.id), name=seller_name)

    # 3. Fetch kaydını oluştur ve kuyruğa at
    fetch = ReviewFetch(
        app_id=app.id,
        status=FetchStatus.PENDING,
        from_date=body.from_date,
        to_date=body.to_date,
        review_limit=None,
        review_scope="global",
        source="marketplace_seller_tr",
        review_count=0,
    )
    session.add(fetch)
    await session.flush()
    await session.commit()
    
    background_tasks.add_task(
        marketplace_seller_fetch_task.apply_async,
        args=[str(fetch.id), body.seller_url, body.max_sellers],
        queue="scraper",
    )
    
    log.info("marketplace_decoupled_fetch_started", fetch_id=str(fetch.id), app_name=seller_name)
    return fetch

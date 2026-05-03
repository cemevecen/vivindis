from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile

from vivindis.web.dependencies import get_reviews_service
from vivindis.web.schemas.reviews import PasteBody
from vivindis.web.services.reviews_service import ReviewsService

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/upload")
async def upload_reviews(
    file: UploadFile = File(...),
    svc: ReviewsService = Depends(get_reviews_service),
) -> dict[str, Any]:
    return await svc.upload(file)


@router.post("/paste")
def paste_reviews(
    body: PasteBody,
    svc: ReviewsService = Depends(get_reviews_service),
) -> dict[str, Any]:
    return svc.paste(body.text)

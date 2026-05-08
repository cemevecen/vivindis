"""API v1 router birleşimi."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import analysis, apps, auth, fetch_approvals, reviews, store

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(apps.router)
api_router.include_router(reviews.router)
api_router.include_router(analysis.router)
api_router.include_router(store.router)
api_router.include_router(fetch_approvals.router)

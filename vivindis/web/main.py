from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from vivindis.config.i18n import DEFAULT_LANG, LANGUAGES, use_ui_lang

from vivindis.web.routers import analyze, apps, health, i18n_api, reviews

_LANG_CODES = {code for code, _, _ in LANGUAGES}

app = FastAPI(title="Vivindis API", version="1.0.0")

_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ui_lang_middleware(request: Request, call_next):
    raw = request.headers.get("X-App-Lang") or request.query_params.get("lang")
    code = raw if isinstance(raw, str) and raw in _LANG_CODES else DEFAULT_LANG
    with use_ui_lang(code):
        return await call_next(request)


API_PREFIX = "/api/v1"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(i18n_api.router, prefix=API_PREFIX)
app.include_router(reviews.router, prefix=API_PREFIX)
app.include_router(analyze.router, prefix=API_PREFIX)
app.include_router(apps.router, prefix=API_PREFIX)

_repo_root = Path(__file__).resolve().parents[2]
_dist = _repo_root / "frontend" / "dist"
if _dist.is_dir() and os.environ.get("SERVE_FRONTEND") == "1":
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="frontend")

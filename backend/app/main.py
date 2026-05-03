"""FastAPI giriş — CORS, sağlık, `/api/v1` router."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    application = FastAPI(
        title="Vivindis API",
        version="0.1.0",
        description="Vivindis backend — şartname: /VIVINDIS_SPEC.md",
    )

    def _cors_origin(o: str) -> str:
        o = o.strip()
        # Tarayıcı Origin başlığında sondaki / yok; env’de https://site.com/ yazılırsa eşleşmez.
        while len(o) > 1 and o.endswith("/"):
            o = o[:-1]
        return o

    origins = [_cors_origin(o) for o in settings.cors_origins.split(",") if o.strip()]
    if not origins:
        origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router, prefix="/api/v1")
    # Mağaza araması: ``GET /api/v1/store/search`` — ``app.api.v1.store`` router’ı ``api_router`` ile dahil edilir.

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "vivindis-api"}

    return application


app = create_app()

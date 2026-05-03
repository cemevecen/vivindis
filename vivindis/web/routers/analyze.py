from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from vivindis.config.i18n import get_lang
from vivindis.config.settings import Settings
from vivindis.core.ai_providers import DEFAULT_MODELS, RichAnalyzer, resolve_api_keys
from vivindis.core.analyzer import analyze_batch, dedupe_reviews
from vivindis.utils.validators import is_valid_comment

router = APIRouter(prefix="/analyze", tags=["analyze"])


class ReviewIn(BaseModel):
    text: str
    id: str | None = None
    date: Any = None
    rating: float | int | None = None
    version: str | None = None
    lang: str | None = None


class AnalyzeRequest(BaseModel):
    reviews: list[ReviewIn] = Field(default_factory=list)
    use_heuristic_only: bool = True
    analysis_mode: int = 0
    provider: str = "Google Gemini"
    model: str | None = None


def _env_secrets_get(name: str) -> str | None:
    return os.environ.get(name)


@router.post("")
def run_analysis(body: AnalyzeRequest) -> dict[str, Any]:
    lang = get_lang()
    rows_in: list[dict[str, Any]] = []
    for r in body.reviews:
        txt = str(r.text or "").strip()
        if len(txt) < 2:
            continue
        d: dict[str, Any] = {"text": txt, "is_valid": is_valid_comment(txt)}
        if r.id is not None:
            d["id"] = r.id
        if r.date is not None:
            d["date"] = r.date
        if r.rating is not None:
            d["rating"] = r.rating
        if r.version is not None:
            d["version"] = r.version
        if r.lang is not None:
            d["lang"] = r.lang
        rows_in.append(d)

    prepared = dedupe_reviews(rows_in)
    if not prepared:
        return {"rows": [], "count": 0}

    settings = Settings.from_env()
    gk, gqk, ok = resolve_api_keys(
        settings.gemini_api_key,
        settings.groq_api_key,
        settings.openai_api_key,
        _env_secrets_get,
    )
    rich = RichAnalyzer(gemini_key=gk, groq_key=gqk, openai_key=ok)
    prov = body.provider or "Google Gemini"
    model = (body.model or "").strip() or DEFAULT_MODELS.get(prov, "")

    if not body.use_heuristic_only and not (gk or gqk or ok):
        return {"error": "rich_analysis_requires_api_keys", "rows": [], "count": 0}

    def prog(_done: int, _total: int) -> None:
        pass

    rows = analyze_batch(
        prepared,
        use_heuristic_only=body.use_heuristic_only,
        analysis_mode=body.analysis_mode,
        rich=None if body.use_heuristic_only else rich,
        provider=prov,
        model=model,
        max_workers=28 if body.use_heuristic_only else 12,
        progress=prog,
        max_rich_items=max(len(prepared), 1),
        ui_lang=lang,
    )
    return {"rows": rows, "count": len(rows)}

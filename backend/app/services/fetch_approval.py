"""Büyük hacimli yorum çekimleri için yönetici onayı (Telegram + tek kullanımlık token)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.review_fetch import ReviewFetchCreate


def review_fetch_requires_admin_approval(body: ReviewFetchCreate, settings: Settings) -> bool:
    """Limitsiz (None) veya eşikten büyük üst sınır için onay gerekir."""
    if settings.fetch_approval_disabled:
        return False
    if body.review_limit is None:
        return True
    return body.review_limit > settings.fetch_approval_review_threshold


def hash_approval_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def pending_enqueue_json_from_create(body: ReviewFetchCreate) -> str:
    payload: dict[str, Any] = {
        "review_scope": body.review_scope,
        "lang": body.lang,
        "country": body.country,
        "global_langs": body.global_langs,
    }
    return json.dumps(payload, ensure_ascii=False)


def parse_pending_enqueue(payload_json: str | None) -> tuple[str, str | None, str | None, list[str] | None]:
    """review_fetch_task(fetch_id, review_scope, lang, country, global_langs) ile uyumlu."""
    data = json.loads(payload_json or "{}")
    scope_raw = str(data.get("review_scope") or "global").strip().lower()
    review_scope = "local" if scope_raw == "local" else "global"
    lang = data.get("lang")
    country = data.get("country")
    gl = data.get("global_langs")
    langs: list[str] | None
    if gl is None:
        langs = None
    elif isinstance(gl, list):
        langs = [str(x).strip().lower()[:8] for x in gl if str(x).strip()]
        langs = langs or None
    else:
        langs = None
    lang_n = (str(lang).strip().lower()[:8] or None) if lang is not None and str(lang).strip() else None
    country_n = (
        (str(country).strip().lower()[:8] or None) if country is not None and str(country).strip() else None
    )
    return review_scope, lang_n, country_n, langs


def send_telegram_to_admins(*, settings: Settings, text: str) -> None:
    token = (settings.telegram_bot_token or "").strip()
    if not token:
        return
    raw_ids = (settings.telegram_admin_chat_ids or "").strip()
    if not raw_ids:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    for part in raw_ids.split(","):
        chat_id = part.strip()
        if not chat_id:
            continue
        try:
            resp = httpx.post(
                url,
                json={"chat_id": chat_id, "text": text},
                timeout=20.0,
            )
            resp.raise_for_status()
        except httpx.HTTPError:
            raise

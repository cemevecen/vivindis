"""Google Gemini — batch JSON üretimi (Oturum 4)."""

from __future__ import annotations

import json
import time
from typing import Any

import google.generativeai as genai

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


def get_gemini_model_name() -> str:
    s = get_settings()
    raw = (s.gemini_model or "").strip()
    return raw or "gemini-1.5-flash"


def _generate_json_from_prompt(prompt: str, *, max_retries: int = 3) -> dict[str, Any]:
    settings = get_settings()
    key = settings.gemini_api_key.strip()
    if not key:
        msg = "GEMINI_API_KEY tanımlı değil."
        raise RuntimeError(msg)

    genai.configure(api_key=key)
    model = genai.GenerativeModel(
        get_gemini_model_name(),
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            resp = model.generate_content(prompt)
            text = (resp.text or "").strip()
            return json.loads(text)
        except Exception as exc:
            last_exc = exc
            wait = 2**attempt
            log.warning(
                "gemini_retry",
                attempt=attempt + 1,
                wait_s=wait,
                error=str(exc),
            )
            time.sleep(wait)
    assert last_exc is not None
    raise last_exc


def generate_reviews_one_shot_json(reviews_payload: str, *, max_retries: int = 3) -> dict[str, Any]:
    prompt = f"""You are analyzing mobile app user reviews.
Return ONLY a JSON object with these keys:
- "overall_score": float 0-10 for this batch only
- "sentiment": {{"positive":0-1,"neutral":0-1,"negative":0-1}} (approximate for this batch)
- "rating_distribution": {{"1":n,"2":n,"3":n,"4":n,"5":n}} counts for this batch
- "top_topics": [{{"topic":str,"count":int,"sentiment":"positive"|"neutral"|"negative"}}] max 8
- "top_issues": [{{"issue":str,"count":int,"severity":"high"|"medium"|"low"}}] max 6
- "highlights": [{{"type":"positive"|"negative","text":str,"review_id":str}}] max 4 (review_id may be empty)
- "recommendations": [str] max 5 short strings
- "lang_distribution": {{lang_code: proportion}} approximate for this batch

Reviews (text lines, tab-separated rating|text):
{reviews_payload}
"""
    return _generate_json_from_prompt(prompt, max_retries=max_retries)

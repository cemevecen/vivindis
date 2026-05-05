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


def generate_review_batch_json(
    batch_index: int,
    reviews_payload: str,
    *,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Tek bir yorum batch'i için JSON nesnesi döner (birleştirme caller'da)."""
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

    prompt = f"""You are analyzing mobile app user reviews (batch {batch_index}).
Return ONLY a JSON object with these keys (use numbers/strings consistently):
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
                "gemini_batch_retry",
                batch=batch_index,
                attempt=attempt + 1,
                wait_s=wait,
                error=str(exc),
            )
            time.sleep(wait)
    assert last_exc is not None
    raise last_exc


def merge_batch_results(parts: list[dict[str, Any]]) -> dict[str, Any]:
    """Basit ağırlıklı birleştirme (batch sayısına göre ortalama / toplama)."""
    if not parts:
        return {}

    scores = [float(p.get("overall_score") or 0) for p in parts]
    overall = round(sum(scores) / max(len(scores), 1), 2)

    rd: dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    for p in parts:
        dist = p.get("rating_distribution") or {}
        for k in rd:
            rd[k] += int((dist.get(k) or dist.get(int(k)) or 0))

    sp = sn = sg = 0.0
    for p in parts:
        s = p.get("sentiment") or {}
        sp += float(s.get("positive") or 0)
        sn += float(s.get("neutral") or 0)
        sg += float(s.get("negative") or 0)
    t = sp + sn + sg or 1.0
    sentiment = {"positive": sp / t, "neutral": sn / t, "negative": sg / t}
    tt = sum(sentiment.values()) or 1.0
    sentiment = {k: round(v / tt, 4) for k, v in sentiment.items()}

    topics: dict[str, dict[str, Any]] = {}
    for p in parts:
        for item in p.get("top_topics") or []:
            if not isinstance(item, dict):
                continue
            topic = str(item.get("topic", "unknown"))
            prev = topics.get(topic, {"topic": topic, "count": 0, "sentiment": "neutral"})
            topics[topic] = {
                "topic": topic,
                "count": prev["count"] + int(item.get("count") or 0),
                "sentiment": item.get("sentiment", prev.get("sentiment", "neutral")),
            }
    top_topics = sorted(topics.values(), key=lambda x: x["count"], reverse=True)[:15]

    issues: dict[str, dict[str, Any]] = {}
    for p in parts:
        for item in p.get("top_issues") or []:
            if not isinstance(item, dict):
                continue
            issue = str(item.get("issue", "unknown"))
            prev_i = issues.get(issue, {"issue": issue, "count": 0, "severity": "medium"})
            issues[issue] = {
                "issue": issue,
                "count": prev_i["count"] + int(item.get("count") or 0),
                "severity": item.get("severity", prev_i.get("severity", "medium")),
            }
    top_issues = sorted(issues.values(), key=lambda x: x["count"], reverse=True)[:12]

    highlights: list[dict[str, Any]] = []
    for p in parts:
        highlights.extend([h for h in (p.get("highlights") or []) if isinstance(h, dict)])
    highlights = highlights[:12]

    recs: list[str] = []
    for p in parts:
        for r in p.get("recommendations") or []:
            if isinstance(r, str) and r.strip():
                recs.append(r.strip())
    recs = list(dict.fromkeys(recs))[:12]

    lang: dict[str, float] = {}
    for p in parts:
        ld = p.get("lang_distribution") or {}
        if not isinstance(ld, dict):
            continue
        for k, v in ld.items():
            try:
                lang[str(k)] = lang.get(str(k), 0.0) + float(v)
            except (TypeError, ValueError):
                continue
    lt = sum(lang.values()) or 1.0
    lang_distribution = {k: round(v / lt, 4) for k, v in lang.items()}

    return {
        "overall_score": overall,
        "sentiment": sentiment,
        "rating_distribution": rd,
        "top_topics": top_topics,
        "top_issues": top_issues,
        "highlights": highlights,
        "recommendations": recs,
        "lang_distribution": lang_distribution,
    }

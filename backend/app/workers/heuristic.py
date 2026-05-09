"""Heuristic analiz — `analysis` kuyruğu (Streamlit lexicon + motor)."""

from __future__ import annotations

import re
import uuid
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from app.core.celery import celery_app
from app.core.logging import get_logger
from app.models.analysis import Analysis
from app.models.enums import AnalysisStatus, AnalysisType
from app.models.review import Review
from app.models.review_fetch import ReviewFetch
from app.services.heuristic_engine import (
    heuristic_analysis,
    lexicon_negative_tokens,
    lexicon_positive_tokens,
    stop_tokens_for_topics,
)
from app.workers.runtime import run_async_db

log = get_logger(__name__)

_BASE_STOP = frozenset(
    {
        "the",
        "and",
        "for",
        "this",
        "that",
        "with",
        "bir",
        "bu",
        "ve",
        "çok",
        "app",
        "uygulama",
        "da",
        "de",
        "için",
    },
)


def _tokens(text: str) -> list[str]:
    return re.findall(r"[\w']+", text.lower(), flags=re.UNICODE)


def _review_text_for_heuristic(r: Review) -> str:
    parts = [r.title or "", r.body or ""]
    return " ".join(p.strip() for p in parts if p and p.strip()).strip() or (r.body or "").strip()


def _try_float(*vals: object) -> float | None:
    for v in vals:
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def _seller_intel_score_from_profile(profile: dict[str, Any]) -> float | None:
    """Apify profil alanlarından 0–10 skor (overall rating + yanıt oranı)."""
    rating = _try_float(
        profile.get("overallRating"),
        profile.get("store_puan"),
        profile.get("storeRating"),
        profile.get("rating"),
    )
    score_r: float | None = None
    if rating is not None:
        r = max(1.0, min(5.0, rating))
        score_r = (r - 1.0) / 4.0 * 10.0

    ans_raw = _try_float(
        profile.get("answer_rate"),
        profile.get("answerRate"),
        profile.get("yanitOrani"),
        profile.get("responseRate"),
        profile.get("mesajYanitOrani"),
    )
    score_a: float | None = None
    if ans_raw is not None:
        if ans_raw <= 1.0:
            score_a = ans_raw * 10.0
        else:
            score_a = min(10.0, ans_raw / 10.0)

    if score_r is not None and score_a is not None:
        return round(0.7 * score_r + 0.3 * score_a, 4)
    return score_r if score_r is not None else score_a


def _seller_intel_score_from_fetch_json(intel: dict[str, Any] | None) -> float | None:
    if not intel:
        return None
    profile = intel.get("profile")
    if isinstance(profile, dict):
        return _seller_intel_score_from_profile(profile)
    return None


def _detect_lang(text: str) -> str:
    try:
        from langdetect import detect
        from langdetect.lang_detect_exception import LangDetectException
    except ImportError:
        return "und"
    try:
        return str(detect(text[:800]))[:8]
    except LangDetectException:
        return "und"


async def _run_heuristic(session: Any, analysis_id: uuid.UUID) -> None:
    row = await session.get(Analysis, analysis_id)
    if row is None or row.type != AnalysisType.HEURISTIC:
        log.warning("heuristic_skip_missing", analysis_id=str(analysis_id))
        return
    if row.status != AnalysisStatus.PENDING:
        log.info("heuristic_skip_status", analysis_id=str(analysis_id), status=row.status.value)
        return

    row.status = AnalysisStatus.RUNNING
    await session.flush()

    res = await session.execute(select(Review).where(Review.fetch_id == row.fetch_id))
    revs = list(res.scalars().all())
    if not revs:
        row.result = {
            "overall_score": 0.0,
            "sentiment": {"positive": 0.0, "neutral": 1.0, "negative": 0.0},
            "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
            "top_topics": [],
            "top_issues": [],
            "highlights": [],
            "recommendations": ["Bu fetch için henüz yorum yok."],
            "lang_distribution": {},
        }
        row.status = AnalysisStatus.COMPLETED
        row.completed_at = datetime.now(UTC)
        row.model_used = "heuristic-lexicon-v3"
        return

    lex_stop = stop_tokens_for_topics()
    _stop = lex_stop | _BASE_STOP
    neg_topic = lexicon_negative_tokens()
    pos_topic = lexicon_positive_tokens()

    rd: dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    sum_pos = sum_neg = sum_neu = 0.0
    word_counter: Counter[str] = Counter()
    langs: Counter[str] = Counter()
    dated: list[tuple[datetime, int]] = []

    for r in revs:
        rk = str(max(1, min(5, int(r.rating))))
        rd[rk] = rd.get(rk, 0) + 1
        chunk = _review_text_for_heuristic(r)
        h = heuristic_analysis(chunk, rating=r.rating)
        sum_pos += float(h["olumlu"])
        sum_neg += float(h["olumsuz"])
        sum_neu += float(h["istek_gorus"])
        body_for_tokens = r.body or ""
        for w in _tokens(body_for_tokens):
            if len(w) > 3 and w not in _stop:
                word_counter[w] += 1
        langs[_detect_lang(body_for_tokens)] += 1
        dated.append(
            (
                datetime.combine(r.review_date, datetime.min.time(), tzinfo=UTC),
                int(r.rating),
            ),
        )

    tot = sum_pos + sum_neg + sum_neu
    if tot <= 0:
        sentiment = {"positive": 0.33, "negative": 0.34, "neutral": 0.33}
    else:
        sentiment = {
            "positive": round(sum_pos / tot, 4),
            "negative": round(sum_neg / tot, 4),
            "neutral": round(sum_neu / tot, 4),
        }
    ssum = sum(sentiment.values()) or 1.0
    sentiment = {k: round(v / ssum, 4) for k, v in sentiment.items()}

    avg_rating = sum(int(r.rating) for r in revs) / len(revs)
    base_overall_score = round(max(0.0, min(10.0, (avg_rating - 1) / 4 * 10)), 2)

    fetch_row = await session.get(ReviewFetch, row.fetch_id)
    seller_intel = fetch_row.seller_intelligence_json if fetch_row else None
    seller_component = _seller_intel_score_from_fetch_json(
        seller_intel if isinstance(seller_intel, dict) else None,
    )
    if seller_component is not None:
        overall_score = round(0.8 * base_overall_score + 0.2 * seller_component, 2)
    else:
        overall_score = base_overall_score

    dated.sort(key=lambda x: x[0])
    mid = len(dated) // 2 or 1
    first_half = dated[:mid]
    second_half = dated[mid:]
    early = sum(x[1] for x in first_half) / len(first_half)
    late = sum(x[1] for x in second_half) / max(len(second_half), 1)
    trend = "up" if late > early + 0.1 else "down" if late < early - 0.1 else "flat"

    replied = sum(1 for r in revs if (r.developer_reply or "").strip())
    reply_rate = round(replied / len(revs), 4)

    top_topics = [
        {
            "topic": w,
            "count": c,
            "sentiment": (
                "negative"
                if w in neg_topic
                else "positive"
                if w in pos_topic
                else "neutral"
            ),
        }
        for w, c in word_counter.most_common(12)
    ]

    neg_words = [w for w, _c in word_counter.most_common(80) if w in neg_topic][:5]
    top_issues = [
        {"issue": f"Negatif anahtar: {w}", "count": word_counter[w], "severity": "medium"}
        for w in neg_words
    ]

    best = max(revs, key=lambda r: int(r.rating))
    worst = min(revs, key=lambda r: int(r.rating))
    highlights = []
    if best.body.strip():
        highlights.append(
            {
                "type": "positive",
                "text": best.body.strip()[:400],
                "review_id": str(best.id),
            },
        )
    if worst.body.strip() and worst.id != best.id:
        highlights.append(
            {
                "type": "negative",
                "text": worst.body.strip()[:400],
                "review_id": str(worst.id),
            },
        )

    lt = sum(langs.values()) or 1
    lang_distribution = {k: round(v / lt, 4) for k, v in langs.items()}

    recommendations = [
        f"Ortalama puan: {avg_rating:.2f} / 5",
        f"Puan trendi (erken→geç): {trend}",
        f"Geliştirici yanıt oranı: {reply_rate:.0%}",
    ]

    row.result = {
        "overall_score": overall_score,
        "sentiment": sentiment,
        "rating_distribution": {k: int(rd[k]) for k in ["1", "2", "3", "4", "5"]},
        "top_topics": top_topics,
        "top_issues": top_issues
        or [{"issue": "Belirgin tekrarlayan sorun tespiti zayıf", "count": 1, "severity": "low"}],
        "highlights": highlights,
        "recommendations": recommendations,
        "lang_distribution": lang_distribution,
        "meta": {
            "rating_trend": trend,
            "reply_rate": reply_rate,
            "heuristic_lexicon": "app/data/heuristic_lexicon.json",
            "seller_intelligence_blend": {
                "weight": 0.2,
                "base_overall_score": base_overall_score,
                "seller_profile_score": seller_component,
                "blended_overall_score": overall_score,
            },
        },
    }
    row.status = AnalysisStatus.COMPLETED
    row.completed_at = datetime.now(UTC)
    row.model_used = "heuristic-lexicon-v3"
    log.info("heuristic_done", analysis_id=str(analysis_id))


async def _fail_heuristic(session: Any, analysis_id: uuid.UUID, message: str) -> None:
    row = await session.get(Analysis, analysis_id)
    if row is None:
        return
    row.status = AnalysisStatus.FAILED
    row.error_message = message[:8000]
    row.completed_at = datetime.now(UTC)


@celery_app.task(name="app.workers.heuristic.heuristic_analysis_task")
def heuristic_analysis_task(analysis_id: str) -> None:
    aid = uuid.UUID(analysis_id)
    try:
        run_async_db(_run_heuristic, aid)
    except Exception as exc:
        log.exception("heuristic_failed", analysis_id=analysis_id)
        run_async_db(_fail_heuristic, aid, str(exc))
        raise

"""Heuristic analiz — `analysis` kuyruğu."""

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
from app.workers.runtime import run_async_db

log = get_logger(__name__)

_POS_TR = {
    "güzel", "süper", "harika", "mükemmel", "başarılı", "sevdim", "iyi", "teşekkür", "kusursuz", "muhteşem",
    "hızlı", "kolay", "basit", "faydalı", "yararlı", "efsane", "müthiş", "beğendim", "tavsiye", "kaliteli",
    "akıcı", "stabil", "on numara", "başarılar", "kazançlı", "güvenilir", "şahane", "bravo", "tebrik", "memnun"
}
_NEG_TR = {
    "kötü", "berbat", "rezalet", "çöp", "donuyor", "açılmıyor", "hata", "sinir", "iade", "kaldır",
    "yavaş", "kasıyor", "bozuk", "çalışmıyor", "dolandırıcı", "saçma", "gereksiz", "pahalı", "reklam", "soygun",
    "pisman", "eksik", "berbat", "vasat", "yazık", "rezil", "fiyasko", "hüsran", "çöküyor", "kapandı"
}
_MANIP_TR = ["üstte kalsın", "görünsün diye", "yıldız verdim", "yıldızım görünsün", "popüler olsun"]
_PIVOTS_TR = ["ama", "fakat", "lakin", "ancak", "oysaki", "oysa", "yalnız", "ne var ki"]

_POS_EN = {
    "great", "good", "love", "awesome", "excellent", "perfect", "best", "thanks", "nice", "smooth",
    "fast", "easy", "helpful", "useful", "amazing", "wonderful", "liked", "recommend", "brilliant", "superb",
    "stable", "reliable", "fantastic", "top", "congrats", "satisfied"
}
_NEG_EN = {
    "bad", "terrible", "worst", "crash", "bug", "slow", "broken", "useless", "hate", "garbage",
    "awful", "scam", "expensive", "adds", "poor", "freeze", "junk", "laggy", "fail", "missing",
    "disappointing", "rubbish", "horrible", "refund", "fraud", "unusable"
}
_PIVOTS_EN = ["but", "however", "yet", "nevertheless", "though"]

_STOP = _POS_TR | _NEG_TR | _POS_EN | _NEG_EN | {
    "the", "and", "for", "this", "that", "with", "bir", "bu", "ve", "çok", "app", "uygulama", "da", "de", "için"
}


def _tokens(text: str) -> list[str]:
    return re.findall(r"[\w']+", text.lower(), flags=re.UNICODE)


def _sentiment_hits(text: str) -> tuple[float, float]:
    """Advanced sentiment analysis using pivots and weights."""
    text_low = text.lower()
    
    # Manipulation check: if they say 'upper kalsın diye 5 star', it's likely negative context
    for p in _MANIP_TR:
        if p in text_low:
            return 0.0, 2.0  # Force a negative bias

    # Pivot analysis: find the last conjunction and give weight to the part after it
    pivots = _PIVOTS_TR + _PIVOTS_EN
    pivot_indices = [text_low.rfind(p) for p in pivots if text_low.rfind(p) != -1]
    
    if pivot_indices:
        last_pivot = max(pivot_indices)
        pre_text = text_low[:last_pivot]
        post_text = text_low[last_pivot:]
        
        pre_toks = set(_tokens(pre_text))
        post_toks = set(_tokens(post_text))
        
        # We weight the part after the last pivot (e.g. 'good BUT SLOW')
        pos = (len(pre_toks & (_POS_TR | _POS_EN)) * 0.5) + (len(post_toks & (_POS_TR | _POS_EN)) * 1.5)
        neg = (len(pre_toks & (_NEG_TR | _NEG_EN)) * 0.5) + (len(post_toks & (_NEG_TR | _NEG_EN)) * 1.5)
    else:
        toks = set(_tokens(text_low))
        pos = float(len(toks & (_POS_TR | _POS_EN)))
        neg = float(len(toks & (_NEG_TR | _NEG_EN)))

    # Negative weighting (1.25x multiplier as used in store_review repo)
    return pos, neg * 1.25


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
        row.model_used = "heuristic-v1"
        return

    rd: dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    pos_hits = neg_hits = 0
    word_counter: Counter[str] = Counter()
    langs: Counter[str] = Counter()
    dated: list[tuple[datetime, int]] = []

    for r in revs:
        rk = str(max(1, min(5, int(r.rating))))
        rd[rk] = rd.get(rk, 0) + 1
        p, n = _sentiment_hits(r.body)
        pos_hits += p
        neg_hits += n
        for w in _tokens(r.body):
            if len(w) > 3 and w not in _STOP:
                word_counter[w] += 1
        langs[_detect_lang(r.body)] += 1
        dated.append(
            (
                datetime.combine(r.review_date, datetime.min.time(), tzinfo=UTC),
                int(r.rating),
            ),
        )

    tot_lex = pos_hits + neg_hits + 1
    sentiment = {
        "positive": round(pos_hits / tot_lex, 4),
        "negative": round(neg_hits / tot_lex, 4),
        "neutral": round(max(0.0, 1.0 - (pos_hits + neg_hits) / tot_lex), 4),
    }
    ssum = sum(sentiment.values()) or 1.0
    sentiment = {k: round(v / ssum, 4) for k, v in sentiment.items()}

    avg_rating = sum(int(r.rating) for r in revs) / len(revs)
    overall_score = round(max(0.0, min(10.0, (avg_rating - 1) / 4 * 10)), 2)

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
        {"topic": w, "count": c, "sentiment": "negative" if w in _NEG_TR | _NEG_EN else "neutral"}
        for w, c in word_counter.most_common(12)
    ]

    neg_words = [w for w, _c in word_counter.most_common(80) if w in _NEG_TR | _NEG_EN][:5]
    top_issues = [{"issue": f"Negatif anahtar: {w}", "count": word_counter[w], "severity": "medium"} for w in neg_words]

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
        "top_issues": top_issues or [{"issue": "Belirgin tekrarlayan sorun tespiti zayıf", "count": 1, "severity": "low"}],
        "highlights": highlights,
        "recommendations": recommendations,
        "lang_distribution": lang_distribution,
        "meta": {"rating_trend": trend, "reply_rate": reply_rate},
    }
    row.status = AnalysisStatus.COMPLETED
    row.completed_at = datetime.now(UTC)
    row.model_used = "heuristic-v1"
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


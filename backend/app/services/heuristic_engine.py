"""Streamlit `store_review` ile uyumlu sezgisel duygu motoru — veri: ``app/data/heuristic_lexicon.json``."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, FrozenSet, Mapping

_LEXICON_PATH = Path(__file__).resolve().parent.parent / "data" / "heuristic_lexicon.json"


@lru_cache(maxsize=1)
def _lexicon() -> Mapping[str, Any]:
    raw: dict[str, Any] = json.loads(_LEXICON_PATH.read_text(encoding="utf-8"))
    return {
        "manipulation_patterns": raw["manipulation_patterns"],
        "low_star_phrases": raw["low_star_phrases"],
        "high_star_phrases": raw["high_star_phrases"],
        "exact_pos": frozenset(str(x).lower().strip() for x in raw["exact_pos"]),
        "exact_neg": frozenset(str(x).lower().strip() for x in raw["exact_neg"]),
        "sarkasm": raw["sarkasm"],
        "neg_words": raw["neg_words"],
        "pos_words": raw["pos_words"],
        "neu_words": raw["neu_words"],
        "critical_bug": raw["critical_bug"],
        "pivot_tr": raw["pivot_tr"],
        "pivot_en": raw["pivot_en"],
    }


def reload_heuristic_lexicon() -> None:
    """Diskten lexicon yeniden oku (geliştirme)."""
    _lexicon.cache_clear()
    stop_tokens_for_topics.cache_clear()
    lexicon_negative_tokens.cache_clear()
    lexicon_positive_tokens.cache_clear()


@lru_cache(maxsize=1)
def stop_tokens_for_topics() -> FrozenSet[str]:
    """Konu kelime sayacında gürültüyü azaltmak için lexicon türevli stop-tokenlar."""
    L = _lexicon()
    out: set[str] = set()
    for key in ("pos_words", "neg_words", "neu_words", "critical_bug", "sarkasm", "manipulation_patterns"):
        for phrase in L[key]:
            if not isinstance(phrase, str):
                continue
            for tok in re.findall(r"[\w']+", phrase.lower(), flags=re.UNICODE):
                if len(tok) > 2:
                    out.add(tok)
    for s in L["exact_pos"] | L["exact_neg"]:
        for tok in re.findall(r"[\w']+", s.lower(), flags=re.UNICODE):
            if len(tok) > 2:
                out.add(tok)
    return frozenset(out)


@lru_cache(maxsize=1)
def lexicon_negative_tokens(min_len: int = 4) -> FrozenSet[str]:
    L = _lexicon()
    o: set[str] = set()
    for phrase in L["neg_words"]:
        if not isinstance(phrase, str):
            continue
        for tok in re.findall(r"[\w']+", phrase.lower(), flags=re.UNICODE):
            if len(tok) >= min_len:
                o.add(tok)
    return frozenset(o)


@lru_cache(maxsize=1)
def lexicon_positive_tokens(min_len: int = 4) -> FrozenSet[str]:
    L = _lexicon()
    o: set[str] = set()
    for phrase in L["pos_words"]:
        if not isinstance(phrase, str):
            continue
        for tok in re.findall(r"[\w']+", phrase.lower(), flags=re.UNICODE):
            if len(tok) >= min_len:
                o.add(tok)
    return frozenset(o)


def heuristic_analysis(text: object, rating: int | str | None = None) -> dict[str, Any]:
    """
    Heuristic Engine v3.x — çok dilli mağaza yorumu (lexicon JSON).
    Dönüş: olumlu, olumsuz, istek_gorus (toplam ~1), method.
    """
    L = _lexicon()
    manipulation_patterns: list[str] = L["manipulation_patterns"]
    low_star: list[str] = L["low_star_phrases"]
    high_star: list[str] = L["high_star_phrases"]
    EXACT_POS: FrozenSet[str] = L["exact_pos"]
    EXACT_NEG: FrozenSet[str] = L["exact_neg"]
    SARKASM: list[str] = L["sarkasm"]
    NEG_WORDS: list[str] = L["neg_words"]
    POS_WORDS: list[str] = L["pos_words"]
    NEU_WORDS: list[str] = L["neu_words"]
    CRITICAL_BUG: list[str] = L["critical_bug"]
    PIVOT_TR: list[str] = L["pivot_tr"]
    PIVOT_EN: list[str] = L["pivot_en"]
    ALL_PIVOTS = PIVOT_TR + PIVOT_EN

    t = str(text).lower().strip()
    if not t or len(t) < 2:
        return {"olumlu": 0.33, "olumsuz": 0.34, "istek_gorus": 0.33, "method": "Heuristic+"}

    _rating: int | None = None
    if rating is not None:
        try:
            _rating = int(str(rating).strip().split(".", 1)[0])
        except (TypeError, ValueError, IndexError):
            _rating = None

    if any(p in t for p in manipulation_patterns):
        return {"olumlu": 0.05, "olumsuz": 0.88, "istek_gorus": 0.07, "method": "Heuristic+"}

    if any(x in t for x in low_star):
        return {"olumlu": 0.03, "olumsuz": 0.94, "istek_gorus": 0.03, "method": "Heuristic+"}
    if any(x in t for x in high_star):
        return {"olumlu": 0.94, "olumsuz": 0.03, "istek_gorus": 0.03, "method": "Heuristic+"}

    if t in EXACT_POS:
        return {"olumlu": 0.95, "olumsuz": 0.02, "istek_gorus": 0.03, "method": "Heuristic+"}

    if t in EXACT_NEG:
        return {"olumlu": 0.03, "olumsuz": 0.94, "istek_gorus": 0.03, "method": "Heuristic+"}

    sarkasm_hit = any(p in t for p in SARKASM)

    neg_score = sum(1 for w in NEG_WORDS if w in t)
    pos_score = sum(1 for w in POS_WORDS if w in t)
    neu_score = sum(1 for w in NEU_WORDS if w in t)

    if any(kw in t for kw in CRITICAL_BUG):
        if _rating != 5 or neg_score > 0:
            return {"olumlu": 0.04, "olumsuz": 0.92, "istek_gorus": 0.04, "method": "Heuristic+CriticalBug"}

    neg_score_w = neg_score * 1.25

    if sarkasm_hit:
        if pos_score <= neg_score or pos_score == 0:
            return {"olumlu": 0.05, "olumsuz": 0.90, "istek_gorus": 0.05, "method": "Heuristic+"}

    for pivot in ALL_PIVOTS:
        if pivot in t:
            parts = t.split(pivot, 1)
            after = parts[1] if len(parts) > 1 else ""

            after_neg = sum(1 for w in NEG_WORDS if w in after)
            after_pos = sum(1 for w in POS_WORDS if w in after)

            if after_neg > after_pos and after_neg > 0:
                conf = min(0.88, 0.70 + after_neg * 0.04)
                return {
                    "olumlu": 0.06,
                    "olumsuz": round(conf, 3),
                    "istek_gorus": round(1 - conf - 0.06, 3),
                    "method": "Heuristic+",
                }
            if after_pos > after_neg and after_pos > 0:
                conf = min(0.88, 0.70 + after_pos * 0.04)
                return {
                    "olumlu": round(conf, 3),
                    "olumsuz": 0.06,
                    "istek_gorus": round(1 - conf - 0.06, 3),
                    "method": "Heuristic+",
                }
            break

    total_kw = pos_score + neg_score + neu_score

    if total_kw == 0:
        if _rating == 1:
            return {"olumlu": 0.05, "olumsuz": 0.88, "istek_gorus": 0.07, "method": "Heuristic+"}
        if _rating == 2:
            return {"olumlu": 0.15, "olumsuz": 0.72, "istek_gorus": 0.13, "method": "Heuristic+"}
        if _rating == 4:
            return {"olumlu": 0.72, "olumsuz": 0.15, "istek_gorus": 0.13, "method": "Heuristic+"}
        if _rating == 5:
            return {"olumlu": 0.85, "olumsuz": 0.08, "istek_gorus": 0.07, "method": "Heuristic+"}
        return {"olumlu": 0.35, "olumsuz": 0.33, "istek_gorus": 0.32, "method": "Heuristic+"}

    if _rating == 1 and neg_score > 0:
        conf = min(0.96, 0.80 + neg_score * 0.04)
        return {
            "olumlu": round((1 - conf) / 2, 3),
            "olumsuz": round(conf, 3),
            "istek_gorus": round((1 - conf) / 2, 3),
            "method": "Heuristic+",
        }

    if _rating == 5 and neg_score > pos_score and neg_score >= 1:
        conf = min(0.88, 0.65 + neg_score * 0.05)
        return {
            "olumlu": 0.06,
            "olumsuz": round(conf, 3),
            "istek_gorus": round(1 - conf - 0.06, 3),
            "method": "Heuristic+",
        }

    if neg_score_w > pos_score and neg_score_w >= neu_score:
        conf = min(0.95, 0.68 + (neg_score_w / (pos_score + neg_score_w + neu_score)) * 0.27)
        return {
            "olumlu": round((1 - conf) / 2, 3),
            "olumsuz": round(conf, 3),
            "istek_gorus": round((1 - conf) / 2, 3),
            "method": "Heuristic+",
        }

    if pos_score > neg_score and pos_score >= neu_score:
        conf = min(0.95, 0.68 + (pos_score / (pos_score + neg_score_w + neu_score)) * 0.27)
        return {
            "olumlu": round(conf, 3),
            "olumsuz": round((1 - conf) / 2, 3),
            "istek_gorus": round((1 - conf) / 2, 3),
            "method": "Heuristic+",
        }

    if neu_score >= pos_score and neu_score >= neg_score:
        return {"olumlu": 0.08, "olumsuz": 0.07, "istek_gorus": 0.85, "method": "Heuristic+"}

    return {"olumlu": 0.35, "olumsuz": 0.33, "istek_gorus": 0.32, "method": "Heuristic+"}

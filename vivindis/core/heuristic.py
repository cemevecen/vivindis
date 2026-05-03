"""Heuristic sentiment engine v3.0 — kurallar burada; kelime/ölçü verisi `data/heuristic_lexicon.json`."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Dict, FrozenSet, List, Mapping

from vivindis.data import HEURISTIC_LEXICON_PATH


@lru_cache(maxsize=1)
def _lexicon() -> Mapping[str, Any]:
    raw: Dict[str, Any] = json.loads(HEURISTIC_LEXICON_PATH.read_text(encoding="utf-8"))
    return {
        "manipulation_patterns": raw["manipulation_patterns"],
        "low_star_phrases": raw["low_star_phrases"],
        "high_star_phrases": raw["high_star_phrases"],
        "exact_pos": frozenset(raw["exact_pos"]),
        "exact_neg": frozenset(raw["exact_neg"]),
        "sarkasm": raw["sarkasm"],
        "neg_words": raw["neg_words"],
        "pos_words": raw["pos_words"],
        "neu_words": raw["neu_words"],
        "critical_bug": raw["critical_bug"],
        "pivot_tr": raw["pivot_tr"],
        "pivot_en": raw["pivot_en"],
    }


def heuristic_analysis(text, rating=None):
    """
    Heuristic Engine v3.0
    - Çok dilli mağaza yorumu listeleri (veri: heuristic_lexicon.json)
    - Rating-aware, sarkazm, pivot (ama/but), manipülasyon tuzağı, kritik bug
    """
    L = _lexicon()
    manipulation_patterns: List[str] = L["manipulation_patterns"]
    low_star: List[str] = L["low_star_phrases"]
    high_star: List[str] = L["high_star_phrases"]
    EXACT_POS: FrozenSet[str] = L["exact_pos"]
    EXACT_NEG: FrozenSet[str] = L["exact_neg"]
    SARKASM: List[str] = L["sarkasm"]
    NEG_WORDS: List[str] = L["neg_words"]
    POS_WORDS: List[str] = L["pos_words"]
    NEU_WORDS: List[str] = L["neu_words"]
    CRITICAL_BUG: List[str] = L["critical_bug"]
    PIVOT_TR: List[str] = L["pivot_tr"]
    PIVOT_EN: List[str] = L["pivot_en"]
    ALL_PIVOTS = PIVOT_TR + PIVOT_EN

    t = str(text).lower().strip()
    if not t or len(t) < 2:
        return {"olumlu": 0.33, "olumsuz": 0.34, "istek_gorus": 0.33, "method": "Heuristic+"}

    _rating = None
    if rating is not None:
        try:
            _rating = int(str(rating).strip().split(".")[0])
        except Exception:
            pass

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


def reload_heuristic_lexicon() -> None:
    """Lexicon JSON dosyasını diskten yeniden okut (geliştirme / test)."""
    _lexicon.cache_clear()

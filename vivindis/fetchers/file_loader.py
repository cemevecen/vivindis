from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

import pandas as pd

from vivindis.utils.validators import is_valid_comment


def _pick_column(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    cols = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        key = cand.lower().strip()
        if key in cols:
            return cols[key]
    for c in df.columns:
        cl = str(c).lower()
        for cand in candidates:
            if cand.lower() in cl:
                return c
    return None


def load_reviews_from_dataframe(df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Build normalized review dicts from arbitrary CSV/Excel column names.
    """
    text_col = _pick_column(
        df,
        ["yorum", "review", "comment", "text", "content", "body", "mesaj"],
    )
    if not text_col:
        raise ValueError("Metin sütunu bulunamadı (ör. Yorum, review, text).")

    rating_col = _pick_column(df, ["rating", "puan", "score", "stars", "star"])
    date_col = _pick_column(df, ["date", "tarih", "created", "time"])

    out: list[dict[str, Any]] = []
    for i, row in df.iterrows():
        raw = row.get(text_col)
        if raw is None or (isinstance(raw, float) and pd.isna(raw)):
            continue
        text = str(raw).strip()
        if not is_valid_comment(text):
            continue

        rating = None
        if rating_col:
            r = row.get(rating_col)
            if r is not None and not (isinstance(r, float) and pd.isna(r)):
                rating = str(r).strip()

        dt: Any = None
        if date_col:
            v = row.get(date_col)
            if v is not None and not (isinstance(v, float) and pd.isna(v)):
                if isinstance(v, datetime):
                    dt = v
                else:
                    try:
                        dt = pd.to_datetime(v)
                    except Exception:
                        dt = None

        out.append(
            {
                "id": f"file-{i}",
                "text": text,
                "date": dt,
                "rating": rating or "",
                "lang": "upload",
                "is_valid": True,
            }
        )
    return out

"""Dosya / yapıştırma ile yorum havuzu oluşturma."""

from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import UploadFile

from vivindis.fetchers.file_loader import load_reviews_from_dataframe
from vivindis.fetchers.paste_loader import parse_pasted_reviews


class ReviewsService:
    async def upload(self, file: UploadFile) -> dict[str, Any]:
        raw = await file.read()
        name = (file.filename or "").lower()
        try:
            if name.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(raw))
            elif name.endswith(".xlsx") or name.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(raw))
            else:
                return {"error": "unsupported_file_type", "reviews": []}
            pool = load_reviews_from_dataframe(df)
            return {"filename": file.filename, "count": len(pool), "reviews": pool}
        except Exception as e:
            return {"error": str(e), "reviews": []}

    def paste(self, text: str) -> dict[str, Any]:
        pool = parse_pasted_reviews(text or "")
        return {"count": len(pool), "reviews": pool}

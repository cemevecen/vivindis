"""Review import şeması — DB olmadan doğrulama."""

from __future__ import annotations

import datetime as dt

import pytest
from pydantic import ValidationError

from app.schemas.review_import import ReviewImportCreate, ReviewImportItem


def test_import_requires_non_empty_items() -> None:
    with pytest.raises(ValidationError):
        ReviewImportCreate(
            from_date=dt.date(2025, 1, 1),
            to_date=dt.date(2025, 1, 2),
            items=[],
        )


def test_import_rejects_inverted_date_range() -> None:
    with pytest.raises(ValidationError):
        ReviewImportCreate(
            from_date=dt.date(2025, 2, 1),
            to_date=dt.date(2025, 1, 1),
            items=[ReviewImportItem(body="ok")],
        )


def test_import_accepts_rating_bounds() -> None:
    m = ReviewImportCreate(
        from_date=dt.date(2025, 1, 1),
        to_date=dt.date(2025, 1, 2),
        items=[
            ReviewImportItem(body="a"),
            ReviewImportItem(body="b", rating=5),
        ],
    )
    assert len(m.items) == 2
    assert m.items[1].rating == 5


def test_rating_out_of_range_rejected() -> None:
    with pytest.raises(ValidationError):
        ReviewImportItem(body="x", rating=6)

"""Review tablosu: çekim başına yorum tekilliği (fetch_id dahil)."""

from __future__ import annotations

from app.models.review import Review


def test_review_unique_constraint_includes_fetch_id() -> None:
    names = [c.name for c in Review.__table__.constraints if c.name]
    assert "uq_reviews_fetch_platform_store_id" in names
    assert "uq_reviews_platform_store_id" not in names

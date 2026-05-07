"""App deletion should remove all owned child rows, not leave DB orphans."""

from __future__ import annotations

from app.models.analysis import Analysis
from app.models.app import App
from app.models.review import Review
from app.models.review_fetch import ReviewFetch


def test_app_relationships_delete_child_rows() -> None:
    relationships = App.__mapper__.relationships

    assert "delete-orphan" in relationships["review_fetches"].cascade
    assert "delete-orphan" in relationships["reviews"].cascade
    assert "delete-orphan" in relationships["analyses"].cascade


def test_app_child_foreign_keys_cascade_in_database() -> None:
    child_models = [ReviewFetch, Review, Analysis]

    for model in child_models:
        app_id_fk = next(iter(model.__table__.c.app_id.foreign_keys))
        assert app_id_fk.ondelete == "CASCADE"

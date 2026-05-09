"""review_fetches source alanı ve review platformuna google_maps_scraper değeri.

Revision ID: f2b4c6d8e9a1
Revises: d8a9b0c1d2e3
Create Date: 2026-05-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2b4c6d8e9a1"
down_revision: Union[str, None] = "d8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "review_fetches",
        sa.Column("source", sa.String(length=64), nullable=False, server_default="store"),
    )
    op.alter_column(
        "reviews",
        "platform",
        existing_type=sa.Enum(
            "google_play",
            "app_store",
            name="review_platform",
            native_enum=False,
            length=32,
        ),
        type_=sa.Enum(
            "google_play",
            "app_store",
            "google_maps_scraper",
            name="review_platform",
            native_enum=False,
            length=32,
        ),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "reviews",
        "platform",
        existing_type=sa.Enum(
            "google_play",
            "app_store",
            "google_maps_scraper",
            name="review_platform",
            native_enum=False,
            length=32,
        ),
        type_=sa.Enum(
            "google_play",
            "app_store",
            name="review_platform",
            native_enum=False,
            length=32,
        ),
        existing_nullable=False,
    )
    op.drop_column("review_fetches", "source")

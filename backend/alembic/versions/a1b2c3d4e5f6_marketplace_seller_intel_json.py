"""review_fetches.seller_intelligence_json ve review_platform marketplace_seller_tr.

Revision ID: a1b2c3d4e5f6
Revises: f2b4c6d8e9a1
Create Date: 2026-05-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f2b4c6d8e9a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "review_fetches",
        sa.Column("seller_intelligence_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
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
            "google_maps_scraper",
            "marketplace_seller_tr",
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
            "marketplace_seller_tr",
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
    op.drop_column("review_fetches", "seller_intelligence_json")

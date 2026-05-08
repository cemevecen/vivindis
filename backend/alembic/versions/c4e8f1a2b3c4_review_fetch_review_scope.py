"""review_fetches.review_scope — yerel (local) veya derin (global) çekim.

Revision ID: c4e8f1a2b3c4
Revises: b7d2a1c9e4f0
Create Date: 2026-05-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e8f1a2b3c4"
down_revision: Union[str, None] = "b7d2a1c9e4f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "review_fetches",
        sa.Column(
            "review_scope",
            sa.String(length=16),
            nullable=False,
            server_default="global",
        ),
    )


def downgrade() -> None:
    op.drop_column("review_fetches", "review_scope")

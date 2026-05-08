"""review_fetches.review_limit — örneklem üst sınırı (NULL = limitsiz / sunucu tavanı).

Revision ID: b7d2a1c9e4f0
Revises: a3c91b2f8d10
Create Date: 2026-05-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7d2a1c9e4f0"
down_revision: Union[str, None] = "a3c91b2f8d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("review_fetches", sa.Column("review_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("review_fetches", "review_limit")

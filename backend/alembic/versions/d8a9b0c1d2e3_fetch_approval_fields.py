"""review_fetches: onay bekleyen büyük çekimler için token ve kuyruk parametreleri.

Revision ID: d8a9b0c1d2e3
Revises: c4e8f1a2b3c4
Create Date: 2026-05-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8a9b0c1d2e3"
down_revision: Union[str, None] = "c4e8f1a2b3c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "review_fetches",
        sa.Column("approval_token_hash", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "review_fetches",
        sa.Column("pending_enqueue_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("review_fetches", "pending_enqueue_json")
    op.drop_column("review_fetches", "approval_token_hash")

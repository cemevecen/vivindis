"""reviews: unique (fetch_id, platform, store_review_id)

Önceki kısıt yalnızca (platform, store_review_id) idi; aynı mağaza yorumu
başka bir çekimde veya başka bir uygulama kaydında zaten varken yeni fetch
satır ekleyemiyordu (ON CONFLICT DO NOTHING). Çekim başına tekil satır
için fetch_id dahil edilir.

Revision ID: a3c91b2f8d10
Revises: efc0ee799cb6
Create Date: 2026-05-07

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3c91b2f8d10"
down_revision: Union[str, None] = "efc0ee799cb6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_reviews_platform_store_id", "reviews", type_="unique")
    op.create_unique_constraint(
        "uq_reviews_fetch_platform_store_id",
        "reviews",
        ["fetch_id", "platform", "store_review_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_reviews_fetch_platform_store_id", "reviews", type_="unique")
    op.create_unique_constraint(
        "uq_reviews_platform_store_id",
        "reviews",
        ["platform", "store_review_id"],
    )

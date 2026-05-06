"""review_author_uri_and_app_version

Revision ID: efc0ee799cb6
Revises: 4a66a17abb57
Create Date: 2026-05-06 22:30:48.908004

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efc0ee799cb6'
down_revision: Union[str, None] = '4a66a17abb57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reviews", sa.Column("author_uri", sa.String(length=2048), nullable=True))
    op.add_column("reviews", sa.Column("app_version_label", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("reviews", "app_version_label")
    op.drop_column("reviews", "author_uri")

"""Ortak declarative taban."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Tüm ORM modelleri bu tabanı kullanır (Alembic metadata için)."""

    pass

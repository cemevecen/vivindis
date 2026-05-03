"""Ortak Pydantic tipleri."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    message: str


class PaginationParams(BaseModel):
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)

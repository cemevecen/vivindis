"""Uygulama (App) şemaları."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AppPlatform


class AppBase(BaseModel):
    platform: AppPlatform
    package_name: str = Field(default="", max_length=255)
    bundle_id: str | None = Field(default=None, max_length=255)
    name: str = Field(default="", max_length=512)
    icon_url: str | None = Field(default=None, max_length=2048)
    developer: str | None = Field(default=None, max_length=512)
    category: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class AppCreate(AppBase):
    pass


class AppUpdate(BaseModel):
    platform: AppPlatform | None = None
    package_name: str | None = Field(default=None, max_length=255)
    bundle_id: str | None = Field(default=None, max_length=255)
    name: str | None = Field(default=None, max_length=512)
    icon_url: str | None = Field(default=None, max_length=2048)
    developer: str | None = Field(default=None, max_length=512)
    category: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class AppResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    platform: AppPlatform
    package_name: str
    bundle_id: str | None
    name: str
    icon_url: str | None
    developer: str | None
    category: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

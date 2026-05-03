"""Kullanıcı şemaları."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Plan


class UserBase(BaseModel):
    clerk_id: str = Field(max_length=255)
    email: EmailStr
    plan: Plan = Plan.FREE


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    plan: Plan | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    clerk_id: str
    email: str
    plan: Plan
    created_at: datetime
    updated_at: datetime

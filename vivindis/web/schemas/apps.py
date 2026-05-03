from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    q: str = Field(min_length=1)
    filter: Literal["all", "android", "ios"] = "all"
    limit: int = 24


class ResolveBody(BaseModel):
    raw: str = Field(min_length=1)


class FetchBody(BaseModel):
    platform: Literal["android", "ios"]
    app_id: str = Field(min_length=1)
    days_limit: int = 30
    scope: Literal["local", "global"] = "global"

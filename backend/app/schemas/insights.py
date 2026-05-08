"""Benchmark, alerts, action items and segmentation insights."""

from __future__ import annotations

from pydantic import BaseModel, Field


class BenchmarkScore(BaseModel):
    label: str
    value: float
    delta_vs_category: float
    direction: str = Field(description="up | down | flat")


class BenchmarkBlock(BaseModel):
    app_name: str
    category: str
    category_sample_apps: int
    scores: list[BenchmarkScore]


class AlertItem(BaseModel):
    key: str
    title: str
    severity: str = Field(description="high | medium | low")
    detail: str
    triggered: bool


class ActionItem(BaseModel):
    problem: str
    recommendation: str
    owner: str
    priority: str = Field(description="P0 | P1 | P2")


class ReleaseImpactBlock(BaseModel):
    current_version: str | None
    previous_version: str | None
    current_avg_rating: float | None
    previous_avg_rating: float | None
    rating_delta: float | None
    summary: str


class SegmentRow(BaseModel):
    segment: str
    reviews: int
    avg_rating: float


class InsightsResponse(BaseModel):
    benchmark: BenchmarkBlock
    alerts: list[AlertItem]
    actions: list[ActionItem]
    release_impact: ReleaseImpactBlock
    segments: list[SegmentRow]

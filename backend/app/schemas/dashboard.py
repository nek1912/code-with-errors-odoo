"""
Pydantic schemas for the Dashboard Overview endpoint.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class KpiCard(BaseModel):
    value: int
    label: str
    trend: Optional[str] = None  # e.g. "+12% this week"


class AlertBanner(BaseModel):
    count: int
    message: str


class QuickActions(BaseModel):
    can_register_asset: bool
    can_book_resource: bool
    can_raise_request: bool


class ActivityItem(BaseModel):
    id: UUID
    entity_name: str
    action_type: str
    entity_type: str
    user_name: Optional[str] = None
    timestamp: datetime
    details: Optional[dict] = None


class DashboardOverview(BaseModel):
    kpis: list[KpiCard]
    alert: Optional[AlertBanner] = None
    quick_actions: QuickActions
    recent_activity: list[ActivityItem]

    model_config = {"from_attributes": True}

"""Pydantic schemas for Reports & Analytics."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class DeptUtilization(BaseModel):
    dept_name: str
    count: int


class MaintenanceFrequency(BaseModel):
    month: str
    count: int


class MostUsedAsset(BaseModel):
    asset_tag: str
    name: str
    booking_count: int


class IdleAsset(BaseModel):
    asset_tag: str
    name: str
    days_idle: int


class RetirementAlert(BaseModel):
    asset_tag: str
    name: str
    reason: str


class ReportsOverview(BaseModel):
    utilization_by_dept: list[dict[str, Any]]
    maintenance_frequency: list[dict[str, Any]]
    most_used_assets: list[dict[str, Any]]
    idle_assets: list[dict[str, Any]]
    retirement_alerts: list[dict[str, Any]]

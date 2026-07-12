"""Pydantic schemas for Notifications and Activity Logs."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


# ── Notification Schemas ────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    count: int


class MarkAllReadResponse(BaseModel):
    message: str
    marked: int


# ── Activity Log Schemas ────────────────────────────────────────

class ActivityLogResponse(BaseModel):
    id: str
    user_id: str | None
    user_name: str | None
    action_type: str
    entity_type: str
    entity_id: str | None
    details: dict[str, Any] | None
    created_at: datetime
    model_config = {"from_attributes": True}


class ActivityLogListResponse(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    page: int
    limit: int
    pages: int

"""Pydantic schemas for Audit Cycles and Items."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Audit Cycle ─────────────────────────────────────────────────
class AuditCycleCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scope_type: str = Field(..., pattern="^(DEPARTMENT|LOCATION|ALL)$")
    scope_id: Optional[UUID] = None
    start_date: datetime
    end_date: datetime
    auditor_ids: list[UUID] = Field(..., min_length=1)


class AuditCycleResponse(BaseModel):
    id: UUID
    name: str
    scope_type: str
    scope_id: Optional[UUID] = None
    created_by_user_id: UUID
    start_date: datetime
    end_date: datetime
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AuditItemResponse(BaseModel):
    id: UUID
    audit_cycle_id: UUID
    asset_id: UUID
    auditor_user_id: Optional[UUID] = None
    physical_status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Asset details (joined)
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    asset_location: Optional[str] = None
    # Auditor details
    auditor_name: Optional[str] = None
    model_config = {"from_attributes": True}


class AuditCycleDetailResponse(AuditCycleResponse):
    items: list[AuditItemResponse] = []
    auditor_names: list[str] = []
    scope_name: Optional[str] = None
    created_by_name: Optional[str] = None


class AuditItemUpdateRequest(BaseModel):
    physical_status: str = Field(..., pattern="^(VERIFIED|MISSING|DAMAGED)$")
    notes: Optional[str] = Field(None, max_length=2000)


class AuditCycleCloseResponse(BaseModel):
    closed: bool
    assets_marked_lost: int
    allocations_terminated: int
    total_items: int
    verified_count: int
    missing_count: int
    damaged_count: int

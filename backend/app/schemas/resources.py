"""Pydantic schemas for Assets, Bookings, and Maintenance."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Asset ──────────────────────────────────────────────────────
class AssetRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    serial_number: Optional[str] = Field(None, max_length=255)
    category_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    acquisition_date: Optional[datetime] = None
    acquisition_cost: Optional[float] = Field(None, gt=0)
    condition: str = Field(default="GOOD", pattern=r"^(EXCELLENT|GOOD|FAIR|POOR)$")
    condition_notes: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    is_shared: bool = False
    photo_url: Optional[str] = Field(None, max_length=512)


class AssetDirectoryParams(BaseModel):
    search: Optional[str] = None
    category_id: Optional[UUID] = None
    status: Optional[str] = None
    department_id: Optional[UUID] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


class AssetResponse(BaseModel):
    id: UUID
    asset_tag: str
    name: str
    serial_number: Optional[str] = None
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    acquisition_date: Optional[datetime] = None
    acquisition_cost: Optional[float] = None
    condition: str
    condition_notes: Optional[str] = None
    location: Optional[str] = None
    is_shared: bool = False
    photo_url: Optional[str] = None
    current_status: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: list[AssetResponse]
    total: int
    page: int
    limit: int
    pages: int


class AllocationHistoryItem(BaseModel):
    id: UUID
    user_id: UUID
    user_name: Optional[str] = None
    department_name: Optional[str] = None
    allocated_at: datetime
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    status: str


class MaintenanceHistoryItem(BaseModel):
    id: UUID
    requested_by_user_id: UUID
    requested_by_name: Optional[str] = None
    priority: str
    issue_description: str
    resolution_notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class AssetDetailResponse(AssetResponse):
    allocation_history: list[AllocationHistoryItem] = []
    maintenance_history: list[MaintenanceHistoryItem] = []


class AssetStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(AVAILABLE|ALLOCATED|RESERVED|UNDER_MAINTENANCE|LOST|RETIRED|DISPOSED)$")


# ── Booking ────────────────────────────────────────────────────
class BookingCreateRequest(BaseModel):
    asset_id: UUID
    start_time: datetime
    end_time: datetime
    title: Optional[str] = Field(None, max_length=255)


class BookingUpdateRequest(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = Field(None, pattern=r"^(UPCOMING|ONGOING|COMPLETED|CANCELLED)$")
    title: Optional[str] = Field(None, max_length=255)


class BookingResponse(BaseModel):
    id: UUID
    asset_id: UUID
    user_id: UUID
    title: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class BookingDetailResponse(BookingResponse):
    user_name: Optional[str] = None
    department_name: Optional[str] = None
    asset_name: Optional[str] = None
    asset_tag: Optional[str] = None


class BookableResourceResponse(BaseModel):
    id: UUID
    asset_tag: str
    name: str
    location: Optional[str] = None
    current_status: str
    model_config = {"from_attributes": True}


# ── Maintenance ────────────────────────────────────────────────
class MaintenanceCreateRequest(BaseModel):
    asset_id: UUID
    priority: str = Field(default="MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    issue_description: str = Field(..., min_length=1, max_length=2000)


class MaintenanceStatusUpdateRequest(BaseModel):
    new_status: str = Field(
        ...,
        pattern="^(APPROVED|REJECTED|TECHNICIAN_ASSIGNED|IN_PROGRESS|RESOLVED)$",
    )
    assigned_technician_id: Optional[UUID] = None
    resolution_notes: Optional[str] = Field(None, max_length=2000)


class MaintenanceResponse(BaseModel):
    id: UUID
    asset_id: UUID
    requested_by_user_id: UUID
    approved_by_user_id: Optional[UUID] = None
    assigned_technician_id: Optional[UUID] = None
    priority: str
    status: str
    issue_description: str
    resolution_notes: Optional[str] = None
    previous_asset_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class MaintenanceDetailResponse(MaintenanceResponse):
    asset_tag: Optional[str] = None
    asset_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    approved_by_name: Optional[str] = None
    assigned_technician_name: Optional[str] = None

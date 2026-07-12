"""Allocation endpoints — Assign, return, transfer-status check."""
from __future__ import annotations

from datetime import datetime as dt
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, text

from ..dependencies import get_current_active_user, require_role
from ..models import (
    Allocation,
    AllocationStatus,
    Asset,
    AssetStatus,
    Department,
    NotificationType,
    User,
)
from ..services.notifications import create_notification

router = APIRouter(prefix="/api/allocations", tags=["allocations"])


# ── Schemas ─────────────────────────────────────────────────────

class AllocationCreateRequest(BaseModel):
    asset_id: UUID
    user_id: UUID
    department_id: UUID | None = None
    expected_return_date: str | None = None
    condition_notes: str | None = None


class AllocationReturnRequest(BaseModel):
    condition_notes: str | None = None


class AllocationResponse(BaseModel):
    id: UUID
    asset_id: UUID
    user_id: UUID
    user_name: str | None = None
    department_id: UUID | None = None
    department_name: str | None = None
    allocated_at: Any
    expected_return_date: Any
    actual_return_date: Any
    condition_notes: str | None = None
    status: str
    created_at: Any
    model_config = {"from_attributes": True}


class HolderInfo(BaseModel):
    user_id: UUID
    user_name: str
    department_name: str | None = None
    allocated_at: Any
    expected_return_date: Any = None


class AllocationStatusResponse(BaseModel):
    asset_id: UUID
    asset_tag: str
    asset_name: str
    current_status: str
    is_shared: bool
    is_allocated: bool
    current_holder: HolderInfo | None = None
    active_allocation_id: UUID | None = None


# ── Helper ──────────────────────────────────────────────────────

def _build_response(a: Allocation, user_name: str | None = None, dept_name: str | None = None) -> AllocationResponse:
    return AllocationResponse(
        id=a.id,
        asset_id=a.asset_id,
        user_id=a.user_id,
        user_name=user_name,
        department_id=a.department_id,
        department_name=dept_name,
        allocated_at=a.allocated_at,
        expected_return_date=a.expected_return_date,
        actual_return_date=a.actual_return_date,
        condition_notes=a.condition_notes,
        status=a.status.value if hasattr(a.status, "value") else str(a.status),
        created_at=a.created_at,
    )


# ── 1. Asset Allocation Status (drives the UI) ─────────────────

@router.get("/asset-status/{asset_id}", response_model=AllocationStatusResponse)
async def get_allocation_status(
    asset_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AllocationStatusResponse:
    """Returns current asset allocation status to drive the UI form."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        asset = db.get(Asset, asset_id)
        if not asset or not asset.is_active:
            raise HTTPException(404, "Asset not found")

        # Find active allocation
        active_alloc = db.scalar(
            select(Allocation).where(
                Allocation.asset_id == asset_id,
                Allocation.status == AllocationStatus.ACTIVE,
            )
        )

        holder = None
        if active_alloc:
            holder_user = db.get(User, active_alloc.user_id)
            holder_dept = db.get(Department, active_alloc.department_id) if active_alloc.department_id else None
            holder = HolderInfo(
                user_id=active_alloc.user_id,
                user_name=holder_user.full_name if holder_user else "Unknown",
                department_name=holder_dept.name if holder_dept else None,
                allocated_at=active_alloc.allocated_at,
                expected_return_date=active_alloc.expected_return_date,
            )

        return AllocationStatusResponse(
            asset_id=asset.id,
            asset_tag=asset.asset_tag,
            asset_name=asset.name,
            current_status=asset.current_status.value if hasattr(asset.current_status, "value") else str(asset.current_status),
            is_shared=asset.is_shared,
            is_allocated=active_alloc is not None,
            current_holder=holder,
            active_allocation_id=active_alloc.id if active_alloc else None,
        )
    finally:
        db.close()


# ── 2. Direct Allocation (with row locking) ────────────────────

@router.post(
    "",
    response_model=AllocationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"))],
)
async def create_allocation(
    body: AllocationCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AllocationResponse:
    """Allocate an available asset with row-level locking to prevent double allocation."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Lock the asset row to prevent race conditions
        result = db.execute(
            text("SELECT * FROM assets WHERE id = :id FOR UPDATE"),
            {"id": str(body.asset_id)},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(404, "Asset not found")

        if not row["is_active"]:
            raise HTTPException(404, "Asset not found")

        current_status = row["current_status"]
        if current_status != "AVAILABLE":
            raise HTTPException(
                status_code=409,
                detail=f"Asset is not available (status: {current_status})",
            )

        if row["is_shared"]:
            raise HTTPException(
                status_code=400,
                detail="Shared assets cannot be permanently allocated. Use the Booking system.",
            )

        # Target user must exist and be active
        target_user = db.get(User, body.user_id)
        if not target_user or not target_user.is_active:
            raise HTTPException(404, "Target user not found or inactive")

        expected = None
        if body.expected_return_date:
            try:
                expected = dt.fromisoformat(body.expected_return_date)
            except ValueError:
                raise HTTPException(400, "Invalid expected_return_date format")

        allocation = Allocation(
            asset_id=body.asset_id,
            user_id=body.user_id,
            department_id=body.department_id or target_user.department_id,
            expected_return_date=expected,
            condition_notes=body.condition_notes,
            status=AllocationStatus.ACTIVE,
        )
        db.add(allocation)

        # Update asset status
        dept_id = body.department_id or target_user.department_id
        db.execute(
            text("UPDATE assets SET current_status = :status, department_id = :dept WHERE id = :id"),
            {
                "status": "ALLOCATED",
                "dept": str(dept_id) if dept_id else None,
                "id": str(body.asset_id),
            },
        )

        db.commit()
        db.refresh(allocation)

        # Create notification for the assigned user
        create_notification(
            db,
            user_id=body.user_id,
            notification_type=NotificationType.ASSET_ALLOCATED,
            title="Asset Assigned",
            message=f"Asset {asset.asset_tag} has been assigned to you",
        )
        db.commit()

        return _build_response(
            allocation,
            user_name=target_user.full_name,
            dept_name=target_user.department.name if target_user.department else None,
        )
    finally:
        db.close()


# ── 3. Return Asset (with condition_notes) ─────────────────────

@router.post("/{allocation_id}/return", response_model=AllocationResponse)
async def return_asset(
    allocation_id: UUID,
    body: AllocationReturnRequest = AllocationReturnRequest(),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AllocationResponse:
    """Return an allocated asset with optional condition notes."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        alloc = db.get(Allocation, allocation_id)
        if not alloc:
            raise HTTPException(404, "Allocation not found")

        if alloc.status != AllocationStatus.ACTIVE:
            raise HTTPException(409, f"Allocation is already {alloc.status.value}")

        # EC5: Verify asset is actually in ALLOCATED status (prevent resurrecting lost/maintenance assets)
        asset = db.get(Asset, alloc.asset_id)
        if asset and asset.current_status != AssetStatus.ALLOCATED:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot return: asset status is {asset.current_status.value}, not ALLOCATED. "
                    f"Update the asset status first."
                ),
            )

        user_role = current_user.get("role", "EMPLOYEE")
        user_id = current_user.get("id")
        if user_role not in ("ADMIN", "ASSET_MANAGER") and str(alloc.user_id) != str(user_id):
            raise HTTPException(403, "You can only return your own allocations")

        alloc.status = AllocationStatus.RETURNED
        alloc.actual_return_date = dt.utcnow()
        if body.condition_notes:
            alloc.condition_notes = body.condition_notes

        # Set asset back to AVAILABLE
        db.execute(
            text("UPDATE assets SET current_status = :status WHERE id = :id"),
            {"status": "AVAILABLE", "id": str(alloc.asset_id)},
        )

        db.commit()
        db.refresh(alloc)

        # Create notification for the user
        create_notification(
            db,
            user_id=alloc.user_id,
            notification_type=NotificationType.ASSET_RETURNED,
            title="Asset Returned",
            message=f"Asset has been returned successfully",
        )
        db.commit()

        user = db.get(User, alloc.user_id)
        dept = db.get(Department, alloc.department_id) if alloc.department_id else None
        return _build_response(alloc, user_name=user.full_name if user else None, dept_name=dept.name if dept else None)
    finally:
        db.close()


# ── 4. List Allocations ────────────────────────────────────────

@router.get("", response_model=list[AllocationResponse])
async def list_allocations(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[AllocationResponse]:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        user_id = current_user.get("id")

        stmt = select(Allocation)
        if role in ("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"):
            pass
        else:
            stmt = stmt.where(Allocation.user_id == UUID(str(user_id)))

        stmt = stmt.order_by(Allocation.allocated_at.desc()).limit(50)
        allocs = db.scalars(stmt).all()

        results = []
        for a in allocs:
            user = db.get(User, a.user_id)
            dept = db.get(Department, a.department_id) if a.department_id else None
            results.append(_build_response(a, user_name=user.full_name if user else None, dept_name=dept.name if dept else None))
        return results
    finally:
        db.close()

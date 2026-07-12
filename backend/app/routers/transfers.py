"""Transfer endpoints — Request and approve asset transfers."""
from __future__ import annotations

from datetime import datetime as dt
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
    Transfer,
    TransferStatus,
    User,
)
from ..services.notifications import create_notification

router = APIRouter(prefix="/api/transfers", tags=["transfers"])


# ── Schemas ─────────────────────────────────────────────────────

class TransferCreateRequest(BaseModel):
    asset_id: UUID
    from_user_id: UUID
    to_user_id: UUID
    reason: str


class TransferApproveRequest(BaseModel):
    condition_notes: str | None = None


class TransferResponse(BaseModel):
    id: UUID
    asset_id: UUID
    asset_tag: str | None = None
    asset_name: str | None = None
    from_user_id: UUID
    from_user_name: str | None = None
    to_user_id: UUID
    to_user_name: str | None = None
    reason: str
    status: str
    requested_by: UUID
    requested_by_name: str | None = None
    approved_by: UUID | None = None
    approved_by_name: str | None = None
    created_at: Any
    updated_at: Any
    model_config = {"from_attributes": True}


def _build_transfer_response(t: Transfer, db) -> TransferResponse:
    asset = db.get(Asset, t.asset_id)
    from_user = db.get(User, t.from_user_id)
    to_user = db.get(User, t.to_user_id)
    requester = db.get(User, t.requested_by)
    approver = db.get(User, t.approved_by) if t.approved_by else None

    return TransferResponse(
        id=t.id,
        asset_id=t.asset_id,
        asset_tag=asset.asset_tag if asset else None,
        asset_name=asset.name if asset else None,
        from_user_id=t.from_user_id,
        from_user_name=from_user.full_name if from_user else None,
        to_user_id=t.to_user_id,
        to_user_name=to_user.full_name if to_user else None,
        reason=t.reason,
        status=t.status.value if hasattr(t.status, "value") else str(t.status),
        requested_by=t.requested_by,
        requested_by_name=requester.full_name if requester else None,
        approved_by=t.approved_by,
        approved_by_name=approver.full_name if approver else None,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


# ── 1. Create Transfer Request ─────────────────────────────────

@router.post(
    "",
    response_model=TransferResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transfer(
    body: TransferCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> TransferResponse:
    """Initiate a transfer request. Does NOT change asset status."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        asset = db.get(Asset, body.asset_id)
        if not asset or not asset.is_active:
            raise HTTPException(404, "Asset not found")

        # Asset must be ALLOCATED to transfer
        if asset.current_status != AssetStatus.ALLOCATED:
            raise HTTPException(
                status_code=409,
                detail=f"Asset must be ALLOCATED to transfer (current: {asset.current_status.value})",
            )

        # Verify the from_user actually holds the asset
        active_alloc = db.scalar(
            select(Allocation).where(
                Allocation.asset_id == body.asset_id,
                Allocation.user_id == body.from_user_id,
                Allocation.status == AllocationStatus.ACTIVE,
            )
        )
        if not active_alloc:
            raise HTTPException(
                status_code=400,
                detail="from_user does not currently hold this asset",
            )

        # Cannot transfer to yourself
        if body.from_user_id == body.to_user_id:
            raise HTTPException(400, "Cannot transfer to the same user")

        # Verify both users exist
        from_user = db.get(User, body.from_user_id)
        to_user = db.get(User, body.to_user_id)
        if not from_user or not from_user.is_active:
            raise HTTPException(404, "From-user not found or inactive")
        if not to_user or not to_user.is_active:
            raise HTTPException(404, "To-user not found or inactive")

        # Check for pending transfer on this asset
        pending = db.scalar(
            select(Transfer).where(
                Transfer.asset_id == body.asset_id,
                Transfer.status == TransferStatus.PENDING,
            )
        )
        if pending:
            raise HTTPException(
                status_code=409,
                detail="A pending transfer already exists for this asset",
            )

        transfer = Transfer(
            asset_id=body.asset_id,
            from_user_id=body.from_user_id,
            to_user_id=body.to_user_id,
            reason=body.reason,
            status=TransferStatus.PENDING,
            requested_by=UUID(current_user["id"]),
        )
        db.add(transfer)
        db.commit()
        db.refresh(transfer)

        return _build_transfer_response(transfer, db)
    finally:
        db.close()


# ── 2. Approve Transfer (atomic with row locking) ──────────────

@router.patch(
    "/{transfer_id}/approve",
    response_model=TransferResponse,
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"))],
)
async def approve_transfer(
    transfer_id: UUID,
    body: TransferApproveRequest = TransferApproveRequest(),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> TransferResponse:
    """Approve a pending transfer atomically with row-level locking."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Lock the transfer row
        result = db.execute(
            text("SELECT * FROM transfers WHERE id = :id FOR UPDATE"),
            {"id": str(transfer_id)},
        )
        transfer_row = result.mappings().first()
        if not transfer_row:
            raise HTTPException(404, "Transfer not found")

        if transfer_row["status"] != "PENDING":
            raise HTTPException(
                status_code=409,
                detail=f"Transfer is already {transfer_row['status']}",
            )

        asset_id = transfer_row["asset_id"]
        from_user_id = transfer_row["from_user_id"]
        to_user_id = transfer_row["to_user_id"]

        # Lock the asset row to verify state hasn't changed
        asset_result = db.execute(
            text("SELECT * FROM assets WHERE id = :id FOR UPDATE"),
            {"id": str(asset_id)},
        )
        asset_row = asset_result.mappings().first()
        if not asset_row:
            raise HTTPException(404, "Asset not found")

        if asset_row["current_status"] != "ALLOCATED":
            raise HTTPException(
                status_code=409,
                detail=f"Asset is no longer allocated (status: {asset_row['current_status']})",
            )

        # Verify asset is still held by from_user
        alloc_result = db.execute(
            text(
                "SELECT * FROM allocations WHERE asset_id = :asset_id "
                "AND user_id = :user_id AND status = 'ACTIVE' FOR UPDATE"
            ),
            {"asset_id": str(asset_id), "user_id": str(from_user_id)},
        )
        alloc_row = alloc_result.mappings().first()
        if not alloc_row:
            raise HTTPException(
                status_code=409,
                detail="Asset is no longer held by the from_user",
            )

        to_user = db.get(User, to_user_id)

        # Close old allocation
        db.execute(
            text("UPDATE allocations SET status = 'TRANSFERRED', actual_return_date = now() WHERE id = :id"),
            {"id": str(alloc_row["id"])},
        )

        # Create new allocation for to_user
        to_dept = to_user.department_id if to_user else None
        db.execute(
            text(
                "INSERT INTO allocations (asset_id, user_id, department_id, status, allocated_at) "
                "VALUES (:asset_id, :user_id, :dept_id, 'ACTIVE', now())"
            ),
            {
                "asset_id": str(asset_id),
                "user_id": str(to_user_id),
                "dept_id": str(to_dept) if to_dept else None,
            },
        )

        # Update asset department
        db.execute(
            text("UPDATE assets SET department_id = :dept WHERE id = :id"),
            {
                "dept": str(to_dept) if to_dept else None,
                "id": str(asset_id),
            },
        )

        # Update transfer status
        db.execute(
            text("UPDATE transfers SET status = 'APPROVED', approved_by = :approver, updated_at = now() WHERE id = :id"),
            {
                "approver": str(current_user["id"]),
                "id": str(transfer_id),
            },
        )

        db.commit()

        # Reload transfer
        transfer = db.get(Transfer, transfer_id)

        # Notify both users
        to_user = db.get(User, to_user_id)
        from_user = db.get(User, from_user_id)
        asset = db.get(Asset, asset_id)
        asset_name = f" {asset.asset_tag}" if asset else ""

        create_notification(
            db,
            user_id=to_user_id,
            notification_type=NotificationType.GENERAL,
            title="Transfer Approved",
            message=f"Transfer of{asset_name} to you has been approved",
        )
        create_notification(
            db,
            user_id=from_user_id,
            notification_type=NotificationType.GENERAL,
            title="Transfer Approved",
            message=f"Your transfer of{asset_name} has been approved",
        )
        db.commit()

        return _build_transfer_response(transfer, db)
    finally:
        db.close()


# ── 3. Reject Transfer ─────────────────────────────────────────

@router.patch(
    "/{transfer_id}/reject",
    response_model=TransferResponse,
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"))],
)
async def reject_transfer(
    transfer_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> TransferResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        transfer = db.get(Transfer, transfer_id)
        if not transfer:
            raise HTTPException(404, "Transfer not found")
        if transfer.status != TransferStatus.PENDING:
            raise HTTPException(409, f"Transfer is already {transfer.status.value}")

        transfer.status = TransferStatus.REJECTED
        transfer.approved_by = UUID(current_user["id"])
        db.commit()
        db.refresh(transfer)

        # Notify requester
        asset = db.get(Asset, transfer.asset_id)
        asset_name = f" {asset.asset_tag}" if asset else ""
        create_notification(
            db,
            user_id=transfer.from_user_id,
            notification_type=NotificationType.GENERAL,
            title="Transfer Rejected",
            message=f"Your transfer request for{asset_name} has been rejected",
        )
        db.commit()

        return _build_transfer_response(transfer, db)
    finally:
        db.close()


# ── 4. List Transfers ──────────────────────────────────────────

@router.get("", response_model=list[TransferResponse])
async def list_transfers(
    asset_status: str | None = None,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[TransferResponse]:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        user_id = current_user.get("id")

        stmt = select(Transfer)
        if role not in ("ADMIN", "ASSET_MANAGER"):
            stmt = stmt.where(
                (Transfer.from_user_id == UUID(str(user_id)))
                | (Transfer.to_user_id == UUID(str(user_id)))
                | (Transfer.requested_by == UUID(str(user_id)))
            )

        if asset_status:
            try:
                s = TransferStatus(asset_status)
                stmt = stmt.where(Transfer.status == s)
            except ValueError:
                pass

        stmt = stmt.order_by(Transfer.created_at.desc()).limit(50)
        transfers = db.scalars(stmt).all()
        return [_build_transfer_response(t, db) for t in transfers]
    finally:
        db.close()

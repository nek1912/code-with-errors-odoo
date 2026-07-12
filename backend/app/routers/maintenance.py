"""Maintenance request endpoints — Raise, list, update with state machine."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from ..dependencies import get_current_active_user, require_role
from ..models import (
    Asset,
    AssetStatus,
    MaintenancePriority,
    MaintenanceRequest,
    MaintenanceStatus,
    NotificationType,
    User,
)
from ..schemas.resources import (
    MaintenanceCreateRequest,
    MaintenanceDetailResponse,
    MaintenanceResponse,
    MaintenanceStatusUpdateRequest,
)
from ..services.notifications import create_notification

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

# ── State Machine Definition ────────────────────────────────────
# Valid transitions: current_status -> list of allowed next statuses
VALID_TRANSITIONS: dict[MaintenanceStatus, list[MaintenanceStatus]] = {
    MaintenanceStatus.PENDING: [MaintenanceStatus.APPROVED, MaintenanceStatus.REJECTED],
    MaintenanceStatus.APPROVED: [MaintenanceStatus.TECHNICIAN_ASSIGNED],
    MaintenanceStatus.TECHNICIAN_ASSIGNED: [MaintenanceStatus.IN_PROGRESS],
    MaintenanceStatus.IN_PROGRESS: [MaintenanceStatus.RESOLVED],
    MaintenanceStatus.REJECTED: [],
    MaintenanceStatus.RESOLVED: [],
}

# Terminal states where no further transitions are allowed
TERMINAL_STATES = {MaintenanceStatus.REJECTED, MaintenanceStatus.RESOLVED}


# ── 1. Get Maintenance Board ───────────────────────────────────


@router.get("", response_model=list[MaintenanceDetailResponse])
async def list_maintenance_requests(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[MaintenanceDetailResponse]:
    """Return all maintenance requests with asset and user details."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        user_id = UUID(current_user["id"])
        dept_id = current_user.get("department_id")

        stmt = select(MaintenanceRequest)

        if role in ("ADMIN", "ASSET_MANAGER"):
            pass  # see all
        elif role == "DEPARTMENT_HEAD" and dept_id:
            stmt = stmt.where(
                MaintenanceRequest.asset_id.in_(
                    select(Asset.id).where(Asset.department_id == UUID(str(dept_id)))
                )
            )
        else:
            stmt = stmt.where(MaintenanceRequest.requested_by_user_id == user_id)

        stmt = stmt.order_by(MaintenanceRequest.created_at.desc())
        rows = db.scalars(stmt).all()

        # Batch-resolve related entities
        user_ids: set[UUID] = set()
        asset_ids: set[UUID] = set()
        for r in rows:
            user_ids.add(r.requested_by_user_id)
            if r.approved_by_user_id:
                user_ids.add(r.approved_by_user_id)
            if r.assigned_technician_id:
                user_ids.add(r.assigned_technician_id)
            asset_ids.add(r.asset_id)

        user_map: dict[UUID, str] = {}
        if user_ids:
            users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
            user_map = {u.id: u.full_name for u in users}

        asset_map: dict[UUID, tuple[str, str]] = {}
        if asset_ids:
            assets = db.scalars(select(Asset).where(Asset.id.in_(asset_ids))).all()
            asset_map = {a.id: (a.asset_tag, a.name) for a in assets}

        return [
            MaintenanceDetailResponse(
                id=r.id,
                asset_id=r.asset_id,
                requested_by_user_id=r.requested_by_user_id,
                approved_by_user_id=r.approved_by_user_id,
                assigned_technician_id=r.assigned_technician_id,
                priority=r.priority.value if hasattr(r.priority, "value") else str(r.priority),
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                issue_description=r.issue_description,
                resolution_notes=r.resolution_notes,
                previous_asset_status=r.previous_asset_status,
                created_at=r.created_at,
                updated_at=r.updated_at,
                asset_tag=asset_map.get(r.asset_id, (None, None))[0],
                asset_name=asset_map.get(r.asset_id, (None, None))[1],
                requested_by_name=user_map.get(r.requested_by_user_id),
                approved_by_name=user_map.get(r.approved_by_user_id),
                assigned_technician_name=user_map.get(r.assigned_technician_id),
            )
            for r in rows
        ]
    finally:
        db.close()


# ── 2. Raise Maintenance Request ───────────────────────────────


@router.post(
    "",
    response_model=MaintenanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def raise_maintenance_request(
    body: MaintenanceCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> MaintenanceResponse:
    """
    Create a new maintenance request.

    Edge Case 2: Duplicate Request Spam Prevention.
    Reject if an active request already exists for this asset.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        asset = db.get(Asset, body.asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Check for existing active request on this asset
        active_statuses = [
            MaintenanceStatus.PENDING,
            MaintenanceStatus.APPROVED,
            MaintenanceStatus.TECHNICIAN_ASSIGNED,
            MaintenanceStatus.IN_PROGRESS,
        ]
        existing = db.scalars(
            select(MaintenanceRequest).where(
                MaintenanceRequest.asset_id == body.asset_id,
                MaintenanceRequest.status.in_(active_statuses),
            )
        ).first()

        if existing:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"An active maintenance request already exists for this asset "
                    f"(status: {existing.status.value})"
                ),
            )

        req = MaintenanceRequest(
            asset_id=body.asset_id,
            requested_by_user_id=UUID(current_user["id"]),
            priority=MaintenancePriority(body.priority),
            issue_description=body.issue_description,
            status=MaintenanceStatus.PENDING,
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return MaintenanceResponse.model_validate(req)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── 3. Update Maintenance Status (Critical Endpoint) ───────────


@router.patch(
    "/{request_id}/status",
    response_model=MaintenanceDetailResponse,
)
async def update_maintenance_status(
    request_id: UUID,
    body: MaintenanceStatusUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> MaintenanceDetailResponse:
    """
    Update maintenance request status with strict state machine enforcement.

    Edge Case 1: Skip-Level Prevention — validates transitions against VALID_TRANSITIONS.
    Edge Case 3: Ghost Approver — locks asset row and checks status before approval.
    Edge Case 4: Rejection Rollback — only changes asset status on specific transitions.
    Edge Case 5: Admin Override — admins can force-update stuck requests.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        is_privileged = role in ("ADMIN", "ASSET_MANAGER")

        req = db.get(MaintenanceRequest, request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Maintenance request not found")

        current_status = req.status
        try:
            new_status = MaintenanceStatus(body.new_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{body.new_status}'",
            )

        # Prevent updating terminal states (unless admin override)
        if current_status in TERMINAL_STATES and not is_privileged:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update a {current_status.value} request",
            )

        # Edge Case 1: State Machine Validation
        allowed = VALID_TRANSITIONS.get(current_status, [])
        if new_status not in allowed and not is_privileged:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid workflow transition: {current_status.value} -> {new_status.value}. "
                    f"Allowed: {[s.value for s in allowed]}"
                ),
            )

        # Fetch the asset with row lock
        asset = db.execute(
            select(Asset).where(Asset.id == req.asset_id).with_for_update()
        ).scalar_one_or_none()

        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Edge Case 3: Ghost Approver — check asset status before approval
        if new_status == MaintenanceStatus.APPROVED:
            if asset.current_status in (
                AssetStatus.LOST,
                AssetStatus.RETIRED,
                AssetStatus.DISPOSED,
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Cannot approve maintenance: asset is {asset.current_status.value}"
                    ),
                )
            # Store previous asset status for restoration on resolve
            req.previous_asset_status = asset.current_status.value
            # Edge Case 4: Only change to UNDER_MAINTENANCE on approval
            asset.current_status = AssetStatus.UNDER_MAINTENANCE

        # On rejection, do NOT change asset status
        elif new_status == MaintenanceStatus.REJECTED:
            pass  # No asset status change

        # On resolve, restore asset status
        elif new_status == MaintenanceStatus.RESOLVED:
            prev = req.previous_asset_status
            if prev and prev in [s.value for s in AssetStatus]:
                try:
                    asset.current_status = AssetStatus(prev)
                except ValueError:
                    asset.current_status = AssetStatus.AVAILABLE
            else:
                asset.current_status = AssetStatus.AVAILABLE

        # Assign technician
        if new_status == MaintenanceStatus.TECHNICIAN_ASSIGNED:
            if body.assigned_technician_id:
                req.assigned_technician_id = body.assigned_technician_id
            elif not req.assigned_technician_id:
                raise HTTPException(
                    status_code=422,
                    detail="assigned_technician_id is required when assigning a technician",
                )

        # Resolution notes required on resolve
        if new_status == MaintenanceStatus.RESOLVED:
            if body.resolution_notes:
                req.resolution_notes = body.resolution_notes
            elif not req.resolution_notes:
                raise HTTPException(
                    status_code=422,
                    detail="resolution_notes is required when resolving a request",
                )

        # Record approver
        if new_status == MaintenanceStatus.APPROVED:
            req.approved_by_user_id = UUID(current_user["id"])

        # Update resolution notes if provided
        if body.resolution_notes and new_status == MaintenanceStatus.RESOLVED:
            req.resolution_notes = body.resolution_notes

        req.status = new_status
        db.commit()
        db.refresh(req)

        # Create notification for the requester based on status change
        notif_map = {
            MaintenanceStatus.APPROVED: (NotificationType.MAINTENANCE_APPROVED, "Maintenance Approved"),
            MaintenanceStatus.REJECTED: (NotificationType.MAINTENANCE_REJECTED, "Maintenance Rejected"),
            MaintenanceStatus.RESOLVED: (NotificationType.MAINTENANCE_RESOLVED, "Maintenance Resolved"),
        }
        if new_status in notif_map:
            ntype, title = notif_map[new_status]
            create_notification(
                db,
                user_id=req.requested_by_user_id,
                notification_type=ntype,
                title=title,
                message=f"Maintenance request for {asset.asset_tag}: {new_status.value}",
            )
            db.commit()

        # Build response
        user_ids = {req.requested_by_user_id}
        if req.approved_by_user_id:
            user_ids.add(req.approved_by_user_id)
        if req.assigned_technician_id:
            user_ids.add(req.assigned_technician_id)

        user_map: dict[UUID, str] = {}
        if user_ids:
            users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
            user_map = {u.id: u.full_name for u in users}

        return MaintenanceDetailResponse(
            id=req.id,
            asset_id=req.asset_id,
            requested_by_user_id=req.requested_by_user_id,
            approved_by_user_id=req.approved_by_user_id,
            assigned_technician_id=req.assigned_technician_id,
            priority=req.priority.value if hasattr(req.priority, "value") else str(req.priority),
            status=req.status.value if hasattr(req.status, "value") else str(req.status),
            issue_description=req.issue_description,
            resolution_notes=req.resolution_notes,
            previous_asset_status=req.previous_asset_status,
            created_at=req.created_at,
            updated_at=req.updated_at,
            asset_tag=asset.asset_tag,
            asset_name=asset.name,
            requested_by_name=user_map.get(req.requested_by_user_id),
            approved_by_name=user_map.get(req.approved_by_user_id),
            assigned_technician_name=user_map.get(req.assigned_technician_id),
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

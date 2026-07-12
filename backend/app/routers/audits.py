"""Audit cycle endpoints — Create, list, update items, close with transaction."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from ..dependencies import get_current_active_user, require_role
from ..models import (
    Allocation,
    AllocationStatus,
    Asset,
    AssetStatus,
    AuditCycle,
    AuditCycleStatus,
    AuditItem,
    AuditScopeType,
    Department,
    NotificationType,
    PhysicalStatus,
    User,
)
from ..schemas.audits import (
    AuditCycleCloseResponse,
)
from ..services.notifications import create_notification
from ..schemas.audits import (
    AuditCycleCloseResponse,
    AuditCycleCreateRequest,
    AuditCycleDetailResponse,
    AuditCycleResponse,
    AuditItemResponse,
    AuditItemUpdateRequest,
)

router = APIRouter(prefix="/api/audits", tags=["audits"])


# ── 1. List Audit Cycles ───────────────────────────────────────


@router.get("", response_model=list[AuditCycleResponse])
async def list_audit_cycles(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[AuditCycleResponse]:
    """Return all audit cycles the user can see."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        user_id = UUID(current_user["id"])

        stmt = select(AuditCycle)

        if role in ("ADMIN", "ASSET_MANAGER"):
            pass  # see all
        else:
            # Auditors see cycles they are assigned to
            assigned_cycle_ids = select(AuditItem.audit_cycle_id).where(
                AuditItem.auditor_user_id == user_id
            )
            stmt = stmt.where(AuditCycle.id.in_(assigned_cycle_ids))

        stmt = stmt.order_by(AuditCycle.created_at.desc())
        cycles = db.scalars(stmt).all()
        return [AuditCycleResponse.model_validate(c) for c in cycles]
    finally:
        db.close()


# ── 2. Create Audit Cycle ──────────────────────────────────────


@router.post(
    "",
    response_model=AuditCycleDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER"))],
)
async def create_audit_cycle(
    body: AuditCycleCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AuditCycleDetailResponse:
    """
    Create a new audit cycle with asset snapshot.

    Edge Case 2: Snapshots assets at creation time into audit_items.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Validate dates
        if body.end_date < body.start_date:
            raise HTTPException(
                status_code=422,
                detail="end_date must be on or after start_date",
            )

        # Resolve scope type
        try:
            scope_type = AuditScopeType(body.scope_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid scope_type '{body.scope_type}'",
            )

        # Create the cycle
        cycle = AuditCycle(
            name=body.name,
            scope_type=scope_type,
            scope_id=body.scope_id,
            created_by_user_id=UUID(current_user["id"]),
            start_date=body.start_date,
            end_date=body.end_date,
            status=AuditCycleStatus.OPEN,
        )
        db.add(cycle)
        db.flush()  # get the cycle.id

        # Snapshot: query all active assets matching the scope
        asset_stmt = select(Asset).where(Asset.is_active == True)  # noqa: E712

        if scope_type == AuditScopeType.DEPARTMENT and body.scope_id:
            asset_stmt = asset_stmt.where(Asset.department_id == body.scope_id)
        elif scope_type == AuditScopeType.LOCATION and body.scope_id:
            # For location scope, scope_id stores the location as UUID is not ideal
            # but we match by location string if provided
            pass  # All assets if no specific location filter

        assets = db.scalars(asset_stmt).all()

        # Assign auditors round-robin to items
        auditor_ids = [str(aid) for aid in body.auditor_ids]

        items = []
        for i, asset in enumerate(assets):
            auditor_id = UUID(auditor_ids[i % len(auditor_ids)])
            item = AuditItem(
                audit_cycle_id=cycle.id,
                asset_id=asset.id,
                auditor_user_id=auditor_id,
                physical_status=PhysicalStatus.PENDING,
            )
            db.add(item)
            items.append(item)

        db.commit()
        db.refresh(cycle)

        # Build response with item details
        auditor_map = _resolve_users(db, body.auditor_ids)
        scope_name = _resolve_scope_name(db, scope_type, body.scope_id)
        created_by_name = _get_user_name(db, UUID(current_user["id"]))

        item_responses = [
            AuditItemResponse(
                id=item.id,
                audit_cycle_id=item.audit_cycle_id,
                asset_id=item.asset_id,
                auditor_user_id=item.auditor_user_id,
                physical_status=item.physical_status.value,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
                asset_tag=item.asset.asset_tag if item.asset else None,
                asset_name=item.asset.name if item.asset else None,
                asset_location=item.asset.location if item.asset else None,
                auditor_name=auditor_map.get(str(item.auditor_user_id)),
            )
            for item in items
        ]

        return AuditCycleDetailResponse(
            id=cycle.id,
            name=cycle.name,
            scope_type=cycle.scope_type.value,
            scope_id=cycle.scope_id,
            created_by_user_id=cycle.created_by_user_id,
            start_date=cycle.start_date,
            end_date=cycle.end_date,
            status=cycle.status.value,
            created_at=cycle.created_at,
            updated_at=cycle.updated_at,
            items=item_responses,
            auditor_names=list(auditor_map.values()),
            scope_name=scope_name,
            created_by_name=created_by_name,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── 3. Get Audit Cycle & Items ─────────────────────────────────


@router.get("/{audit_id}", response_model=AuditCycleDetailResponse)
async def get_audit_cycle(
    audit_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AuditCycleDetailResponse:
    """Return cycle details with all audit items."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        cycle = db.get(AuditCycle, audit_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Audit cycle not found")

        # Fetch items with asset and auditor details
        items = db.scalars(
            select(AuditItem).where(AuditItem.audit_cycle_id == audit_id)
        ).all()

        # Batch resolve
        auditor_ids = list({item.auditor_user_id for item in items if item.auditor_user_id})
        asset_ids = [item.asset_id for item in items]

        auditor_map = _resolve_users(db, auditor_ids)
        asset_map: dict[UUID, tuple[str, str, str | None]] = {}
        if asset_ids:
            assets = db.scalars(select(Asset).where(Asset.id.in_(asset_ids))).all()
            asset_map = {a.id: (a.asset_tag, a.name, a.location) for a in assets}

        scope_name = _resolve_scope_name(db, cycle.scope_type, cycle.scope_id)
        created_by_name = _get_user_name(db, cycle.created_by_user_id)

        item_responses = [
            AuditItemResponse(
                id=item.id,
                audit_cycle_id=item.audit_cycle_id,
                asset_id=item.asset_id,
                auditor_user_id=item.auditor_user_id,
                physical_status=item.physical_status.value
                if hasattr(item.physical_status, "value")
                else str(item.physical_status),
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
                asset_tag=asset_map.get(item.asset_id, (None, None, None))[0],
                asset_name=asset_map.get(item.asset_id, (None, None, None))[1],
                asset_location=asset_map.get(item.asset_id, (None, None, None))[2],
                auditor_name=auditor_map.get(str(item.auditor_user_id))
                if item.auditor_user_id
                else None,
            )
            for item in items
        ]

        # Collect unique auditor names
        auditor_names = list({v for v in auditor_map.values() if v})

        return AuditCycleDetailResponse(
            id=cycle.id,
            name=cycle.name,
            scope_type=cycle.scope_type.value,
            scope_id=cycle.scope_id,
            created_by_user_id=cycle.created_by_user_id,
            start_date=cycle.start_date,
            end_date=cycle.end_date,
            status=cycle.status.value,
            created_at=cycle.created_at,
            updated_at=cycle.updated_at,
            items=item_responses,
            auditor_names=auditor_names,
            scope_name=scope_name,
            created_by_name=created_by_name,
        )
    finally:
        db.close()


# ── 4. Update Audit Item Status ────────────────────────────────


@router.patch(
    "/{audit_id}/items/{item_id}",
    response_model=AuditItemResponse,
)
async def update_audit_item(
    audit_id: UUID,
    item_id: UUID,
    body: AuditItemUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AuditItemResponse:
    """
    Update an audit item's verification status.

    Edge Case 1: Rejects updates if audit cycle is CLOSED (403).
    Edge Case 5: Does NOT auto-flip asset status to UNDER_MAINTENANCE for DAMAGED.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        cycle = db.get(AuditCycle, audit_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Audit cycle not found")

        # Edge Case 1: Immutable closed cycles
        if cycle.status == AuditCycleStatus.CLOSED:
            raise HTTPException(
                status_code=403,
                detail="Cannot modify a closed audit cycle",
            )

        item = db.get(AuditItem, item_id)
        if not item or item.audit_cycle_id != audit_id:
            raise HTTPException(status_code=404, detail="Audit item not found")

        # Authorization: only assigned auditor or admin/manager can update
        user_id = UUID(current_user["id"])
        role = current_user.get("role", "EMPLOYEE")
        is_privileged = role in ("ADMIN", "ASSET_MANAGER")
        is_assigned = item.auditor_user_id == user_id

        if not is_privileged and not is_assigned:
            raise HTTPException(
                status_code=403,
                detail="You can only update items assigned to you",
            )

        # Validate status
        try:
            new_status = PhysicalStatus(body.physical_status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{body.physical_status}'",
            )

        item.physical_status = new_status
        if body.notes is not None:
            item.notes = body.notes

        db.commit()
        db.refresh(item)

        return AuditItemResponse(
            id=item.id,
            audit_cycle_id=item.audit_cycle_id,
            asset_id=item.asset_id,
            auditor_user_id=item.auditor_user_id,
            physical_status=item.physical_status.value,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
            asset_tag=item.asset.asset_tag if item.asset else None,
            asset_name=item.asset.name if item.asset else None,
            asset_location=item.asset.location if item.asset else None,
            auditor_name=_get_user_name(db, item.auditor_user_id)
            if item.auditor_user_id
            else None,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── 5. Close Audit Cycle (Critical Endpoint) ───────────────────


@router.post(
    "/{audit_id}/close",
    response_model=AuditCycleCloseResponse,
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER"))],
)
async def close_audit_cycle(
    audit_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AuditCycleCloseResponse:
    """
    Close an audit cycle with destructive transaction.

    Edge Case 3: For MISSING items, sets asset to LOST and terminates ACTIVE allocations.
    Edge Case 4: DAMAGED items do NOT auto-flip to UNDER_MAINTENANCE.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Lock the cycle row
        cycle = db.execute(
            select(AuditCycle).where(AuditCycle.id == audit_id).with_for_update()
        ).scalar_one_or_none()

        if not cycle:
            raise HTTPException(status_code=404, detail="Audit cycle not found")

        if cycle.status == AuditCycleStatus.CLOSED:
            raise HTTPException(
                status_code=400,
                detail="Audit cycle is already closed",
            )

        # Fetch all items
        items = db.scalars(
            select(AuditItem).where(AuditItem.audit_cycle_id == audit_id)
        ).all()

        # Count statuses
        verified_count = 0
        missing_count = 0
        damaged_count = 0
        total_items = len(items)

        assets_marked_lost = 0
        allocations_terminated = 0

        for item in items:
            status_val = (
                item.physical_status.value
                if hasattr(item.physical_status, "value")
                else str(item.physical_status)
            )

            if status_val == "VERIFIED":
                verified_count += 1
            elif status_val == "MISSING":
                missing_count += 1
                # Edge Case 3: Mark asset as LOST
                asset = db.execute(
                    select(Asset)
                    .where(Asset.id == item.asset_id)
                    .with_for_update()
                ).scalar_one_or_none()

                if asset and asset.current_status not in (
                    AssetStatus.LOST,
                    AssetStatus.DISPOSED,
                    AssetStatus.RETIRED,
                ):
                    asset.current_status = AssetStatus.LOST
                    assets_marked_lost += 1

                    # Terminate any ACTIVE allocation
                    active_alloc = db.scalars(
                        select(Allocation).where(
                            Allocation.asset_id == item.asset_id,
                            Allocation.status == AllocationStatus.ACTIVE,
                        )
                    ).first()

                    if active_alloc:
                        active_alloc.status = AllocationStatus.RETURNED
                        active_alloc.actual_return_date = func.now()
                        allocations_terminated += 1

            elif status_val == "DAMAGED":
                damaged_count += 1
                # Edge Case 4: Do NOT auto-flip to UNDER_MAINTENANCE
                # Let Asset Manager manually route to maintenance

        # Close the cycle
        cycle.status = AuditCycleStatus.CLOSED
        db.commit()

        # Notify admins/managers about cycle closure
        admins = db.scalars(
            select(User).where(
                User.role.in_(["ADMIN", "ASSET_MANAGER"]),
                User.is_active == True,  # noqa: E712
            )
        ).all()
        for admin in admins:
            create_notification(
                db,
                user_id=admin.id,
                notification_type=NotificationType.GENERAL,
                title="Audit Cycle Closed",
                message=(
                    f"Audit '{cycle.title}' closed: "
                    f"{verified_count} verified, {missing_count} missing, "
                    f"{damaged_count} damaged"
                ),
            )
        db.commit()

        return AuditCycleCloseResponse(
            closed=True,
            assets_marked_lost=assets_marked_lost,
            allocations_terminated=allocations_terminated,
            total_items=total_items,
            verified_count=verified_count,
            missing_count=missing_count,
            damaged_count=damaged_count,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── Helpers ─────────────────────────────────────────────────────


def _resolve_users(db: Any, user_ids: list[UUID]) -> dict[str, str]:
    """Resolve user IDs to full names."""
    if not user_ids:
        return {}
    users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
    return {str(u.id): u.full_name for u in users}


def _get_user_name(db: Any, user_id: UUID | None) -> str | None:
    """Get a single user's name."""
    if not user_id:
        return None
    user = db.get(User, user_id)
    return user.full_name if user else None


def _resolve_scope_name(db: Any, scope_type: AuditScopeType, scope_id: UUID | None) -> str | None:
    """Resolve scope to a human-readable name."""
    if not scope_id:
        return "All Assets" if scope_type == AuditScopeType.ALL else None
    if scope_type == AuditScopeType.DEPARTMENT:
        dept = db.get(Department, scope_id)
        return dept.name if dept else None
    return str(scope_id)

"""Asset endpoints — Directory, Register, Detail, Status Update."""
from __future__ import annotations

import math
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from ..dependencies import get_current_active_user, require_role
from ..models import (
    Allocation,
    AllocationStatus,
    Asset,
    AssetCategory,
    AssetCondition,
    AssetStatus,
    ASSET_STATUS_TRANSITIONS,
    Department,
    MaintenanceRequest,
    User,
)
from ..schemas.resources import (
    AssetDetailResponse,
    AssetListResponse,
    AssetRegisterRequest,
    AssetResponse,
    AssetStatusUpdate,
    AllocationHistoryItem,
    MaintenanceHistoryItem,
)

router = APIRouter(prefix="/api/assets", tags=["assets"])

# ── Helpers ─────────────────────────────────────────────────────


def _build_asset_response(
    asset: Asset,
    include_cost: bool = True,
    category_name: str | None = None,
    department_name: str | None = None,
) -> AssetResponse:
    """Build an AssetResponse, optionally hiding acquisition_cost for EMPLOYEEs."""
    data = {
        "id": asset.id,
        "asset_tag": asset.asset_tag,
        "name": asset.name,
        "serial_number": asset.serial_number,
        "category_id": asset.category_id,
        "category_name": category_name,
        "department_id": asset.department_id,
        "department_name": department_name,
        "acquisition_date": asset.acquisition_date,
        "acquisition_cost": float(asset.acquisition_cost) if include_cost and asset.acquisition_cost else None,
        "condition": asset.condition.value if hasattr(asset.condition, "value") else str(asset.condition),
        "condition_notes": asset.condition_notes,
        "location": asset.location,
        "is_shared": asset.is_shared,
        "photo_url": asset.photo_url,
        "current_status": asset.current_status.value if hasattr(asset.current_status, "value") else str(asset.current_status),
        "is_active": asset.is_active,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }
    return AssetResponse(**data)


# ── 1. Asset Directory (paginated, search, filter) ─────────────


@router.get("", response_model=AssetListResponse)
async def list_assets(
    search: str | None = Query(None),
    category_id: UUID | None = Query(None),
    asset_status: str | None = Query(None, alias="status"),
    department_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AssetListResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        user_dept_id = current_user.get("department_id")
        user_id = current_user.get("id")
        include_cost = role in ("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD")

        # Base query with role-based visibility
        stmt = select(Asset).where(Asset.is_active == True)

        if role in ("ADMIN", "ASSET_MANAGER"):
            pass  # see everything
        elif role == "DEPARTMENT_HEAD" and user_dept_id:
            stmt = stmt.where(
                (Asset.department_id == UUID(str(user_dept_id)))
                | (Asset.is_shared == True)
            )
        else:
            # EMPLOYEE: only allocated-to-me or shared assets
            if user_id:
                allocated_asset_ids = select(Allocation.asset_id).where(
                    Allocation.user_id == UUID(str(user_id)),
                    Allocation.status == AllocationStatus.ACTIVE,
                )
                stmt = stmt.where(
                    (Asset.id.in_(allocated_asset_ids)) | (Asset.is_shared == True)
                )
            else:
                stmt = stmt.where(Asset.is_shared == True)

        # Search filter: tag, serial, name
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Asset.asset_tag.ilike(pattern),
                    Asset.serial_number.ilike(pattern),
                    Asset.name.ilike(pattern),
                )
            )

        # Category filter
        if category_id:
            stmt = stmt.where(Asset.category_id == category_id)

        # Status filter
        if asset_status:
            try:
                status_enum = AssetStatus(asset_status)
                stmt = stmt.where(Asset.current_status == status_enum)
            except ValueError:
                pass

        # Department filter
        if department_id:
            stmt = stmt.where(Asset.department_id == department_id)

        # Count total before pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.scalar(count_stmt) or 0
        pages = max(1, math.ceil(total / limit))

        # Paginate
        offset = (page - 1) * limit
        stmt = stmt.order_by(Asset.created_at.desc()).offset(offset).limit(limit)
        assets = db.scalars(stmt).all()

        # Eager-load category/department names
        cat_ids = {a.category_id for a in assets if a.category_id}
        dept_ids = {a.department_id for a in assets if a.department_id}

        cat_map: dict[UUID, str] = {}
        if cat_ids:
            cats = db.scalars(
                select(AssetCategory).where(AssetCategory.id.in_(cat_ids))
            ).all()
            cat_map = {c.id: c.name for c in cats}

        dept_map: dict[UUID, str] = {}
        if dept_ids:
            depts = db.scalars(
                select(Department).where(Department.id.in_(dept_ids))
            ).all()
            dept_map = {d.id: d.name for d in depts}

        items = [
            _build_asset_response(
                a,
                include_cost=include_cost,
                category_name=cat_map.get(a.category_id),
                department_name=dept_map.get(a.department_id),
            )
            for a in assets
        ]

        return AssetListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )
    finally:
        db.close()


# ── 2. Register Asset ──────────────────────────────────────────


@router.post(
    "",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER"))],
)
async def register_asset(
    body: AssetRegisterRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AssetResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Resolve condition enum
        try:
            cond_enum = AssetCondition(body.condition)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid condition '{body.condition}'. Must be one of: EXCELLENT, GOOD, FAIR, POOR",
            )

        asset = Asset(
            asset_tag="AF-PLACEHOLDER",  # overwritten by DB trigger
            name=body.name,
            serial_number=body.serial_number,
            category_id=body.category_id,
            department_id=body.department_id,
            acquisition_date=body.acquisition_date,
            acquisition_cost=body.acquisition_cost,
            condition=cond_enum,
            condition_notes=body.condition_notes,
            location=body.location,
            is_shared=body.is_shared,
            photo_url=body.photo_url,
            current_status=AssetStatus.AVAILABLE,
        )
        db.add(asset)
        db.flush()  # trigger generates asset_tag
        db.refresh(asset)  # reload trigger-generated tag from DB
        db.commit()

        return _build_asset_response(asset, include_cost=True)
    finally:
        db.close()


# ── 3. Asset Detail ────────────────────────────────────────────


@router.get("/{asset_id}", response_model=AssetDetailResponse)
async def get_asset_detail(
    asset_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> AssetDetailResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        asset = db.get(Asset, asset_id)
        if not asset or not asset.is_active:
            raise HTTPException(status_code=404, detail="Asset not found")

        role = current_user.get("role", "EMPLOYEE")
        include_cost = role in ("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD")

        # Category & department names
        cat_name = asset.category.name if asset.category else None
        dept_name = asset.department.name if asset.department else None

        # Allocation history
        allocations = db.scalars(
            select(Allocation)
            .where(Allocation.asset_id == asset_id)
            .order_by(Allocation.allocated_at.desc())
        ).all()

        alloc_user_ids = {a.user_id for a in allocations}
        alloc_dept_ids = {a.department_id for a in allocations if a.department_id}

        user_map: dict[UUID, str] = {}
        if alloc_user_ids:
            users = db.scalars(
                select(User).where(User.id.in_(alloc_user_ids))
            ).all()
            user_map = {u.id: u.full_name for u in users}

        dept_map: dict[UUID, str] = {}
        if alloc_dept_ids:
            depts = db.scalars(
                select(Department).where(Department.id.in_(alloc_dept_ids))
            ).all()
            dept_map = {d.id: d.name for d in depts}

        allocation_history = [
            AllocationHistoryItem(
                id=a.id,
                user_id=a.user_id,
                user_name=user_map.get(a.user_id),
                department_name=dept_map.get(a.department_id),
                allocated_at=a.allocated_at,
                expected_return_date=a.expected_return_date,
                actual_return_date=a.actual_return_date,
                status=a.status.value if hasattr(a.status, "value") else str(a.status),
            )
            for a in allocations
        ]

        # Maintenance history
        maint_requests = db.scalars(
            select(MaintenanceRequest)
            .where(MaintenanceRequest.asset_id == asset_id)
            .order_by(MaintenanceRequest.created_at.desc())
        ).all()

        maint_user_ids = {m.requested_by_user_id for m in maint_requests}
        maint_user_map: dict[UUID, str] = {}
        if maint_user_ids:
            maint_users = db.scalars(
                select(User).where(User.id.in_(maint_user_ids))
            ).all()
            maint_user_map = {u.id: u.full_name for u in maint_users}

        maintenance_history = [
            MaintenanceHistoryItem(
                id=m.id,
                requested_by_user_id=m.requested_by_user_id,
                requested_by_name=maint_user_map.get(m.requested_by_user_id),
                priority=m.priority.value if hasattr(m.priority, "value") else str(m.priority),
                issue_description=m.issue_description,
                resolution_notes=m.resolution_notes,
                status=m.status.value if hasattr(m.status, "value") else str(m.status),
                created_at=m.created_at,
                updated_at=m.updated_at,
            )
            for m in maint_requests
        ]

        base = _build_asset_response(
            asset,
            include_cost=include_cost,
            category_name=cat_name,
            department_name=dept_name,
        )

        return AssetDetailResponse(
            **base.model_dump(),
            allocation_history=allocation_history,
            maintenance_history=maintenance_history,
        )
    finally:
        db.close()


# ── 4. Status Update (state machine enforced) ──────────────────


@router.patch("/{asset_id}/status", response_model=AssetResponse)
async def update_asset_status(
    asset_id: UUID,
    body: AssetStatusUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN", "ASSET_MANAGER")),
) -> AssetResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        asset = db.get(Asset, asset_id)
        if not asset or not asset.is_active:
            raise HTTPException(status_code=404, detail="Asset not found")

        try:
            new_status = AssetStatus(body.status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{body.status}'",
            )

        current = asset.current_status
        if new_status == current:
            return _build_asset_response(asset, include_cost=True)

        allowed = ASSET_STATUS_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Invalid transition: {current.value} -> {new_status.value}. "
                    f"Allowed: {[s.value for s in sorted(allowed, key=lambda s: s.value)]}"
                ),
            )

        asset.current_status = new_status
        db.commit()
        db.refresh(asset)
        return _build_asset_response(asset, include_cost=True)
    finally:
        db.close()

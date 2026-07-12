"""Employee directory & role management — Admin only."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func

from ..dependencies import get_current_active_user, require_role
from ..models import User, Department, MaintenanceRequest, MaintenanceStatus, UserRole, Allocation, AllocationStatus
from ..schemas.org import EmployeeResponse, RoleUpdate, EmployeeStatusUpdate

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _build_response(user: User) -> EmployeeResponse:
    return EmployeeResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        department_id=user.department_id,
        department_name=user.department.name if user.department else None,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        users = db.scalars(select(User).order_by(User.full_name)).all()
        return [_build_response(u) for u in users]
    finally:
        db.close()


@router.put("/{user_id}/role", response_model=EmployeeResponse)
async def update_role(
    user_id: UUID,
    body: RoleUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        if str(user_id) == str(current_user["id"]):
            raise HTTPException(400, "Cannot change your own role via this endpoint")

        user = db.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")

        old_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        new_role = body.role

        # EC3: Block demotion if user has pending maintenance approvals
        if old_role in ("ADMIN", "ASSET_MANAGER") and new_role not in ("ADMIN", "ASSET_MANAGER"):
            pending_count = db.scalar(
                select(func.count(MaintenanceRequest.id)).where(
                    MaintenanceRequest.approved_by_user_id == user_id,
                    MaintenanceRequest.status.in_([
                        MaintenanceStatus.PENDING,
                        MaintenanceStatus.APPROVED,
                        MaintenanceStatus.IN_PROGRESS,
                    ]),
                )
            )
            if pending_count and pending_count > 0:
                raise HTTPException(
                    409,
                    f"Cannot demote: user has {pending_count} pending maintenance approval(s). "
                    f"Reassign or complete them first.",
                )

        # EC2: Block demotion from DEPARTMENT_HEAD if still assigned as head
        if old_role == "DEPARTMENT_HEAD" and new_role != "DEPARTMENT_HEAD":
            dept_as_head = db.scalar(
                select(Department).where(
                    Department.head_user_id == user_id,
                    Department.is_active == True,
                )
            )
            if dept_as_head:
                raise HTTPException(
                    409,
                    f"Cannot demote: user is Department Head of '{dept_as_head.name}'. "
                    f"Reassign the head first.",
                )

        user.role = UserRole(new_role)
        db.commit()
        db.refresh(user)
        return _build_response(user)
    finally:
        db.close()


@router.patch("/{user_id}/status", response_model=EmployeeResponse)
async def toggle_user_status(
    user_id: UUID,
    body: EmployeeStatusUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        if str(user_id) == str(current_user["id"]):
            raise HTTPException(400, "Cannot deactivate your own account")

        user = db.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")

        if not body.is_active:
            # Block if user is a Department Head
            dept_as_head = db.scalar(
                select(Department).where(
                    Department.head_user_id == user_id,
                    Department.is_active == True,
                )
            )
            if dept_as_head:
                raise HTTPException(
                    409,
                    f"Cannot deactivate: user is Department Head of '{dept_as_head.name}'. Reassign the head first.",
                )

            # EC3: Block if user has active allocations (zombie prevention)
            active_alloc_count = db.scalar(
                select(func.count(Allocation.id)).where(
                    Allocation.user_id == user_id,
                    Allocation.status == AllocationStatus.ACTIVE,
                )
            )
            if active_alloc_count and active_alloc_count > 0:
                raise HTTPException(
                    409,
                    f"Cannot deactivate: user has {active_alloc_count} active allocation(s). "
                    f"Return or reassign assets first.",
                )

        user.is_active = body.is_active
        db.commit()
        db.refresh(user)
        return _build_response(user)
    finally:
        db.close()

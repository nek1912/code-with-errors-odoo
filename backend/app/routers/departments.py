"""Department management endpoints — Admin only."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_

from ..dependencies import get_current_active_user, require_role
from ..models import Department, Asset, Allocation, AllocationStatus, User
from ..schemas.org import (
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    DepartmentStatusUpdate,
)

router = APIRouter(prefix="/api/departments", tags=["departments"])


def _build_response(dept: Department) -> DepartmentResponse:
    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        head_user_id=dept.head_user_id,
        head_name=dept.head_user.full_name if dept.head_user else None,
        parent_department_id=dept.parent_department_id,
        parent_name=dept.parent_department.name if dept.parent_department else None,
        is_active=dept.is_active,
        created_at=dept.created_at,
    )


async def _check_circular(db, parent_id: UUID | None, exclude_id: UUID | None = None):
    """Walk up the parent chain; raise if we'd form a cycle."""
    if parent_id is None:
        return
    visited = set()
    current = parent_id
    while current:
        if exclude_id and current == exclude_id:
            raise HTTPException(400, "Cannot assign department as its own parent (circular hierarchy)")
        if current in visited:
            raise HTTPException(400, "Circular department hierarchy detected")
        visited.add(current)
        dept = db.get(Department, current)
        if not dept:
            break
        current = dept.parent_department_id


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    current_user: dict[str, Any] = Depends(get_current_active_user),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        stmt = select(Department).order_by(Department.name)
        depts = db.scalars(stmt).all()
        return [_build_response(d) for d in depts]
    finally:
        db.close()


@router.post("", response_model=DepartmentResponse, status_code=201)
async def create_department(
    body: DepartmentCreate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        existing = db.scalar(select(Department).where(Department.name == body.name))
        if existing:
            raise HTTPException(409, f"Department '{body.name}' already exists")

        if body.head_user_id:
            user = db.get(User, body.head_user_id)
            if not user or not user.is_active:
                raise HTTPException(400, "Head user must be an active user")

        await _check_circular(db, body.parent_department_id)

        if body.parent_department_id:
            parent = db.get(Department, body.parent_department_id)
            if not parent:
                raise HTTPException(400, "Parent department not found")

        dept = Department(
            name=body.name,
            head_user_id=body.head_user_id,
            parent_department_id=body.parent_department_id,
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return _build_response(dept)
    finally:
        db.close()


@router.put("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: UUID,
    body: DepartmentUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        dept = db.get(Department, dept_id)
        if not dept:
            raise HTTPException(404, "Department not found")

        if body.name is not None:
            dup = db.scalar(
                select(Department).where(Department.name == body.name, Department.id != dept_id)
            )
            if dup:
                raise HTTPException(409, f"Department '{body.name}' already exists")
            dept.name = body.name

        if body.head_user_id is not None:
            user = db.get(User, body.head_user_id)
            if not user or not user.is_active:
                raise HTTPException(400, "Head user must be an active user")
            dept.head_user_id = body.head_user_id

        if body.parent_department_id is not None:
            await _check_circular(db, body.parent_department_id, exclude_id=dept_id)
            if body.parent_department_id:
                parent = db.get(Department, body.parent_department_id)
                if not parent:
                    raise HTTPException(400, "Parent department not found")
            dept.parent_department_id = body.parent_department_id

        db.commit()
        db.refresh(dept)
        return _build_response(dept)
    finally:
        db.close()


@router.patch("/{dept_id}/status", response_model=DepartmentResponse)
async def toggle_department_status(
    dept_id: UUID,
    body: DepartmentStatusUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        dept = db.get(Department, dept_id)
        if not dept:
            raise HTTPException(404, "Department not found")

        if not body.is_active:
            # Block deactivation if department has active allocations
            active_count = db.scalar(
                select(func.count(Allocation.id)).where(
                    Allocation.department_id == dept_id,
                    Allocation.status == AllocationStatus.ACTIVE,
                )
            )
            if active_count and active_count > 0:
                raise HTTPException(
                    409,
                    f"Cannot deactivate: department has {active_count} active allocation(s)",
                )

        dept.is_active = body.is_active
        db.commit()
        db.refresh(dept)
        return _build_response(dept)
    finally:
        db.close()

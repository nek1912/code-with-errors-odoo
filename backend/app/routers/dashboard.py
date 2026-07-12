"""
Dashboard overview endpoint.
Provides KPIs, alerts, quick actions, and recent activity feed.
All queries use COUNT(*) aggregation — no fetching full tables.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, and_, or_, case, select
from sqlalchemy.orm import Session

from ..dependencies import get_current_active_user
from ..models import (
    Asset,
    Allocation,
    Booking,
    AssetStatus,
    AllocationStatus,
    BookingStatus,
    UserRole,
    ActivityLog,
    User,
    MaintenanceRequest,
    MaintenanceStatus,
)
from ..schemas.dashboard import (
    DashboardOverview,
    KpiCard,
    AlertBanner,
    QuickActions,
    ActivityItem,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _get_asset_filters(user: dict[str, Any]) -> list:
    """Build WHERE clauses for assets based on user role."""
    role = user.get("role", "EMPLOYEE")
    dept_id = user.get("department_id")
    user_id = user.get("id")

    if role == UserRole.ADMIN or role == "ADMIN":
        return []

    if role == UserRole.ASSET_MANAGER or role == "ASSET_MANAGER":
        return []

    if role == UserRole.DEPARTMENT_HEAD or role == "DEPARTMENT_HEAD":
        if dept_id:
            return [Asset.department_id == UUID(str(dept_id))]
        return [Asset.id == UUID("00000000-0000-0000-0000-000000000000")]

    # EMPLOYEE — only shared assets or assets in their department
    if dept_id:
        return [
            or_(
                Asset.is_shared == True,
                Asset.department_id == UUID(str(dept_id)),
            )
        ]
    return [Asset.is_shared == True]


def _get_allocation_filters(user: dict[str, Any]) -> list:
    """Build WHERE clauses for allocations based on user role."""
    role = user.get("role", "EMPLOYEE")
    dept_id = user.get("department_id")
    user_id = user.get("id")

    if role == UserRole.ADMIN or role == "ADMIN":
        return []
    if role == UserRole.ASSET_MANAGER or role == "ASSET_MANAGER":
        return []
    if role == UserRole.DEPARTMENT_HEAD or role == "DEPARTMENT_HEAD":
        if dept_id:
            return [Allocation.department_id == UUID(str(dept_id))]
        return [Allocation.id == UUID("00000000-0000-0000-0000-000000000000")]
    # EMPLOYEE — own allocations only
    if user_id:
        return [Allocation.user_id == UUID(str(user_id))]
    return [Allocation.id == UUID("00000000-0000-0000-0000-000000000000")]


def _get_booking_filters(user: dict[str, Any]) -> list:
    """Build WHERE clauses for bookings based on user role."""
    role = user.get("role", "EMPLOYEE")
    user_id = user.get("id")

    if role == UserRole.ADMIN or role == "ADMIN":
        return []
    if role == UserRole.ASSET_MANAGER or role == "ASSET_MANAGER":
        return []
    # DEPARTMENT_HEAD and EMPLOYEE — own bookings only
    if user_id:
        return [Booking.user_id == UUID(str(user_id))]
    return [Booking.id == UUID("00000000-0000-0000-0000-000000000000")]


@router.get("/overview", response_model=DashboardOverview)
async def get_dashboard_overview(
    current_user: dict[str, Any] = Depends(get_current_active_user),
    db: Session = Depends(lambda: None),  # Placeholder — replaced below
) -> DashboardOverview:
    """Return the full dashboard overview for the current user."""
    from ..database import SessionLocal

    session = SessionLocal()
    try:
        return _build_overview(session, current_user)
    finally:
        session.close()


def _build_overview(
    db: Session, user: dict[str, Any]
) -> DashboardOverview:
    """Core logic: build the dashboard overview response."""
    role = user.get("role", "EMPLOYEE")
    dept_id = user.get("department_id")
    user_id = user.get("id")

    asset_filters = _get_asset_filters(user)
    alloc_filters = _get_allocation_filters(user)
    booking_filters = _get_booking_filters(user)
    now = datetime.now(timezone.utc)

    # ── KPI 1: Assets Available ──────────────────────────────────
    q_available = select(func.count(Asset.id)).where(
        Asset.current_status == AssetStatus.AVAILABLE
    )
    for f in asset_filters:
        q_available = q_available.where(f)

    # ── KPI 2: Assets Allocated ──────────────────────────────────
    q_allocated = select(func.count(Asset.id)).where(
        Asset.current_status == AssetStatus.ALLOCATED
    )
    for f in asset_filters:
        q_allocated = q_allocated.where(f)

    # ── KPI 3: Maintenance Today ─────────────────────────────────
    q_maintenance = select(func.count(MaintenanceRequest.id)).where(
        MaintenanceRequest.status.in_([
            MaintenanceStatus.APPROVED,
            MaintenanceStatus.TECHNICIAN_ASSIGNED,
            MaintenanceStatus.IN_PROGRESS
        ])
    )
    if role in ("ADMIN", "ASSET_MANAGER"):
        pass
    elif role == "DEPARTMENT_HEAD" and dept_id:
        q_maintenance = q_maintenance.join(Asset).where(Asset.department_id == UUID(str(dept_id)))
    elif user_id:
        q_maintenance = q_maintenance.where(MaintenanceRequest.requested_by_user_id == UUID(str(user_id)))

    # ── KPI 4: Active Bookings ───────────────────────────────────
    q_active_bookings = select(func.count(Booking.id)).where(
        Booking.status == BookingStatus.ONGOING
    )
    for f in booking_filters:
        q_active_bookings = q_active_bookings.where(f)

    # ── KPI 5: Pending Transfers ─────────────────────────────────
    q_pending = select(func.count(Allocation.id)).where(
        Allocation.status == AllocationStatus.TRANSFERRED
    )
    for f in alloc_filters:
        q_pending = q_pending.where(f)

    # ── KPI 6: Upcoming Returns ──────────────────────────────────
    q_returns = select(func.count(Allocation.id)).where(
        and_(
            Allocation.status == AllocationStatus.ACTIVE,
            Allocation.expected_return_date.isnot(None),
            Allocation.expected_return_date > now,
            Allocation.expected_return_date <= now.replace(
                hour=23, minute=59, second=59
            ) + __import__("datetime").timedelta(days=7),
        )
    )
    for f in alloc_filters:
        q_returns = q_returns.where(f)

    # ── Alert: Overdue Assets ────────────────────────────────────
    q_overdue = select(func.count(Allocation.id)).where(
        and_(
            Allocation.status == AllocationStatus.ACTIVE,
            Allocation.expected_return_date.isnot(None),
            Allocation.expected_return_date < now,
        )
    )
    for f in alloc_filters:
        q_overdue = q_overdue.where(f)

    # ── Combined Execution in 1 Roundtrip ────────────────────────
    q_combined = select(
        q_available.scalar_subquery(),
        q_allocated.scalar_subquery(),
        q_maintenance.scalar_subquery(),
        q_active_bookings.scalar_subquery(),
        q_pending.scalar_subquery(),
        q_returns.scalar_subquery(),
        q_overdue.scalar_subquery(),
    )
    counts = db.execute(q_combined).fetchone()
    if counts:
        (
            assets_available,
            assets_allocated,
            maintenance_today,
            active_bookings,
            pending_transfers,
            upcoming_returns,
            overdue_count,
        ) = counts
    else:
        assets_available = assets_allocated = maintenance_today = active_bookings = pending_transfers = upcoming_returns = overdue_count = 0

    alert = None
    if overdue_count > 0:
        alert = AlertBanner(
            count=overdue_count,
            message=f"{overdue_count} asset{'s' if overdue_count != 1 else ''} overdue for return - flagged for follow-up",
        )

    # ── Quick Actions ────────────────────────────────────────────
    quick_actions = QuickActions(
        can_register_asset=role in ("ADMIN", "ASSET_MANAGER"),
        can_book_resource=True,
        can_raise_request=True,
    )

    # ── Recent Activity ──────────────────────────────────────────
    q_activity = (
        select(
            ActivityLog.id,
            ActivityLog.action_type,
            ActivityLog.entity_type,
            ActivityLog.entity_id,
            ActivityLog.details,
            ActivityLog.created_at,
            User.full_name.label("user_name"),
        )
        .outerjoin(User, ActivityLog.user_id == User.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
    )
    activity_rows = db.execute(q_activity).all()

    recent_activity = []
    for row in activity_rows:
        details = row.details or {}
        entity_name = details.get("asset_name") or details.get("name") or str(row.entity_id or "")
        recent_activity.append(
            ActivityItem(
                id=row.id,
                entity_name=entity_name,
                action_type=row.action_type,
                entity_type=row.entity_type,
                user_name=row.user_name,
                timestamp=row.created_at,
                details=details,
            )
        )

    # ── Assemble Response ────────────────────────────────────────
    kpis = [
        KpiCard(value=assets_available, label="Assets Available"),
        KpiCard(value=assets_allocated, label="Assets Allocated"),
        KpiCard(value=maintenance_today, label="Maintenance Today"),
        KpiCard(value=active_bookings, label="Active Bookings"),
        KpiCard(value=pending_transfers, label="Pending Transfers"),
        KpiCard(value=upcoming_returns, label="Upcoming Returns"),
    ]

    return DashboardOverview(
        kpis=kpis,
        alert=alert,
        quick_actions=quick_actions,
        recent_activity=recent_activity,
    )

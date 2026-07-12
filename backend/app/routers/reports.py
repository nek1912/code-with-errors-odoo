"""Reports & Analytics endpoint — Single optimized aggregation endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text, and_

from ..dependencies import get_current_active_user
from ..models import (
    Allocation,
    AllocationStatus,
    Asset,
    AssetCategory,
    AssetStatus,
    Booking,
    BookingStatus,
    Department,
    MaintenanceRequest,
    MaintenanceStatus,
)
from ..schemas.reports import ReportsOverview

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _safe_div(n: int, d: int) -> float:
    """Safe division that returns 0.0 if denominator is zero."""
    return n / d if d else 0.0


@router.get("/overview", response_model=ReportsOverview)
async def get_reports_overview(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ReportsOverview:
    """
    Single optimized endpoint for all report data.

    All aggregations use SQL GROUP BY — no Python loops for math.
    Role filtering: DEPARTMENT_HEAD sees only their department.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        role = current_user.get("role", "EMPLOYEE")
        user_dept_id = current_user.get("department_id")
        is_dept_filtered = role == "DEPARTMENT_HEAD" and user_dept_id

        # ── 1. Utilization by Department ─────────────────────────
        # Count of ACTIVE allocations grouped by department
        alloc_stmt = (
            select(
                Department.name.label("dept_name"),
                func.count(Allocation.id).label("count"),
            )
            .join(Department, Department.id == Allocation.department_id)
            .where(Allocation.status == AllocationStatus.ACTIVE)
            .group_by(Department.name)
            .order_by(func.count(Allocation.id).desc())
        )

        if is_dept_filtered:
            alloc_stmt = alloc_stmt.where(
                Allocation.department_id == user_dept_id
            )

        utilization_rows = db.execute(alloc_stmt).all()
        utilization_by_dept = [
            {"dept_name": r.dept_name, "count": r.count}
            for r in utilization_rows
        ]

        # ── 2. Maintenance Frequency (last 6 months) ────────────
        six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)

        maint_stmt = (
            select(
                func.to_char(
                    func.date_trunc("month", MaintenanceRequest.created_at),
                    "Mon YYYY",
                ).label("month"),
                func.count(MaintenanceRequest.id).label("count"),
            )
            .where(MaintenanceRequest.created_at >= six_months_ago)
            .group_by(func.date_trunc("month", MaintenanceRequest.created_at))
            .order_by(func.date_trunc("month", MaintenanceRequest.created_at))
        )

        maint_rows = db.execute(maint_stmt).all()
        maintenance_frequency = [
            {"month": r.month, "count": r.count}
            for r in maint_rows
        ]

        # ── 3. Most Used Assets (top 5 by booking count) ────────
        most_used_stmt = (
            select(
                Asset.asset_tag.label("asset_tag"),
                Asset.name.label("name"),
                func.count(Booking.id).label("booking_count"),
            )
            .join(Booking, Booking.asset_id == Asset.id)
            .where(Booking.status != BookingStatus.CANCELLED)
            .group_by(Asset.asset_tag, Asset.name)
            .order_by(func.count(Booking.id).desc())
            .limit(5)
        )

        most_used_rows = db.execute(most_used_stmt).all()
        most_used_assets = [
            {
                "asset_tag": r.asset_tag,
                "name": r.name,
                "booking_count": r.booking_count,
            }
            for r in most_used_rows
        ]

        # ── 4. Idle Assets (AVAILABLE, no activity in 60 days) ──
        # Edge Case 2: Exclude UNDER_MAINTENANCE, LOST, RETIRED, DISPOSED
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=60)

        # Find assets with no allocation activity in last 60 days
        allocated_asset_ids = (
            select(Allocation.asset_id)
            .where(
                Allocation.allocated_at >= cutoff_date,
                Allocation.status.in_([
                    AllocationStatus.ACTIVE,
                    AllocationStatus.OVERDUE,
                ]),
            )
            .distinct()
        )

        booked_asset_ids = (
            select(Booking.asset_id)
            .where(
                Booking.created_at >= cutoff_date,
                Booking.status != BookingStatus.CANCELLED,
            )
            .distinct()
        )

        idle_stmt = (
            select(
                Asset.asset_tag.label("asset_tag"),
                Asset.name.label("name"),
                func.extract(
                    "day", func.now() - func.coalesce(Asset.updated_at, Asset.created_at)
                ).label("days_idle"),
            )
            .where(
                Asset.current_status == AssetStatus.AVAILABLE,
                Asset.is_active == True,  # noqa: E712
                Asset.id.notin_(allocated_asset_ids),
                Asset.id.notin_(booked_asset_ids),
            )
            .order_by(
                func.extract(
                    "day", func.now() - func.coalesce(Asset.updated_at, Asset.created_at)
                ).desc()
            )
            .limit(10)
        )

        idle_rows = db.execute(idle_stmt).all()
        idle_assets = [
            {
                "asset_tag": r.asset_tag,
                "name": r.name,
                "days_idle": int(r.days_idle or 0),
            }
            for r in idle_rows
        ]

        # ── 5. Retirement Alerts ────────────────────────────────
        # Edge Case 6: Use category.expected_lifespan_years, not hardcoded
        retirement_stmt = (
            select(
                Asset.asset_tag.label("asset_tag"),
                Asset.name.label("name"),
                Asset.acquisition_date.label("acq_date"),
                AssetCategory.expected_lifespan_years.label("lifespan"),
                AssetCategory.name.label("cat_name"),
            )
            .outerjoin(AssetCategory, Asset.category_id == AssetCategory.id)
            .where(
                Asset.is_active == True,  # noqa: E712
                Asset.acquisition_date.isnot(None),
                Asset.current_status.notin_([
                    AssetStatus.RETIRED,
                    AssetStatus.DISPOSED,
                ]),
            )
        )

        if is_dept_filtered:
            retirement_stmt = retirement_stmt.where(
                Asset.department_id == user_dept_id
            )

        retirement_rows = db.execute(retirement_stmt).all()
        retirement_alerts = []

        now = datetime.now(timezone.utc)
        for r in retirement_rows:
            if not r.acq_date:
                continue

            age_days = (now - r.acq_date).days
            age_years = age_days / 365.25

            if r.lifespan and age_years >= r.lifespan:
                retirement_alerts.append({
                    "asset_tag": r.asset_tag,
                    "name": r.name,
                    "reason": f"{r.cat_name or 'Asset'}: {int(age_years)} years old; past expected lifespan ({r.lifespan} years)",
                })
            elif r.lifespan and age_years >= r.lifespan * 0.85:
                remaining = int(r.lifespan - age_years)
                retirement_alerts.append({
                    "asset_tag": r.asset_tag,
                    "name": r.name,
                    "reason": f"{r.cat_name or 'Asset'}: service due in {remaining} year{'s' if remaining != 1 else ''}",
                })

        # Sort by urgency (oldest first)
        retirement_alerts.sort(
            key=lambda x: x.get("reason", ""), reverse=True
        )

        return ReportsOverview(
            utilization_by_dept=utilization_by_dept,
            maintenance_frequency=maintenance_frequency,
            most_used_assets=most_used_assets,
            idle_assets=idle_assets,
            retirement_alerts=retirement_alerts[:10],
        )
    finally:
        db.close()

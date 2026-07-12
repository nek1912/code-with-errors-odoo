"""Booking endpoints — Create, list, update, cancel with overlap validation."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select, text

from ..dependencies import get_current_active_user, require_role
from ..models import (
    Asset,
    AssetStatus,
    Booking,
    BookingStatus,
    Department,
    NotificationType,
    User,
)
from ..schemas.resources import (
    BookableResourceResponse,
    BookingCreateRequest,
    BookingDetailResponse,
    BookingResponse,
    BookingUpdateRequest,
)
from ..services.notifications import create_notification

router = APIRouter(prefix="/api", tags=["bookings"])


# ── 1. Bookable Resources List ──────────────────────────────────


@router.get("/resources/bookable", response_model=list[BookableResourceResponse])
async def list_bookable_resources(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[BookableResourceResponse]:
    """Return assets where is_shared=TRUE and status is not terminal."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        stmt = select(Asset).where(
            Asset.is_shared == True,  # noqa: E712
            Asset.is_active == True,  # noqa: E712
            Asset.current_status.notin_(
                [AssetStatus.LOST, AssetStatus.DISPOSED, AssetStatus.RETIRED]
            ),
        )
        assets = db.scalars(stmt).all()
        return [
            BookableResourceResponse(
                id=a.id,
                asset_tag=a.asset_tag,
                name=a.name,
                location=a.location,
                current_status=a.current_status.value,
            )
            for a in assets
        ]
    finally:
        db.close()


# ── 2. Get Bookings for Resource/Date ───────────────────────────


@router.get("/bookings", response_model=list[BookingDetailResponse])
async def list_bookings(
    resource_id: UUID = Query(..., description="Asset ID"),
    booking_date: date = Query(..., alias="date", description="YYYY-MM-DD"),
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> list[BookingDetailResponse]:
    """Return all bookings for a resource on a given date."""
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Build date range boundaries (full day in UTC)
        day_start = datetime.combine(booking_date, datetime.min.time()).replace(
            tzinfo=timezone.utc
        )
        day_end = datetime.combine(booking_date, datetime.max.time()).replace(
            tzinfo=timezone.utc
        )

        # Query bookings that overlap with the requested day
        # Overlap condition: existing.start < day_end AND existing.end > day_start
        stmt = select(Booking).where(
            Booking.asset_id == resource_id,
            Booking.status != BookingStatus.CANCELLED,
            Booking.start_time < day_end,
            Booking.end_time > day_start,
        )
        bookings = db.scalars(stmt).all()

        # Resolve user names and department names
        user_ids = {b.user_id for b in bookings}
        user_map: dict[UUID, str] = {}
        dept_map: dict[UUID, str] = {}
        if user_ids:
            users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
            user_map = {u.id: u.full_name for u in users}
            dept_ids = {u.department_id for u in users if u.department_id}
            if dept_ids:
                depts = db.scalars(
                    select(Department).where(Department.id.in_(dept_ids))
                ).all()
                dept_map = {d.id: d.name for d in depts}

        # Resolve asset info
        asset = db.get(Asset, resource_id)
        asset_name = asset.name if asset else None
        asset_tag = asset.asset_tag if asset else None

        return [
            BookingDetailResponse(
                id=b.id,
                asset_id=b.asset_id,
                user_id=b.user_id,
                title=b.title,
                start_time=b.start_time,
                end_time=b.end_time,
                status=b.status.value if hasattr(b.status, "value") else str(b.status),
                created_at=b.created_at,
                user_name=user_map.get(b.user_id),
                department_name=dept_map.get(
                    _get_user_dept(db, b.user_id) if b.user_id else None
                ),
                asset_name=asset_name,
                asset_tag=asset_tag,
            )
            for b in bookings
        ]
    finally:
        db.close()


def _get_user_dept(db: Any, user_id: UUID) -> UUID | None:
    """Helper to fetch a user's department_id."""
    user = db.get(User, user_id)
    return user.department_id if user else None


# ── 3. Create Booking (Critical Endpoint) ───────────────────────


@router.post(
    "/bookings",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_booking(
    body: BookingCreateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> BookingResponse:
    """
    Create a new booking with strict overlap validation.

    Validations:
    1. Resource must be is_shared=TRUE
    2. start_time must be >= NOW()
    3. No overlapping bookings (new.start < existing.end AND new.end > existing.start)
    4. Wrapped in a transaction with row-level lock for concurrency safety
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        # Validation 1: Fetch asset with row lock (SELECT ... FOR UPDATE)
        asset = db.execute(
            select(Asset)
            .where(Asset.id == body.asset_id)
            .with_for_update()
        ).scalar_one_or_none()

        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        if not asset.is_shared:
            raise HTTPException(
                status_code=400,
                detail="Asset is not a shared/bookable resource",
            )

        if asset.current_status in (AssetStatus.LOST, AssetStatus.DISPOSED, AssetStatus.RETIRED):
            raise HTTPException(
                status_code=409,
                detail=f"Asset is not available (status: {asset.current_status.value})",
            )

        # Validation 2: start_time >= NOW()
        now = datetime.now(timezone.utc)
        if body.start_time < now:
            raise HTTPException(
                status_code=422,
                detail="start_time must be in the future",
            )

        # Validation 3: end_time > start_time
        if body.end_time <= body.start_time:
            raise HTTPException(
                status_code=422,
                detail="end_time must be after start_time",
            )

        # Validation 4: Overlap check (mathematically correct)
        # Two ranges [A, B) and [C, D) overlap iff A < D AND C < B
        existing = db.scalars(
            select(Booking).where(
                Booking.asset_id == body.asset_id,
                Booking.status != BookingStatus.CANCELLED,
                Booking.start_time < body.end_time,
                Booking.end_time > body.start_time,
            )
        ).all()

        if existing:
            conflict = existing[0]
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Time slot overlaps with an existing booking "
                    f"({conflict.start_time.strftime('%H:%M')} - "
                    f"{conflict.end_time.strftime('%H:%M')})"
                ),
            )

        # Create the booking
        booking = Booking(
            asset_id=body.asset_id,
            user_id=UUID(current_user["id"]),
            title=body.title,
            start_time=body.start_time,
            end_time=body.end_time,
            status=BookingStatus.UPCOMING,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)

        # Create notification for the user
        create_notification(
            db,
            user_id=UUID(current_user["id"]),
            notification_type=NotificationType.BOOKING_CONFIRMED,
            title="Booking Confirmed",
            message=f"Booking for {asset.asset_tag} confirmed",
        )
        db.commit()

        return BookingResponse.model_validate(booking)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── 4. Cancel/Reschedule Booking ────────────────────────────────


@router.patch(
    "/bookings/{booking_id}",
    response_model=BookingResponse,
)
async def update_booking(
    booking_id: UUID,
    body: BookingUpdateRequest,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> BookingResponse:
    """
    Update a booking: cancel or reschedule (re-runs overlap validation if times change).

    Users can update their own bookings. Admins/Asset Managers can update any.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        booking = db.get(Booking, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # Authorization check
        user_id = UUID(current_user["id"])
        role = current_user.get("role", "EMPLOYEE")
        is_owner = booking.user_id == user_id
        is_privileged = role in ("ADMIN", "ASSET_MANAGER")

        if not is_owner and not is_privileged:
            raise HTTPException(
                status_code=403,
                detail="You can only update your own bookings",
            )

        # Can't update a cancelled or completed booking
        if booking.status in (BookingStatus.CANCELLED, BookingStatus.COMPLETED):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update a {booking.status.value} booking",
            )

        # Handle status change
        if body.status is not None:
            try:
                new_status = BookingStatus(body.status)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status '{body.status}'",
                )
            booking.status = new_status

        # Handle time reschedule with overlap re-validation
        new_start = body.start_time or booking.start_time
        new_end = body.end_time or booking.end_time

        if body.start_time is not None or body.end_time is not None:
            if new_end <= new_start:
                raise HTTPException(
                    status_code=422,
                    detail="end_time must be after start_time",
                )

            # Re-check overlap (exclude self)
            existing = db.scalars(
                select(Booking).where(
                    Booking.asset_id == booking.asset_id,
                    Booking.id != booking_id,
                    Booking.status != BookingStatus.CANCELLED,
                    Booking.start_time < new_end,
                    Booking.end_time > new_start,
                )
            ).all()

            if existing:
                conflict = existing[0]
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Rescheduled time overlaps with an existing booking "
                        f"({conflict.start_time.strftime('%H:%M')} - "
                        f"{conflict.end_time.strftime('%H:%M')})"
                    ),
                )

            booking.start_time = new_start
            booking.end_time = new_end

        # Handle title update
        if body.title is not None:
            booking.title = body.title

        db.commit()
        db.refresh(booking)

        # Notify on cancellation
        if body.status == "CANCELLED":
            asset = db.get(Asset, booking.asset_id)
            create_notification(
                db,
                user_id=booking.user_id,
                notification_type=NotificationType.BOOKING_CANCELLED,
                title="Booking Cancelled",
                message=f"Booking for {asset.asset_tag if asset else 'resource'} has been cancelled",
            )
            db.commit()

        return BookingResponse.model_validate(booking)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

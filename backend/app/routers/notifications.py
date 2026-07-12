"""Notifications router — Personal, actionable notifications."""
from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text

from ..dependencies import get_current_active_user
from ..models import Notification, NotificationType
from ..schemas.notifications import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    MarkAllReadResponse,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _notif_to_response(n: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=str(n.id),
        title=n.title,
        message=n.message,
        type=n.notification_type.value if hasattr(n.notification_type, "value") else str(n.notification_type),
        is_read=n.is_read,
        created_at=n.created_at,
    )


# ── GET /api/notifications — List current user's notifications ──

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    filter_type: str | None = None,
    unread_only: bool = False,
    page: int = 1,
    limit: int = 20,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> NotificationListResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        user_id = current_user["id"]

        # Base query
        where_clauses = ["n.user_id = :user_id"]
        params: dict[str, Any] = {"user_id": user_id}

        if unread_only:
            where_clauses.append("n.is_read = FALSE")

        if filter_type:
            where_clauses.append("n.notification_type = :filter_type")
            params["filter_type"] = filter_type

        where_sql = " AND ".join(where_clauses)

        # Count
        count_result = db.execute(
            text(f"SELECT COUNT(*) FROM notifications n WHERE {where_sql}"),
            params,
        )
        total = count_result.scalar() or 0

        # Unread count (always for badge)
        unread_result = db.execute(
            text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = FALSE"),
            {"user_id": user_id},
        )
        unread_count = unread_result.scalar() or 0

        # Paginated fetch
        offset = (max(page, 1) - 1) * limit
        rows = db.execute(
            text(
                f"SELECT n.* FROM notifications n "
                f"WHERE {where_sql} "
                f"ORDER BY n.created_at DESC "
                f"LIMIT :limit OFFSET :offset"
            ),
            {**params, "limit": limit, "offset": offset},
        ).mappings().all()

        items = []
        for row in rows:
            ntype = row["notification_type"]
            items.append(NotificationResponse(
                id=str(row["id"]),
                title=row["title"],
                message=row["message"],
                type=ntype if isinstance(ntype, str) else ntype.value if hasattr(ntype, "value") else str(ntype),
                is_read=row["is_read"],
                created_at=row["created_at"],
            ))

        return NotificationListResponse(
            items=items,
            total=total,
            unread_count=unread_count,
        )
    finally:
        db.close()


# ── GET /api/notifications/unread-count — Badge count ──────────

@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> UnreadCountResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        result = db.execute(
            text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = FALSE"),
            {"user_id": current_user["id"]},
        )
        count = result.scalar() or 0
        return UnreadCountResponse(count=count)
    finally:
        db.close()


# ── PATCH /api/notifications/{id}/read — Mark one as read ──────

@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> NotificationResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        notif = db.get(Notification, notification_id)
        if not notif:
            raise HTTPException(status_code=404, detail="Notification not found")

        if str(notif.user_id) != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not your notification")

        notif.is_read = True
        db.commit()
        db.refresh(notif)

        return _notif_to_response(notif)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── POST /api/notifications/mark-all-read — Mark all as read ───

@router.post("/mark-all-read", response_model=MarkAllReadResponse)
async def mark_all_notifications_read(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> MarkAllReadResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        result = db.execute(
            text(
                "UPDATE notifications SET is_read = TRUE "
                "WHERE user_id = :user_id AND is_read = FALSE"
            ),
            {"user_id": current_user["id"]},
        )
        db.commit()
        return MarkAllReadResponse(
            message="All notifications marked as read",
            marked=result.rowcount,
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

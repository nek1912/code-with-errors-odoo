"""Helper functions for creating Notifications and Activity Logs.

These are called by routers to decouple notification/logging logic from
business endpoints.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from ..models import Notification, NotificationType, ActivityLog


def create_notification(
    db,
    *,
    user_id: uuid.UUID | str,
    notification_type: NotificationType | str,
    title: str,
    message: str,
) -> Notification | None:
    """
    Create a notification for a user.

    Edge Case 2 (Ghost Notification): Silently skips if the user is inactive.
    """
    from ..models import User

    uid = uuid.UUID(str(user_id))

    # Edge Case 2: Check if user is active before creating notification
    user = db.get(User, uid)
    if not user or not user.is_active:
        return None

    ntype = (
        notification_type
        if isinstance(notification_type, NotificationType)
        else NotificationType(notification_type)
    )

    notif = Notification(
        id=uuid.uuid4(),
        user_id=uid,
        notification_type=ntype,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notif)
    return notif


def create_activity_log(
    db,
    *,
    user_id: uuid.UUID | str | None,
    action_type: str,
    entity_type: str,
    entity_id: uuid.UUID | str | None = None,
    details: dict[str, Any] | None = None,
) -> ActivityLog:
    """Create an immutable activity log entry."""
    log = ActivityLog(
        id=uuid.uuid4(),
        user_id=uuid.UUID(str(user_id)) if user_id else None,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=uuid.UUID(str(entity_id)) if entity_id else None,
        details=details,
    )
    db.add(log)
    return log

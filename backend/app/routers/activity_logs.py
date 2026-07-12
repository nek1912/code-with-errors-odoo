"""Activity Logs router — Immutable system-wide audit trail. Admin/Manager only."""
from __future__ import annotations

import math
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text

from ..dependencies import get_current_active_user, require_role
from ..models import ActivityLog, User
from ..schemas.notifications import ActivityLogResponse, ActivityLogListResponse

router = APIRouter(
    prefix="/api/activity-logs",
    tags=["activity-logs"],
    dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER"))],
)


# ── GET /api/activity-logs — Paginated system logs ─────────────

@router.get("", response_model=ActivityLogListResponse)
async def list_activity_logs(
    entity_type: str | None = None,
    action_type: str | None = None,
    user_id: str | None = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> ActivityLogListResponse:
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        where_clauses: list[str] = []
        params: dict[str, Any] = {}

        if entity_type:
            where_clauses.append("a.entity_type = :entity_type")
            params["entity_type"] = entity_type

        if action_type:
            where_clauses.append("a.action_type = :action_type")
            params["action_type"] = action_type

        if user_id:
            where_clauses.append("a.user_id = :user_id")
            params["user_id"] = user_id

        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        # Count
        count_result = db.execute(
            text(f"SELECT COUNT(*) FROM activity_logs a{where_sql}"),
            params,
        )
        total = count_result.scalar() or 0

        # Paginated fetch with JOIN for user name
        offset = (max(page, 1) - 1) * limit
        rows = db.execute(
            text(
                f"SELECT a.*, u.full_name AS user_name "
                f"FROM activity_logs a "
                f"LEFT JOIN users u ON u.id = a.user_id "
                f"{where_sql} "
                f"ORDER BY a.created_at DESC "
                f"LIMIT :limit OFFSET :offset"
            ),
            {**params, "limit": limit, "offset": offset},
        ).mappings().all()

        pages = math.ceil(total / limit) if limit else 1

        items = [
            ActivityLogResponse(
                id=str(row["id"]),
                user_id=str(row["user_id"]) if row["user_id"] else None,
                user_name=row.get("user_name"),
                action_type=row["action_type"],
                entity_type=row["entity_type"],
                entity_id=str(row["entity_id"]) if row["entity_id"] else None,
                details=row["details"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

        return ActivityLogListResponse(
            items=items,
            total=total,
            page=max(page, 1),
            limit=limit,
            pages=pages,
        )
    finally:
        db.close()

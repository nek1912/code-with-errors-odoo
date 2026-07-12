"""Activity Log middleware — automatically logs mutating HTTP requests."""
from __future__ import annotations

import json
import uuid
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# Routes that should NOT be logged (auth endpoints, health, etc.)
_EXCLUDED_PREFIXES = (
    "/api/auth/",
    "/health",
    "/api/notifications",   # notifications have their own tracking
    "/api/activity-logs",   # prevent logging reads of logs
    "/docs",
    "/openapi.json",
    "/redoc",
)

# Only log these HTTP methods
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_route_pattern(path: str) -> str:
    """Normalize path params to a readable pattern."""
    parts = path.strip("/").split("/")
    normalized = []
    for part in parts:
        # Treat UUIDs as params
        if len(part) == 36 and part.count("-") == 4:
            normalized.append("{id}")
        elif len(part) > 8 and part.replace("-", "").replace("_", "").isalnum():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/".join(normalized)


def _infer_entity_type(path: str) -> str:
    """Infer entity type from URL path."""
    parts = path.strip("/").split("/")
    # First segment after /api/ is typically the entity
    if len(parts) >= 2 and parts[0] == "api":
        entity = parts[1]
        # Map plural to singular
        entity_map = {
            "assets": "Asset",
            "allocations": "Allocation",
            "transfers": "Transfer",
            "bookings": "Booking",
            "maintenance": "MaintenanceRequest",
            "audits": "AuditCycle",
            "departments": "Department",
            "categories": "AssetCategory",
            "employees": "User",
            "resources": "Asset",
        }
        return entity_map.get(entity, entity.capitalize())
    return "Unknown"


def _infer_action_type(method: str, path: str) -> str:
    """Infer action type from HTTP method and path."""
    method_map = {
        "POST": "CREATE",
        "PUT": "UPDATE",
        "PATCH": "UPDATE",
        "DELETE": "DELETE",
    }
    base_action = method_map.get(method, "UNKNOWN")

    # Check for specific actions in the path
    if "/approve" in path:
        return "APPROVE"
    if "/reject" in path:
        return "REJECT"
    if "/close" in path:
        return "CLOSE"
    if "/return" in path:
        return "RETURN"
    if "/status" in path:
        return "STATUS_CHANGE"
    if "/read" in path or "/mark-all-read" in path:
        return "MARK_READ"

    return base_action


class ActivityLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware that automatically writes to activity_logs for every
    mutating request (POST, PUT, PATCH, DELETE).

    Edge Case: Only logs after a successful response (status >= 200 and < 400).
    Does not log excluded routes (auth, health, etc.).
    Does NOT allow direct API modification of logs — immutability preserved.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Only log successful mutating requests
        if request.method not in _MUTATING_METHODS:
            return response
        if response.status_code >= 400:
            return response

        # Skip excluded routes
        path = request.url.path
        if any(path.startswith(prefix) for prefix in _EXCLUDED_PREFIXES):
            return response

        try:
            # Extract user_id from request state (set by auth dependency)
            # or from the Authorization header
            user_id = None
            if hasattr(request.state, "user_id"):
                user_id = request.state.user_id

            # Try to get user from the request body or path
            entity_type = _infer_entity_type(path)
            action_type = _infer_action_type(request.method, path)

            # Try to extract entity_id from path
            entity_id = None
            parts = path.strip("/").split("/")
            for part in parts:
                if len(part) == 36 and part.count("-") == 4:
                    entity_id = part
                    break

            # Build details
            details = {
                "method": request.method,
                "path": path,
                "status": response.status_code,
            }

            # Write to database (synchronous session)
            from ..database import SessionLocal
            from ..models import ActivityLog

            db = SessionLocal()
            try:
                log = ActivityLog(
                    id=uuid.uuid4(),
                    user_id=uuid.UUID(str(user_id)) if user_id else None,
                    action_type=action_type,
                    entity_type=entity_type,
                    entity_id=uuid.UUID(str(entity_id)) if entity_id else None,
                    details=details,
                )
                db.add(log)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

        except Exception:
            # Never let activity logging break the main request
            pass

        return response

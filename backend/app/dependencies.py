"""
JWT validation and current user dependency for protected routes.
"""
from __future__ import annotations

from typing import Any, Callable, Sequence

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .services.supabase import supabase_auth

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    """Validate JWT token and return the current user profile."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials

    try:
        user_data = await supabase_auth.get_user(token)
        user_id = user_data.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no user ID",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    profile = await supabase_auth.get_user_profile(user_id)
    if not profile:
        meta = user_data.get("user_metadata", {})
        app_meta = user_data.get("app_metadata", {})
        profile = {
            "id": user_id,
            "email": user_data.get("email", ""),
            "full_name": meta.get("full_name", "User"),
            "role": meta.get("role", app_meta.get("role", "EMPLOYEE")),
            "department_id": None,
            "is_active": True,
            "email_confirmed_at": user_data.get("email_confirmed_at"),
            "created_at": user_data.get("created_at"),
        }

    if not profile.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return profile


async def get_current_active_user(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Ensure user is active (extra guard)."""
    if not current_user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    return current_user


def require_role(*allowed_roles: str) -> Callable:
    """Dependency factory: require the user to have one of the given roles.

    Usage:
        @router.post("/assets", dependencies=[Depends(require_role("ADMIN", "ASSET_MANAGER"))])
        async def register_asset(...): ...

        # or as a direct dependency:
        async def foo(user = Depends(require_role("ADMIN"))): ...
    """
    async def _check(
        current_user: dict[str, Any] = Depends(get_current_active_user),
    ) -> dict[str, Any]:
        user_role = current_user.get("role", "")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return current_user

    return _check

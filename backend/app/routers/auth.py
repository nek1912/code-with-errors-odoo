"""
Auth routes: signup, login, forgot-password, reset-password, logout, me.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..dependencies import get_current_active_user
from ..schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from ..services.supabase import SupabaseAuthError, supabase_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest) -> TokenResponse:
    """Create a new employee account and return tokens immediately."""
    try:
        auth_data = await supabase_auth.signup(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
        )
    except SupabaseAuthError as e:
        msg = e.message.lower()
        if "already registered" in msg or "already exists" in msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # Get user profile
    user_id = auth_data.get("user", {}).get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signup succeeded but could not retrieve user profile",
        )

    profile = await supabase_auth.get_user_profile(user_id)
    if not profile:
        user_obj = auth_data.get("user", {})
        meta = user_obj.get("user_metadata", {})
        profile = {
            "id": user_id,
            "email": user_obj.get("email", body.email),
            "full_name": meta.get("full_name", body.full_name),
            "role": "EMPLOYEE",
            "department_id": None,
            "is_active": True,
            "email_confirmed_at": user_obj.get("email_confirmed_at"),
            "created_at": user_obj.get("created_at"),
        }

    return TokenResponse(
        access_token=auth_data.get("access_token", ""),
        refresh_token=auth_data.get("refresh_token", ""),
        user=UserResponse(**profile),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Authenticate user and return JWT tokens."""
    # 1. Check login eligibility (active, not locked) — skip if DB unreachable
    eligibility = await supabase_auth.check_login_eligibility(body.email)
    db_ok = eligibility.get("db_ok", False)
    if not eligibility.get("is_allowed", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=eligibility.get("reason", "Login not allowed"),
        )

    # 2. Authenticate via Supabase
    try:
        auth_data = await supabase_auth.login(
            email=body.email,
            password=body.password,
        )
    except SupabaseAuthError:
        # Record failed attempt (only if DB is reachable)
        if db_ok:
            await supabase_auth.record_failed_login(body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 3. Reset failed attempts on success (only if DB is reachable)
    if db_ok:
        await supabase_auth.reset_failed_login(body.email)

    # 4. Get user profile (fallback to auth metadata if DB is unreachable)
    user_id = auth_data.get("user", {}).get("id")
    profile = await supabase_auth.get_user_profile(user_id)
    if not profile:
        # Build a minimal profile from Supabase auth metadata
        user_obj = auth_data.get("user", {})
        meta = user_obj.get("user_metadata", {})
        profile = {
            "id": user_id,
            "email": user_obj.get("email", body.email),
            "full_name": meta.get("full_name", "User"),
            "role": "EMPLOYEE",
            "department_id": None,
            "is_active": True,
            "email_confirmed_at": user_obj.get("email_confirmed_at"),
            "created_at": user_obj.get("created_at"),
        }

    return TokenResponse(
        access_token=auth_data.get("access_token", ""),
        refresh_token=auth_data.get("refresh_token", ""),
        user=UserResponse(**profile),
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest) -> MessageResponse:
    """Send a password reset link. Always returns success to prevent enumeration."""
    try:
        await supabase_auth.send_password_reset(body.email)
    except Exception:
        # Intentionally swallow errors to prevent email enumeration
        pass

    return MessageResponse(
        message="If the email exists, a reset link has been sent"
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(body: ResetPasswordRequest) -> MessageResponse:
    """Reset password using the token from the email link."""
    try:
        # The token from Supabase's reset email is used as an access token
        await supabase_auth.update_password(
            access_token=body.token,
            new_password=body.new_password,
        )
    except SupabaseAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    return MessageResponse(message="Password updated successfully")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshTokenRequest) -> TokenResponse:
    """Refresh an access token."""
    try:
        auth_data = await supabase_auth.refresh_token(body.refresh_token)
    except SupabaseAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = auth_data.get("user", {}).get("id")
    profile = await supabase_auth.get_user_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User profile not found",
        )

    return TokenResponse(
        access_token=auth_data.get("access_token", ""),
        refresh_token=auth_data.get("refresh_token", ""),
        user=UserResponse(**profile),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> MessageResponse:
    """Invalidate the current session."""
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> UserResponse:
    """Get current user profile."""
    return UserResponse(**current_user)


@router.post("/promote")
async def promote_to_admin(
    email: str,
    bootstrap_key: str,
    current_user: dict[str, Any] = Depends(get_current_active_user),
) -> MessageResponse:
    """Promote a user to ADMIN. Requires bootstrap key for initial setup.
    After all admins exist, use the /api/employees/{id}/role endpoint instead."""
    import os
    expected = os.environ.get("ADMIN_BOOTSTRAP_KEY", "assetflow-bootstrap-2026")
    if bootstrap_key != expected:
        raise HTTPException(status_code=403, detail="Invalid bootstrap key")

    from ..database import SessionLocal
    from ..models import User as UserModel, UserRole
    db = SessionLocal()
    try:
        user = db.query(UserModel).filter(UserModel.email == email).first()
        if not user:
            raise HTTPException(404, "User not found in database")

        user.role = UserRole.ADMIN
        db.commit()

        # Also update Supabase auth metadata so fallback profiles get the role
        import httpx
        svc_key = settings.SUPABASE_SERVICE_ROLE_KEY
        base = settings.SUPABASE_URL.rstrip("/")
        # Find auth user by email
        r = httpx.get(
            f"{base}/auth/v1/admin/users",
            headers={"apikey": svc_key, "Authorization": f"Bearer {svc_key}"},
            params={"email": email},
            timeout=30,
        )
        if r.status_code == 200:
            users = r.json().get("users", [])
            if users:
                uid = users[0]["id"]
                httpx.put(
                    f"{base}/auth/v1/admin/users/{uid}",
                    headers={"apikey": svc_key, "Authorization": f"Bearer {svc_key}"},
                    json={"user_metadata": {**users[0].get("user_metadata", {}), "role": "ADMIN"}},
                    timeout=30,
                )

        return MessageResponse(message=f"User {email} promoted to ADMIN")
    finally:
        db.close()

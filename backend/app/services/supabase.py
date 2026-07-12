"""
Supabase client wrapper for auth operations.
Uses the Supabase REST API directly (no Python SDK dependency).
"""
from __future__ import annotations

import time
from typing import Any, Optional
from urllib.parse import quote

import httpx

from ..config import settings


class SupabaseAuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class SupabaseAuthService:
    """Handles auth operations via Supabase REST API."""

    def __init__(self) -> None:
        self.base_url = settings.SUPABASE_URL.rstrip("/")
        self.anon_key = settings.SUPABASE_ANON_KEY
        self.service_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.auth_url = f"{self.base_url}/auth/v1"
        self.rest_url = f"{self.base_url}/rest/v1"

    def _headers(self, token: str | None = None) -> dict[str, str]:
        h = {
            "apikey": self.anon_key,
            "Content-Type": "application/json",
        }
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h

    def _service_headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }

    # ---- Auth API calls ----

    async def signup(
        self, email: str, password: str, full_name: str
    ) -> dict[str, Any]:
        """Create a new Supabase auth user. Auto-confirms email. Returns tokens."""
        async with httpx.AsyncClient() as client:
            # 1. Create user
            resp = await client.post(
                f"{self.auth_url}/signup",
                headers=self._headers(),
                json={
                    "email": email,
                    "password": password,
                    "data": {"full_name": full_name},
                },
                timeout=30,
            )
            data = resp.json()
            if resp.status_code >= 400:
                msg = data.get("msg", data.get("message", "Signup failed"))
                raise SupabaseAuthError(msg, resp.status_code)

            user_id = data.get("user", {}).get("id") or data.get("id")
            if not user_id:
                raise SupabaseAuthError("Signup succeeded but no user ID returned", 500)

            # 2. Auto-confirm email via admin API
            await self._admin_confirm_email(user_id)

            # 3. Auto-login to return tokens
            try:
                login_data = await self.login(email, password)
                return login_data
            except SupabaseAuthError:
                # If auto-login fails, still return user data without tokens
                return data

    async def _admin_confirm_email(self, user_id: str) -> None:
        """Use service role key to auto-confirm a user's email."""
        async with httpx.AsyncClient() as client:
            await client.put(
                f"{self.auth_url}/admin/users/{user_id}",
                headers=self._service_headers(),
                json={"email_confirm": True},
                timeout=30,
            )

    async def login(self, email: str, password: str) -> dict[str, Any]:
        """Authenticate user via Supabase. Returns tokens."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.auth_url}/token?grant_type=password",
                headers=self._headers(),
                json={"email": email, "password": password},
                timeout=30,
            )
            data = resp.json()
            if resp.status_code >= 400:
                msg = data.get("error_description", data.get("msg", "Invalid credentials"))
                raise SupabaseAuthError(msg, resp.status_code)
            return data

    async def get_user(self, access_token: str) -> dict[str, Any]:
        """Get current user info from Supabase."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.auth_url}/user",
                headers=self._headers(access_token),
                timeout=30,
            )
            data = resp.json()
            if resp.status_code >= 400:
                raise SupabaseAuthError("Invalid or expired token", 401)
            return data

    async def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        """Refresh an access token."""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.auth_url}/token?grant_type=refresh_token",
                headers=self._headers(),
                json={"refresh_token": refresh_token},
                timeout=30,
            )
            data = resp.json()
            if resp.status_code >= 400:
                raise SupabaseAuthError("Invalid refresh token", 401)
            return data

    async def logout(self, access_token: str) -> None:
        """Invalidate the current session."""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.auth_url}/logout",
                headers=self._headers(access_token),
                timeout=30,
            )

    async def send_password_reset(self, email: str) -> None:
        """Send a password reset email."""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.auth_url}/recover",
                headers=self._headers(),
                json={
                    "email": email,
                    "redirect_to": f"{settings.FRONTEND_URL}/reset-password",
                },
                timeout=30,
            )

    async def update_password(self, access_token: str, new_password: str) -> dict[str, Any]:
        """Update user password (requires valid access token from reset flow)."""
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{self.auth_url}/user",
                headers=self._headers(access_token),
                json={"password": new_password},
                timeout=30,
            )
            data = resp.json()
            if resp.status_code >= 400:
                msg = data.get("msg", data.get("message", "Password update failed"))
                raise SupabaseAuthError(msg, resp.status_code)
            return data

    # ---- Database operations (service role) ----

    async def get_user_profile(self, user_id: str) -> dict[str, Any] | None:
        """Get user profile from public.users table."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.rest_url}/users",
                headers={
                    **self._service_headers(),
                    "Prefer": "return=representation",
                },
                params={
                    "id": f"eq.{user_id}",
                    "select": "id,email,full_name,role,department_id,is_active,email_confirmed_at,created_at",
                },
                timeout=30,
            )
            if resp.status_code >= 400:
                return None
            data = resp.json()
            return data[0] if data else None

    async def check_login_eligibility(self, email: str) -> dict[str, Any]:
        """Check login eligibility by querying users table directly.
        
        Returns:
            {"is_allowed": True/False, "reason": "...", "db_ok": True/False}
            db_ok=False means the DB was unreachable — caller should proceed with
            Supabase login anyway.
        """
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.rest_url}/users",
                    headers={
                        **self._service_headers(),
                        "Prefer": "return=representation",
                    },
                    params={
                        "email": f"eq.{email}",
                        "select": "is_active,locked_until",
                    },
                    timeout=10,
                )
            except httpx.RequestError:
                return {"is_allowed": True, "reason": "DB unreachable, proceeding", "db_ok": False}

            if resp.status_code >= 400:
                # DB schema permissions issue — allow login via Supabase auth
                return {"is_allowed": True, "reason": "DB unavailable, proceeding", "db_ok": False}

            rows = resp.json()
            if not rows:
                return {"is_allowed": False, "reason": "Invalid email or password", "db_ok": True}

            user = rows[0]
            if not user.get("is_active"):
                return {"is_allowed": False, "reason": "Account is deactivated. Contact your administrator.", "db_ok": True}

            locked = user.get("locked_until")
            if locked:
                from datetime import datetime, timezone
                try:
                    lt = datetime.fromisoformat(locked.replace("Z", "+00:00"))
                    if lt > datetime.now(timezone.utc):
                        return {"is_allowed": False, "reason": "Account is temporarily locked. Try again later.", "db_ok": True}
                except (ValueError, TypeError):
                    pass

            return {"is_allowed": True, "reason": "Login allowed", "db_ok": True}

    async def record_failed_login(self, email: str) -> None:
        """Call the record_failed_login() PostgreSQL function."""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.rest_url}/rpc/record_failed_login",
                headers=self._service_headers(),
                json={"user_email": email},
                timeout=30,
            )

    async def reset_failed_login(self, email: str) -> None:
        """Call the reset_failed_login() PostgreSQL function."""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.rest_url}/rpc/reset_failed_login",
                headers=self._service_headers(),
                json={"user_email": email},
                timeout=30,
            )


supabase_auth = SupabaseAuthService()

"""Pydantic schemas for Organization Setup: Departments, Categories, Employees."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator
import re


# ── Department ─────────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    head_user_id: Optional[UUID] = None
    parent_department_id: Optional[UUID] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    head_user_id: Optional[UUID] = None
    parent_department_id: Optional[UUID] = None


class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    head_user_id: Optional[UUID] = None
    head_name: Optional[str] = None
    parent_department_id: Optional[UUID] = None
    parent_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class DepartmentStatusUpdate(BaseModel):
    is_active: bool


# ── Category ───────────────────────────────────────────────────
_VALID_VALUE_TYPES = (str, int, float, bool)


def _validate_metadata_schema(v: dict[str, Any] | None) -> dict[str, Any] | None:
    """EC6: Keys must be alphanumeric, values must be string/number/boolean."""
    if v is None:
        return v
    for key, val in v.items():
        if not re.match(r"^[a-zA-Z0-9_]+$", key):
            raise ValueError(
                f"Key '{key}' must be alphanumeric (letters, digits, underscores only)"
            )
        if not isinstance(val, _VALID_VALUE_TYPES):
            raise ValueError(
                f"Key '{key}' has invalid type '{type(val).__name__}'. "
                f"Allowed types: string, number, boolean"
            )
    return v


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    metadata_schema: Optional[dict[str, Any]] = None

    @field_validator("metadata_schema")
    @classmethod
    def validate_jsonb(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        return _validate_metadata_schema(v)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    metadata_schema: Optional[dict[str, Any]] = None

    @field_validator("metadata_schema")
    @classmethod
    def validate_jsonb(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        return _validate_metadata_schema(v)


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    metadata_schema: Optional[dict[str, Any]] = None
    field_count: int = 0
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Employee ───────────────────────────────────────────────────
class EmployeeResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class RoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(ADMIN|ASSET_MANAGER|DEPARTMENT_HEAD|EMPLOYEE)$")


class EmployeeStatusUpdate(BaseModel):
    is_active: bool

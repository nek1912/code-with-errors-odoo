"""Category management endpoints — Admin only."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select

from ..dependencies import get_current_active_user, require_role
from ..models import Asset, AssetCategory
from ..schemas.org import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
)

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _build_response(cat: AssetCategory) -> CategoryResponse:
    schema = cat.metadata_schema or {}
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        metadata_schema=cat.metadata_schema,
        field_count=len(schema),
        is_active=cat.is_active,
        created_at=cat.created_at,
    )


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        cats = db.scalars(select(AssetCategory).order_by(AssetCategory.name)).all()
        return [_build_response(c) for c in cats]
    finally:
        db.close()


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    body: CategoryCreate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        existing = db.scalar(select(AssetCategory).where(AssetCategory.name == body.name))
        if existing:
            raise HTTPException(409, f"Category '{body.name}' already exists")

        cat = AssetCategory(
            name=body.name,
            description=body.description,
            metadata_schema=body.metadata_schema,
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return _build_response(cat)
    finally:
        db.close()


@router.put("/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: UUID,
    body: CategoryUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        cat = db.get(AssetCategory, cat_id)
        if not cat:
            raise HTTPException(404, "Category not found")

        if body.name is not None:
            dup = db.scalar(
                select(AssetCategory).where(
                    AssetCategory.name == body.name, AssetCategory.id != cat_id
                )
            )
            if dup:
                raise HTTPException(409, f"Category '{body.name}' already exists")
            cat.name = body.name

        if body.description is not None:
            cat.description = body.description
        if body.metadata_schema is not None:
            cat.metadata_schema = body.metadata_schema

        db.commit()
        db.refresh(cat)
        return _build_response(cat)
    finally:
        db.close()


class CategoryStatusUpdate(BaseModel):
    is_active: bool


@router.patch("/{cat_id}/status", response_model=CategoryResponse)
async def toggle_category_status(
    cat_id: UUID,
    body: CategoryStatusUpdate,
    current_user: dict[str, Any] = Depends(require_role("ADMIN")),
):
    """Toggle category active status.

    EC4: Prevent deactivation if active assets use this category.
    """
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        cat = db.get(AssetCategory, cat_id)
        if not cat:
            raise HTTPException(404, "Category not found")

        if not body.is_active:
            # EC4: Block deactivation if category has active assets
            active_count = db.scalar(
                select(func.count(Asset.id)).where(
                    Asset.category_id == cat_id,
                    Asset.is_active == True,
                )
            )
            if active_count and active_count > 0:
                raise HTTPException(
                    409,
                    f"Cannot deactivate: {active_count} active asset(s) use this category. "
                    f"Reassign or remove them first.",
                )

        cat.is_active = body.is_active
        db.commit()
        db.refresh(cat)
        return _build_response(cat)
    finally:
        db.close()

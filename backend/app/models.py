from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    event,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    validates,
)


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    DEPARTMENT_HEAD = "DEPARTMENT_HEAD"
    ASSET_MANAGER = "ASSET_MANAGER"
    ADMIN = "ADMIN"


class AssetStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ALLOCATED = "ALLOCATED"
    RESERVED = "RESERVED"
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"
    LOST = "LOST"
    RETIRED = "RETIRED"
    DISPOSED = "DISPOSED"


class AssetCondition(str, enum.Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"


class AllocationStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"
    OVERDUE = "OVERDUE"
    TRANSFERRED = "TRANSFERRED"


class TransferStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class BookingStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class MaintenancePriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class MaintenanceStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    TECHNICIAN_ASSIGNED = "TECHNICIAN_ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class AuditScopeType(str, enum.Enum):
    DEPARTMENT = "DEPARTMENT"
    LOCATION = "LOCATION"
    ALL = "ALL"


class AuditCycleStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class PhysicalStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    MISSING = "MISSING"
    DAMAGED = "DAMAGED"


class NotificationType(str, enum.Enum):
    ASSET_ALLOCATED = "ASSET_ALLOCATED"
    ASSET_RETURNED = "ASSET_RETURNED"
    BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    MAINTENANCE_REQUESTED = "MAINTENANCE_REQUESTED"
    MAINTENANCE_APPROVED = "MAINTENANCE_APPROVED"
    MAINTENANCE_REJECTED = "MAINTENANCE_REJECTED"
    MAINTENANCE_RESOLVED = "MAINTENANCE_RESOLVED"
    AUDIT_ASSIGNED = "AUDIT_ASSIGNED"
    GENERAL = "GENERAL"


# ---------------------------------------------------------------------------
# State Machine Rules (EC4)
# ---------------------------------------------------------------------------

ASSET_STATUS_TRANSITIONS: dict[AssetStatus, set[AssetStatus]] = {
    AssetStatus.AVAILABLE: {
        AssetStatus.ALLOCATED,
        AssetStatus.RESERVED,
        AssetStatus.UNDER_MAINTENANCE,
        AssetStatus.LOST,
    },
    AssetStatus.ALLOCATED: {
        AssetStatus.AVAILABLE,
        AssetStatus.UNDER_MAINTENANCE,
        AssetStatus.LOST,
        AssetStatus.RETIRED,
        AssetStatus.RESERVED,
    },
    AssetStatus.RESERVED: {
        AssetStatus.AVAILABLE,
        AssetStatus.ALLOCATED,
        AssetStatus.UNDER_MAINTENANCE,
        AssetStatus.LOST,
    },
    AssetStatus.UNDER_MAINTENANCE: {
        AssetStatus.AVAILABLE,
        AssetStatus.RETIRED,
        AssetStatus.LOST,
    },
    AssetStatus.LOST: {
        AssetStatus.AVAILABLE,
        AssetStatus.RETIRED,
        AssetStatus.DISPOSED,
    },
    AssetStatus.RETIRED: set(),
    AssetStatus.DISPOSED: set(),
}


# ---------------------------------------------------------------------------
# ORM-level Guards (EC4 + EC5)
# ---------------------------------------------------------------------------

def _reject_hard_delete(mapper: Any, connection: Any, target: Any) -> None:
    """ORM-level guard: prevent accidental DELETE on soft-deleteable entities."""
    raise RuntimeError(
        f"Hard deletes are not allowed on {target.__class__.__name__}. "
        "Use soft-delete (set is_active = FALSE) instead."
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _uuid_fk(target: str, *, nullable: bool = False, ondelete: str = "RESTRICT") -> Mapped[uuid.UUID | None]:
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
    )


def _created_at() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


def _updated_at() -> Mapped[datetime]:
    return mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ---------------------------------------------------------------------------
# Department
# ---------------------------------------------------------------------------

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    head_user_id: Mapped[uuid.UUID | None] = _uuid_fk("users.id", nullable=True, ondelete="SET NULL")
    parent_department_id: Mapped[uuid.UUID | None] = _uuid_fk("departments.id", nullable=True, ondelete="SET NULL")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    head_user: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[head_user_id],
        back_populates="headed_departments",
        uselist=False,
    )
    parent_department: Mapped[Department | None] = relationship(
        "Department",
        remote_side="Department.id",
        back_populates="sub_departments",
        uselist=False,
    )
    sub_departments: Mapped[list[Department]] = relationship(
        "Department",
        back_populates="parent_department",
        uselist=True,
    )
    users: Mapped[list[User]] = relationship("User", back_populates="department", foreign_keys="[User.department_id]")
    assets: Mapped[list[Asset]] = relationship("Asset", back_populates="department")

    __table_args__ = (Index("ix_departments_parent", "parent_department_id"),)


# ---------------------------------------------------------------------------
# User (Employee)
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", create_constraint=True),
        nullable=False,
        default=UserRole.EMPLOYEE,
    )
    department_id: Mapped[uuid.UUID | None] = _uuid_fk("departments.id", nullable=True, ondelete="SET NULL")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    department: Mapped[Department | None] = relationship("Department", back_populates="users", foreign_keys="[User.department_id]")
    headed_departments: Mapped[list[Department]] = relationship(
        "Department",
        foreign_keys=[Department.head_user_id],
        back_populates="head_user",
    )
    allocated_assets: Mapped[list[Allocation]] = relationship("Allocation", back_populates="user")
    bookings: Mapped[list[Booking]] = relationship("Booking", back_populates="user")
    maintenance_requests: Mapped[list[MaintenanceRequest]] = relationship(
        "MaintenanceRequest",
        foreign_keys="MaintenanceRequest.requested_by_user_id",
        back_populates="requested_by",
    )
    approved_maintenance: Mapped[list[MaintenanceRequest]] = relationship(
        "MaintenanceRequest",
        foreign_keys="MaintenanceRequest.approved_by_user_id",
        back_populates="approved_by",
    )
    notifications: Mapped[list[Notification]] = relationship("Notification", back_populates="user")
    activity_logs: Mapped[list[ActivityLog]] = relationship("ActivityLog", back_populates="user")
    audits_performed: Mapped[list[AuditItem]] = relationship("AuditItem", back_populates="auditor")
    created_audit_cycles: Mapped[list[AuditCycle]] = relationship("AuditCycle", back_populates="created_by")

    __table_args__ = (Index("ix_users_department", "department_id"),)


# ---------------------------------------------------------------------------
# AssetCategory
# ---------------------------------------------------------------------------

class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_lifespan_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_schema: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    assets: Mapped[list[Asset]] = relationship("Asset", back_populates="category")


# ---------------------------------------------------------------------------
# Asset
# ---------------------------------------------------------------------------

class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = _uuid_pk()
    asset_tag: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    serial_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[uuid.UUID | None] = _uuid_fk("asset_categories.id", nullable=True, ondelete="SET NULL")
    department_id: Mapped[uuid.UUID | None] = _uuid_fk("departments.id", nullable=True, ondelete="SET NULL")
    acquisition_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acquisition_cost: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    condition: Mapped[AssetCondition] = mapped_column(
        Enum(AssetCondition, name="asset_condition_enum", create_constraint=True),
        nullable=False,
        default=AssetCondition.GOOD,
    )
    condition_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    current_status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, name="asset_status_enum", create_constraint=True),
        nullable=False,
        default=AssetStatus.AVAILABLE,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    category: Mapped[AssetCategory | None] = relationship("AssetCategory", back_populates="assets")
    department: Mapped[Department | None] = relationship("Department", back_populates="assets")
    current_allocation: Mapped[Allocation | None] = relationship(
        "Allocation",
        primaryjoin="and_(Asset.id==Allocation.asset_id, Allocation.status=='ACTIVE')",
        foreign_keys="Allocation.asset_id",
        uselist=False,
        viewonly=True,
    )
    booking_history: Mapped[list[Booking]] = relationship("Booking", back_populates="asset")
    maintenance_requests: Mapped[list[MaintenanceRequest]] = relationship(
        "MaintenanceRequest", back_populates="asset"
    )
    audit_items: Mapped[list[AuditItem]] = relationship("AuditItem", back_populates="asset")

    # -- EC4: ORM-level state machine validation --
    @validates("current_status")
    def _validate_status_transition(self, key: str, value: AssetStatus) -> AssetStatus:
        """Enforce valid lifecycle transitions at the ORM level."""
        if self.current_status is None:
            return value
        if value == self.current_status:
            return value
        allowed = ASSET_STATUS_TRANSITIONS.get(self.current_status, set())
        if value not in allowed:
            raise ValueError(
                f"Invalid asset status transition: "
                f"{self.current_status.value} -> {value.value}. "
                f"Allowed: {[s.value for s in sorted(allowed, key=lambda s: s.value)]}"
            )
        return value

    __table_args__ = (
        Index("ix_assets_category", "category_id"),
        Index("ix_assets_department", "department_id"),
        Index("ix_assets_status", "current_status"),
    )


# ---------------------------------------------------------------------------
# Allocation
# ---------------------------------------------------------------------------

class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    asset_id: Mapped[uuid.UUID] = _uuid_fk("assets.id", ondelete="RESTRICT")
    user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    department_id: Mapped[uuid.UUID | None] = _uuid_fk("departments.id", nullable=True, ondelete="SET NULL")
    allocated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expected_return_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_return_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    condition_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AllocationStatus] = mapped_column(
        Enum(AllocationStatus, name="allocation_status_enum", create_constraint=True),
        nullable=False,
        default=AllocationStatus.ACTIVE,
    )
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    asset: Mapped[Asset] = relationship("Asset", foreign_keys=[asset_id], viewonly=True)
    user: Mapped[User] = relationship("User", back_populates="allocated_assets")
    department: Mapped[Department | None] = relationship("Department")

    __table_args__ = (
        Index("ix_allocations_asset", "asset_id"),
        Index("ix_allocations_user", "user_id"),
        Index("ix_allocations_status", "status"),
        Index("ix_allocations_asset_status", "asset_id", "status"),
    )


# ---------------------------------------------------------------------------
# Booking
# ---------------------------------------------------------------------------

class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = _uuid_pk()
    asset_id: Mapped[uuid.UUID] = _uuid_fk("assets.id", ondelete="RESTRICT")
    user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status_enum", create_constraint=True),
        nullable=False,
        default=BookingStatus.UPCOMING,
    )
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    asset: Mapped[Asset] = relationship("Asset", back_populates="booking_history")
    user: Mapped[User] = relationship("User", back_populates="bookings")

    # -- EC6: ORM-level time range validation --
    @validates("start_time", "end_time")
    def _validate_booking_times(self, key: str, value: datetime) -> datetime:
        """Ensure end_time > start_time (strict, allows boundary touching)."""
        if key == "end_time" and self.start_time is not None and value <= self.start_time:
            raise ValueError(
                f"Booking end_time ({value}) must be strictly after start_time ({self.start_time})."
            )
        return value

    __table_args__ = (
        Index("ix_bookings_asset", "asset_id"),
        Index("ix_bookings_user", "user_id"),
        Index("ix_bookings_time_range", "start_time", "end_time"),
        Index("ix_bookings_asset_time", "asset_id", "start_time", "end_time"),
    )


# ---------------------------------------------------------------------------
# Transfer
# ---------------------------------------------------------------------------

class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[uuid.UUID] = _uuid_pk()
    asset_id: Mapped[uuid.UUID] = _uuid_fk("assets.id", ondelete="RESTRICT")
    from_user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    to_user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TransferStatus] = mapped_column(
        Enum(TransferStatus, name="transfer_status_enum", create_constraint=True),
        nullable=False,
        default=TransferStatus.PENDING,
    )
    requested_by: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    approved_by: Mapped[uuid.UUID | None] = _uuid_fk("users.id", nullable=True, ondelete="SET NULL")
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    asset: Mapped[Asset] = relationship("Asset")
    from_user: Mapped[User] = relationship("User", foreign_keys=[from_user_id])
    to_user: Mapped[User] = relationship("User", foreign_keys=[to_user_id])
    approver: Mapped[User | None] = relationship("User", foreign_keys=[approved_by])

    __table_args__ = (
        Index("ix_transfers_asset", "asset_id"),
        Index("ix_transfers_status", "status"),
        Index("ix_transfers_from_user", "from_user_id"),
        Index("ix_transfers_to_user", "to_user_id"),
    )


# ---------------------------------------------------------------------------
# MaintenanceRequest
# ---------------------------------------------------------------------------

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[uuid.UUID] = _uuid_pk()
    asset_id: Mapped[uuid.UUID] = _uuid_fk("assets.id", ondelete="RESTRICT")
    requested_by_user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    approved_by_user_id: Mapped[uuid.UUID | None] = _uuid_fk("users.id", nullable=True, ondelete="SET NULL")
    assigned_technician_id: Mapped[uuid.UUID | None] = _uuid_fk("users.id", nullable=True, ondelete="SET NULL")
    priority: Mapped[MaintenancePriority] = mapped_column(
        Enum(MaintenancePriority, name="maintenance_priority_enum", create_constraint=True),
        nullable=False,
        default=MaintenancePriority.MEDIUM,
    )
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_asset_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus, name="maintenance_status_enum", create_constraint=True),
        nullable=False,
        default=MaintenanceStatus.PENDING,
    )
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    asset: Mapped[Asset] = relationship("Asset", back_populates="maintenance_requests")
    requested_by: Mapped[User] = relationship(
        "User",
        foreign_keys=[requested_by_user_id],
        back_populates="maintenance_requests",
    )
    approved_by: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[approved_by_user_id],
        back_populates="approved_maintenance",
    )
    assigned_technician: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[assigned_technician_id],
    )

    __table_args__ = (
        Index("ix_maintenance_asset", "asset_id"),
        Index("ix_maintenance_requested_by", "requested_by_user_id"),
        Index("ix_maintenance_status", "status"),
        Index("ix_maintenance_asset_status", "asset_id", "status"),
    )


# ---------------------------------------------------------------------------
# AuditCycle
# ---------------------------------------------------------------------------

class AuditCycle(Base):
    __tablename__ = "audit_cycles"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    scope_type: Mapped[AuditScopeType] = mapped_column(
        Enum(AuditScopeType, name="audit_scope_type_enum", create_constraint=True),
        nullable=False,
    )
    scope_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="RESTRICT")
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AuditCycleStatus] = mapped_column(
        Enum(AuditCycleStatus, name="audit_cycle_status_enum", create_constraint=True),
        nullable=False,
        default=AuditCycleStatus.OPEN,
    )
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    created_by: Mapped[User] = relationship("User", back_populates="created_audit_cycles")
    audit_items: Mapped[list[AuditItem]] = relationship("AuditItem", back_populates="audit_cycle")

    __table_args__ = (Index("ix_audit_cycles_created_by", "created_by_user_id"),)


# ---------------------------------------------------------------------------
# AuditItem
# ---------------------------------------------------------------------------

class AuditItem(Base):
    __tablename__ = "audit_items"

    id: Mapped[uuid.UUID] = _uuid_pk()
    audit_cycle_id: Mapped[uuid.UUID] = _uuid_fk("audit_cycles.id", ondelete="RESTRICT")
    asset_id: Mapped[uuid.UUID] = _uuid_fk("assets.id", ondelete="RESTRICT")
    auditor_user_id: Mapped[uuid.UUID | None] = _uuid_fk("users.id", nullable=True, ondelete="SET NULL")
    physical_status: Mapped[PhysicalStatus] = mapped_column(
        Enum(PhysicalStatus, name="physical_status_enum", create_constraint=True),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    # relationships
    audit_cycle: Mapped[AuditCycle] = relationship("AuditCycle", back_populates="audit_items")
    asset: Mapped[Asset] = relationship("Asset", back_populates="audit_items")
    auditor: Mapped[User] = relationship("User", back_populates="audits_performed")

    __table_args__ = (
        Index("ix_audit_items_cycle", "audit_cycle_id"),
        Index("ix_audit_items_asset", "asset_id"),
        Index("ix_audit_items_auditor", "auditor_user_id"),
    )


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _uuid_fk("users.id", ondelete="CASCADE")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type_enum", create_constraint=True),
        nullable=False,
        default=NotificationType.GENERAL,
    )
    created_at: Mapped[datetime] = _created_at()

    # relationships
    user: Mapped[User] = relationship("User", back_populates="notifications")

    __table_args__ = (Index("ix_notifications_user", "user_id"),)


# ---------------------------------------------------------------------------
# ActivityLog
# ---------------------------------------------------------------------------

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID | None] = _uuid_fk("users.id", nullable=True, ondelete="SET NULL")
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = _created_at()

    # relationships
    user: Mapped[User | None] = relationship("User", back_populates="activity_logs")

    __table_args__ = (
        Index("ix_activity_logs_user", "user_id"),
        Index("ix_activity_logs_entity", "entity_type", "entity_id"),
    )


# ===========================================================================
# ORM-level Event Listeners  (EC2, EC3, EC5)
# ===========================================================================
#
# These provide in-process safety nets. The DB-level triggers in constraints.py
# are the authoritative guardrails. The ORM listeners prevent issues even when
# the application bypasses constraints (e.g. raw SQL, migration scripts).
# ===========================================================================

# -- EC3: Immutable AuditCycle / AuditItem when CLOSED ----------------------

@event.listens_for(AuditCycle, "before_update")
def _audit_cycle_immutable_guard(mapper: Any, connection: Any, target: AuditCycle) -> None:
    """Prevent edits to a CLOSED audit cycle at ORM level."""
    if target.status == AuditCycleStatus.CLOSED:
        raise RuntimeError(
            f"Audit cycle '{target.name}' (id: {target.id}) is CLOSED and cannot be modified."
        )


@event.listens_for(AuditItem, "before_update")
def _audit_item_immutable_guard(mapper: Any, connection: Any, target: AuditItem) -> None:
    """Prevent edits to audit items belonging to a CLOSED cycle at ORM level."""
    if target.audit_cycle and target.audit_cycle.status == AuditCycleStatus.CLOSED:
        raise RuntimeError(
            f"Audit item {target.id} belongs to CLOSED cycle "
            f"'{target.audit_cycle.name}' and cannot be modified."
        )


# -- EC2: Cascading user deactivation -------------------------------------

@event.listens_for(User.is_active, "set")
def _cascade_user_deactivation(
    target: User, value: bool, old_value: Any, initiator: Any
) -> None:
    """
    When User.is_active is set to FALSE within a session, eagerly mark
    their ACTIVE allocations as RETURNED so the unit-of-work picks them up.
    The DB trigger handles the actual UPDATE; this is a session-level hint.
    """
    if old_value is True and value is False and target.id is not None:
        session: Session | None = Session.object_session(target)
        if session is not None:
            active_allocations = (
                session.query(Allocation)
                .filter(
                    Allocation.user_id == target.id,
                    Allocation.status == AllocationStatus.ACTIVE,
                )
                .all()
            )
            for alloc in active_allocations:
                alloc.status = AllocationStatus.RETURNED
                alloc.actual_return_date = datetime.utcnow()


# -- EC2: Cascading asset status changes -----------------------------------

@event.listens_for(Asset, "before_update")
def _cascade_asset_status_changes(
    mapper: Any, connection: Any, target: Asset
) -> None:
    """
    ORM-level cascade when asset status changes.
    The DB trigger handles the authoritative UPDATEs; this marks objects
    dirty so the unit-of-work flushes them correctly.
    """
    status_history = target._sa_instance_state.committed_state.get("current_status")
    if status_history is None or status_history == target.current_status:
        return

    new_status = target.current_status
    old_status = status_history

    # UNDER_MAINTENANCE: cancel future bookings
    if new_status == AssetStatus.UNDER_MAINTENANCE and old_status != AssetStatus.UNDER_MAINTENANCE:
        session = Session.object_session(target)
        if session is not None:
            upcoming = (
                session.query(Booking)
                .filter(
                    Booking.asset_id == target.id,
                    Booking.status.in_([BookingStatus.UPCOMING, BookingStatus.ONGOING]),
                    Booking.start_time > datetime.utcnow(),
                )
                .all()
            )
            for b in upcoming:
                b.status = BookingStatus.CANCELLED

    # Terminal states (LOST, RETIRED, DISPOSED): cancel bookings + return allocation
    if new_status in (AssetStatus.LOST, AssetStatus.RETIRED, AssetStatus.DISPOSED):
        session = Session.object_session(target)
        if session is not None:
            # Cancel future bookings
            future = (
                session.query(Booking)
                .filter(
                    Booking.asset_id == target.id,
                    Booking.status.in_([BookingStatus.UPCOMING, BookingStatus.ONGOING]),
                )
                .all()
            )
            for b in future:
                b.status = BookingStatus.CANCELLED

            # Return active allocation
            active = (
                session.query(Allocation)
                .filter(
                    Allocation.asset_id == target.id,
                    Allocation.status == AllocationStatus.ACTIVE,
                )
                .all()
            )
            for alloc in active:
                alloc.status = AllocationStatus.RETURNED
                alloc.actual_return_date = datetime.utcnow()


# -- EC5: Hard-delete prevention (ORM-level) -------------------------------
#    Mirror the DB triggers as a safety net for code that uses session.delete().

_hard_delete_prevented_classes: list[type] = [
    Department,
    User,
    AssetCategory,
    Asset,
    Allocation,
    Booking,
    Transfer,
    MaintenanceRequest,
    AuditCycle,
    AuditItem,
]

for _cls in _hard_delete_prevented_classes:
    event.listen(_cls, "before_delete", _reject_hard_delete)

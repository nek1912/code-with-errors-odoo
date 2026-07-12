"""
Seed script for AssetFlow — creates realistic demo data for showcase.

Usage:
    cd backend
    python seed_data.py

All user passwords: Demo@1234
"""
from __future__ import annotations

import os
import sys
import uuid
import time
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Load env ────────────────────────────────────────────────────
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
Session = sessionmaker(bind=engine)

DEFAULT_PASSWORD = "Demo@1234"

# ── Supabase helpers ────────────────────────────────────────────

def svc_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

def anon_headers():
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }


def create_supabase_user(email: str, password: str, full_name: str) -> str | None:
    """Create a user via Supabase admin API and auto-confirm. Returns user ID."""
    # Check if user already exists
    r = httpx.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=svc_headers(),
        timeout=30,
    )
    if r.status_code == 200:
        users = r.json().get("users", [])
        for u in users:
            if u.get("email", "").lower() == email.lower():
                print(f"  ⏭  Auth user {email} already exists (id: {u['id'][:8]}…)")
                return u["id"]

    # Create user
    r = httpx.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=svc_headers(),
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
        timeout=30,
    )
    if r.status_code in (200, 201):
        uid = r.json().get("id")
        print(f"  ✅ Created auth user {email} (id: {uid[:8]}…)")
        return uid
    else:
        print(f"  ❌ Failed to create {email}: {r.status_code} {r.text[:200]}")
        return None


def main():
    print("=" * 60)
    print("AssetFlow — Seed Data Script")
    print("=" * 60)

    db = Session()

    try:
        # ── Ensure tables exist ───────────────────────────────────
        from app.models import Base
        Base.metadata.create_all(bind=engine)
        print("\n✅ Database tables verified/created.\n")

        # ── 1. Create Departments ─────────────────────────────────
        print("━━━ Creating Departments ━━━")
        departments_data = [
            {"name": "IT Department", "is_active": True},
            {"name": "Finance", "is_active": True},
            {"name": "Operations", "is_active": True},
            {"name": "HR", "is_active": True},
            {"name": "Administration", "is_active": True},
        ]

        dept_ids = {}
        for d in departments_data:
            existing = db.execute(
                text("SELECT id FROM departments WHERE name = :name"),
                {"name": d["name"]},
            ).first()
            if existing:
                dept_ids[d["name"]] = str(existing[0])
                print(f"  ⏭  Department '{d['name']}' already exists")
            else:
                did = str(uuid.uuid4())
                dept_ids[d["name"]] = did
                db.execute(
                    text("""
                        INSERT INTO departments (id, name, is_active, created_at, updated_at)
                        VALUES (:id, :name, :is_active, NOW(), NOW())
                    """),
                    {"id": did, "name": d["name"], "is_active": d["is_active"]},
                )
                print(f"  ✅ Created department '{d['name']}'")
        db.commit()

        # ── 2. Create Asset Categories ────────────────────────────
        print("\n━━━ Creating Asset Categories ━━━")
        categories_data = [
            {"name": "Electronics", "description": "Laptops, monitors, phones, tablets and other electronic devices", "metadata_schema": {"warranty_period_months": "integer"}},
            {"name": "Furniture", "description": "Desks, chairs, tables, cabinets and other office furniture"},
            {"name": "Vehicles", "description": "Cars, vans, bikes for company transportation"},
            {"name": "Office Equipment", "description": "Projectors, printers, scanners, meeting room gear"},
            {"name": "IT Infrastructure", "description": "Servers, switches, routers, UPS and network equipment"},
        ]

        cat_ids = {}
        for c in categories_data:
            existing = db.execute(
                text("SELECT id FROM asset_categories WHERE name = :name"),
                {"name": c["name"]},
            ).first()
            if existing:
                cat_ids[c["name"]] = str(existing[0])
                print(f"  ⏭  Category '{c['name']}' already exists")
            else:
                import json as _json
                cid = str(uuid.uuid4())
                cat_ids[c["name"]] = cid
                schema_val = _json.dumps(c["metadata_schema"]) if c.get("metadata_schema") else None
                db.execute(
                    text("""
                        INSERT INTO asset_categories (id, name, description, metadata_schema, is_active, created_at, updated_at)
                        VALUES (:id, :name, :desc, CAST(:schema AS jsonb), true, NOW(), NOW())
                    """),
                    {
                        "id": cid,
                        "name": c["name"],
                        "desc": c.get("description"),
                        "schema": schema_val,
                    },
                )
                print(f"  ✅ Created category '{c['name']}'")
        db.commit()

        # ── 3. Create Users ───────────────────────────────────────
        print("\n━━━ Creating Users ━━━")
        users_data = [
            {"email": "admin@assetflow.com", "full_name": "Admin User", "role": "ADMIN", "department": None},
            {"email": "ravi.sharma@assetflow.com", "full_name": "Ravi Sharma", "role": "ASSET_MANAGER", "department": "Operations"},
            {"email": "priya.patel@assetflow.com", "full_name": "Priya Patel", "role": "DEPARTMENT_HEAD", "department": "IT Department"},
            {"email": "ankit.mehta@assetflow.com", "full_name": "Ankit Mehta", "role": "DEPARTMENT_HEAD", "department": "Finance"},
            {"email": "neha.gupta@assetflow.com", "full_name": "Neha Gupta", "role": "EMPLOYEE", "department": "IT Department"},
            {"email": "raj.kumar@assetflow.com", "full_name": "Raj Kumar", "role": "EMPLOYEE", "department": "IT Department"},
            {"email": "simran.kaur@assetflow.com", "full_name": "Simran Kaur", "role": "EMPLOYEE", "department": "Operations"},
            {"email": "vikram.singh@assetflow.com", "full_name": "Vikram Singh", "role": "EMPLOYEE", "department": "Finance"},
            {"email": "pooja.verma@assetflow.com", "full_name": "Pooja Verma", "role": "EMPLOYEE", "department": "HR"},
            {"email": "arjun.reddy@assetflow.com", "full_name": "Arjun Reddy", "role": "EMPLOYEE", "department": "Operations"},
        ]

        user_ids = {}
        for u in users_data:
            # Create in Supabase Auth
            auth_id = create_supabase_user(u["email"], DEFAULT_PASSWORD, u["full_name"])
            if not auth_id:
                print(f"  ⚠️  Skipping DB record for {u['email']} — auth creation failed")
                continue

            user_ids[u["email"]] = auth_id
            dept_id = dept_ids.get(u["department"]) if u["department"] else None

            # Create in local DB
            existing = db.execute(
                text("SELECT id FROM users WHERE id = :id"),
                {"id": auth_id},
            ).first()

            if existing:
                # Update role and department
                db.execute(
                    text("""
                        UPDATE users SET role = :role, department_id = :dept_id, is_active = true, updated_at = NOW()
                        WHERE id = :id
                    """),
                    {"id": auth_id, "role": u["role"], "dept_id": dept_id},
                )
                print(f"  🔄 Updated DB user {u['email']} → {u['role']}")
            else:
                db.execute(
                    text("""
                        INSERT INTO users (id, email, full_name, role, department_id, is_active, created_at, updated_at)
                        VALUES (:id, :email, :full_name, :role, :dept_id, true, NOW(), NOW())
                    """),
                    {
                        "id": auth_id,
                        "email": u["email"],
                        "full_name": u["full_name"],
                        "role": u["role"],
                        "dept_id": dept_id,
                    },
                )
                print(f"  ✅ Created DB user {u['email']} → {u['role']}")
        db.commit()

        # Assign department heads
        print("\n━━━ Assigning Department Heads ━━━")
        head_assignments = [
            ("IT Department", "priya.patel@assetflow.com"),
            ("Finance", "ankit.mehta@assetflow.com"),
        ]
        for dept_name, head_email in head_assignments:
            head_id = user_ids.get(head_email)
            d_id = dept_ids.get(dept_name)
            if head_id and d_id:
                db.execute(
                    text("UPDATE departments SET head_user_id = :head_id, updated_at = NOW() WHERE id = :id"),
                    {"head_id": head_id, "id": d_id},
                )
                print(f"  ✅ {head_email} → Head of {dept_name}")
        db.commit()

        # ── 4. Create Assets ─────────────────────────────────────
        print("\n━━━ Creating Assets ━━━")
        now = datetime.now(timezone.utc)

        assets_data = [
            # Electronics - Laptops
            {"name": "Dell Latitude 5540", "tag": "AF-0001", "serial": "DL5540-2024-001", "category": "Electronics", "dept": "IT Department", "status": "ALLOCATED", "condition": "GOOD", "location": "Floor 2, Desk 14", "cost": 85000.00, "shared": False},
            {"name": "MacBook Pro 14\"", "tag": "AF-0002", "serial": "MBP14-2024-002", "category": "Electronics", "dept": "IT Department", "status": "ALLOCATED", "condition": "EXCELLENT", "location": "Floor 2, Desk 8", "cost": 165000.00, "shared": False},
            {"name": "ThinkPad X1 Carbon", "tag": "AF-0003", "serial": "TPX1C-2024-003", "category": "Electronics", "dept": "Finance", "status": "AVAILABLE", "condition": "GOOD", "location": "IT Store Room", "cost": 120000.00, "shared": False},
            {"name": "HP EliteBook 840", "tag": "AF-0004", "serial": "HPE840-2024-004", "category": "Electronics", "dept": "Operations", "status": "UNDER_MAINTENANCE", "condition": "FAIR", "location": "Maintenance Lab", "cost": 78000.00, "shared": False},
            {"name": "Dell Monitor 27\" 4K", "tag": "AF-0005", "serial": "DLM27-2024-005", "category": "Electronics", "dept": "IT Department", "status": "ALLOCATED", "condition": "GOOD", "location": "Floor 2, Desk 14", "cost": 32000.00, "shared": False},
            # Furniture
            {"name": "Ergonomic Standing Desk", "tag": "AF-0006", "serial": "ESD-2024-006", "category": "Furniture", "dept": "IT Department", "status": "ALLOCATED", "condition": "EXCELLENT", "location": "Floor 2, Desk 14", "cost": 45000.00, "shared": False},
            {"name": "Herman Miller Aeron Chair", "tag": "AF-0007", "serial": "HMA-2024-007", "category": "Furniture", "dept": "Finance", "status": "AVAILABLE", "condition": "GOOD", "location": "Furniture Store", "cost": 95000.00, "shared": False},
            {"name": "Conference Table (12-seater)", "tag": "AF-0008", "serial": "CT12-2024-008", "category": "Furniture", "dept": "Administration", "status": "AVAILABLE", "condition": "EXCELLENT", "location": "Conference Room A", "cost": 120000.00, "shared": False},
            # Vehicles
            {"name": "Toyota Innova Crysta", "tag": "AF-0009", "serial": "TIC-MH12-AB-1234", "category": "Vehicles", "dept": "Operations", "status": "AVAILABLE", "condition": "GOOD", "location": "Parking Lot B", "cost": 1800000.00, "shared": True},
            {"name": "Maruti Suzuki Swift", "tag": "AF-0010", "serial": "MSS-MH12-CD-5678", "category": "Vehicles", "dept": "Operations", "status": "ALLOCATED", "condition": "FAIR", "location": "Field", "cost": 750000.00, "shared": True},
            # Office Equipment (shared/bookable)
            {"name": "Meeting Room Alpha", "tag": "AF-0011", "serial": "MR-ALPHA-001", "category": "Office Equipment", "dept": "Administration", "status": "AVAILABLE", "condition": "EXCELLENT", "location": "Floor 1, Room 101", "cost": 0, "shared": True},
            {"name": "Meeting Room Beta", "tag": "AF-0012", "serial": "MR-BETA-002", "category": "Office Equipment", "dept": "Administration", "status": "AVAILABLE", "condition": "EXCELLENT", "location": "Floor 2, Room 201", "cost": 0, "shared": True},
            {"name": "Meeting Room Gamma", "tag": "AF-0013", "serial": "MR-GAMMA-003", "category": "Office Equipment", "dept": "Administration", "status": "AVAILABLE", "condition": "GOOD", "location": "Floor 3, Room 301", "cost": 0, "shared": True},
            {"name": "Epson Projector EB-X51", "tag": "AF-0014", "serial": "EPX51-2024-014", "category": "Office Equipment", "dept": "Administration", "status": "AVAILABLE", "condition": "GOOD", "location": "AV Store Room", "cost": 55000.00, "shared": True},
            {"name": "Canon ImageRunner Printer", "tag": "AF-0015", "serial": "CIR-2024-015", "category": "Office Equipment", "dept": "Administration", "status": "AVAILABLE", "condition": "GOOD", "location": "Floor 1, Print Area", "cost": 180000.00, "shared": True},
            # IT Infrastructure
            {"name": "Dell PowerEdge R750", "tag": "AF-0016", "serial": "DPE750-2024-016", "category": "IT Infrastructure", "dept": "IT Department", "status": "AVAILABLE", "condition": "EXCELLENT", "location": "Server Room, Rack A3", "cost": 450000.00, "shared": False},
            {"name": "Cisco Catalyst 9300 Switch", "tag": "AF-0017", "serial": "CC9300-2024-017", "category": "IT Infrastructure", "dept": "IT Department", "status": "AVAILABLE", "condition": "GOOD", "location": "Server Room, Rack B1", "cost": 280000.00, "shared": False},
            {"name": "APC Smart-UPS 3000VA", "tag": "AF-0018", "serial": "APC3K-2024-018", "category": "IT Infrastructure", "dept": "IT Department", "status": "AVAILABLE", "condition": "GOOD", "location": "Server Room", "cost": 95000.00, "shared": False},
            # More electronics
            {"name": "iPad Pro 12.9\"", "tag": "AF-0019", "serial": "IPADP-2024-019", "category": "Electronics", "dept": "Operations", "status": "ALLOCATED", "condition": "EXCELLENT", "location": "Field", "cost": 110000.00, "shared": False},
            {"name": "Samsung Galaxy Tab S9", "tag": "AF-0020", "serial": "SGT9-2024-020", "category": "Electronics", "dept": "HR", "status": "AVAILABLE", "condition": "GOOD", "location": "HR Office", "cost": 65000.00, "shared": False},
            {"name": "Logitech Conference Cam", "tag": "AF-0021", "serial": "LCC-2024-021", "category": "Electronics", "dept": "Administration", "status": "AVAILABLE", "condition": "GOOD", "location": "Meeting Room Alpha", "cost": 45000.00, "shared": True},
            {"name": "ThinkPad E14 Gen 5", "tag": "AF-0022", "serial": "TPE14-2024-022", "category": "Electronics", "dept": "HR", "status": "RETIRED", "condition": "POOR", "location": "IT Store Room", "cost": 55000.00, "shared": False},
        ]

        asset_ids = {}
        for a in assets_data:
            existing = db.execute(
                text("SELECT id FROM assets WHERE asset_tag = :tag"),
                {"tag": a["tag"]},
            ).first()
            if existing:
                asset_ids[a["tag"]] = str(existing[0])
                print(f"  ⏭  Asset '{a['tag']}' already exists")
                continue

            aid = str(uuid.uuid4())
            asset_ids[a["tag"]] = aid
            acq_date = now - timedelta(days=int(180 + hash(a["tag"]) % 365))
            db.execute(
                text("""
                    INSERT INTO assets (id, asset_tag, name, serial_number, category_id, department_id,
                        acquisition_date, acquisition_cost, condition, condition_notes, location,
                        is_shared, current_status, is_active, created_at, updated_at)
                    VALUES (:id, :tag, :name, :serial, :cat_id, :dept_id,
                        :acq_date, :cost, :condition, NULL, :location,
                        :shared, :status, true, NOW(), NOW())
                """),
                {
                    "id": aid, "tag": a["tag"], "name": a["name"], "serial": a["serial"],
                    "cat_id": cat_ids.get(a["category"]), "dept_id": dept_ids.get(a["dept"]),
                    "acq_date": acq_date, "cost": a["cost"],
                    "condition": a["condition"], "location": a["location"],
                    "shared": a["shared"], "status": a["status"],
                },
            )
            print(f"  ✅ Created asset {a['tag']} — {a['name']}")
        db.commit()

        # ── 5. Create Allocations ─────────────────────────────────
        print("\n━━━ Creating Allocations ━━━")
        allocations_data = [
            # Active allocations
            {"tag": "AF-0001", "user": "neha.gupta@assetflow.com", "days_ago": 30, "return_in": 60, "status": "ACTIVE"},
            {"tag": "AF-0002", "user": "raj.kumar@assetflow.com", "days_ago": 45, "return_in": 90, "status": "ACTIVE"},
            {"tag": "AF-0005", "user": "neha.gupta@assetflow.com", "days_ago": 30, "return_in": 60, "status": "ACTIVE"},
            {"tag": "AF-0006", "user": "neha.gupta@assetflow.com", "days_ago": 30, "return_in": 180, "status": "ACTIVE"},
            {"tag": "AF-0010", "user": "simran.kaur@assetflow.com", "days_ago": 15, "return_in": 30, "status": "ACTIVE"},
            {"tag": "AF-0019", "user": "arjun.reddy@assetflow.com", "days_ago": 10, "return_in": 20, "status": "ACTIVE"},
            # Overdue allocations (return date in the past)
            {"tag": "AF-0009", "user": "simran.kaur@assetflow.com", "days_ago": 60, "return_in": -5, "status": "ACTIVE"},
            # Returned allocations
            {"tag": "AF-0003", "user": "vikram.singh@assetflow.com", "days_ago": 90, "return_in": -30, "status": "RETURNED", "returned_days_ago": 20},
            {"tag": "AF-0007", "user": "ankit.mehta@assetflow.com", "days_ago": 120, "return_in": -60, "status": "RETURNED", "returned_days_ago": 50},
            {"tag": "AF-0020", "user": "pooja.verma@assetflow.com", "days_ago": 45, "return_in": -10, "status": "RETURNED", "returned_days_ago": 8},
        ]

        alloc_ids = {}
        for al in allocations_data:
            asset_id = asset_ids.get(al["tag"])
            user_id = user_ids.get(al["user"])
            if not asset_id or not user_id:
                print(f"  ⚠️  Skipping allocation for {al['tag']} — missing reference")
                continue

            existing = db.execute(
                text("SELECT id FROM allocations WHERE asset_id = :aid AND user_id = :uid AND status = :status"),
                {"aid": asset_id, "uid": user_id, "status": al["status"]},
            ).first()
            if existing:
                alloc_ids[al["tag"]] = str(existing[0])
                print(f"  ⏭  Allocation {al['tag']} → {al['user'].split('@')[0]} already exists")
                continue

            alloc_id = str(uuid.uuid4())
            alloc_ids[al["tag"]] = alloc_id
            allocated_at = now - timedelta(days=al["days_ago"])
            expected_return = now + timedelta(days=al["return_in"])
            actual_return = (now - timedelta(days=al.get("returned_days_ago", 0))) if al["status"] == "RETURNED" else None

            # Find department_id for the user
            user_dept = db.execute(text("SELECT department_id FROM users WHERE id = :uid"), {"uid": user_id}).first()
            u_dept_id = str(user_dept[0]) if user_dept and user_dept[0] else None

            db.execute(
                text("""
                    INSERT INTO allocations (id, asset_id, user_id, department_id, allocated_at,
                        expected_return_date, actual_return_date, status, created_at, updated_at)
                    VALUES (:id, :asset_id, :user_id, :dept_id, :allocated_at,
                        :expected_return, :actual_return, :status, NOW(), NOW())
                """),
                {
                    "id": alloc_id, "asset_id": asset_id, "user_id": user_id,
                    "dept_id": u_dept_id, "allocated_at": allocated_at,
                    "expected_return": expected_return, "actual_return": actual_return,
                    "status": al["status"],
                },
            )
            print(f"  ✅ Allocation: {al['tag']} → {al['user'].split('@')[0]} ({al['status']})")
        db.commit()

        # ── 6. Create Bookings ────────────────────────────────────
        print("\n━━━ Creating Bookings ━━━")
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        bookings_data = [
            # Upcoming bookings
            {"asset": "AF-0011", "user": "neha.gupta@assetflow.com", "title": "Sprint Planning", "start_offset_h": 9, "duration_h": 1, "day_offset": 1, "status": "UPCOMING"},
            {"asset": "AF-0011", "user": "priya.patel@assetflow.com", "title": "Architecture Review", "start_offset_h": 11, "duration_h": 2, "day_offset": 1, "status": "UPCOMING"},
            {"asset": "AF-0012", "user": "vikram.singh@assetflow.com", "title": "Budget Review Q3", "start_offset_h": 10, "duration_h": 1.5, "day_offset": 1, "status": "UPCOMING"},
            {"asset": "AF-0012", "user": "simran.kaur@assetflow.com", "title": "Ops Standup", "start_offset_h": 14, "duration_h": 0.5, "day_offset": 1, "status": "UPCOMING"},
            {"asset": "AF-0013", "user": "pooja.verma@assetflow.com", "title": "HR Onboarding Session", "start_offset_h": 9, "duration_h": 3, "day_offset": 2, "status": "UPCOMING"},
            {"asset": "AF-0011", "user": "raj.kumar@assetflow.com", "title": "Code Review Session", "start_offset_h": 15, "duration_h": 1, "day_offset": 2, "status": "UPCOMING"},
            # Completed bookings (in the past)
            {"asset": "AF-0011", "user": "priya.patel@assetflow.com", "title": "Team Retrospective", "start_offset_h": 10, "duration_h": 1, "day_offset": -2, "status": "COMPLETED"},
            {"asset": "AF-0012", "user": "ankit.mehta@assetflow.com", "title": "Financial Close Meeting", "start_offset_h": 14, "duration_h": 2, "day_offset": -1, "status": "COMPLETED"},
            {"asset": "AF-0014", "user": "ravi.sharma@assetflow.com", "title": "Projector for Presentation", "start_offset_h": 11, "duration_h": 1, "day_offset": -3, "status": "COMPLETED"},
            # Cancelled
            {"asset": "AF-0013", "user": "arjun.reddy@assetflow.com", "title": "Cancelled: Ops Review", "start_offset_h": 16, "duration_h": 1, "day_offset": 1, "status": "CANCELLED"},
        ]

        for b in bookings_data:
            asset_id = asset_ids.get(b["asset"])
            user_id = user_ids.get(b["user"])
            if not asset_id or not user_id:
                continue

            base_day = tomorrow + timedelta(days=b["day_offset"])
            start = base_day + timedelta(hours=b["start_offset_h"])
            end = start + timedelta(hours=b["duration_h"])

            # Check for existing booking at same time
            existing = db.execute(
                text("SELECT id FROM bookings WHERE asset_id = :aid AND start_time = :start"),
                {"aid": asset_id, "start": start},
            ).first()
            if existing:
                print(f"  ⏭  Booking {b['asset']} '{b['title']}' already exists")
                continue

            bid = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO bookings (id, asset_id, user_id, title, start_time, end_time, status, created_at, updated_at)
                    VALUES (:id, :asset_id, :user_id, :title, :start, :end, :status, NOW(), NOW())
                """),
                {"id": bid, "asset_id": asset_id, "user_id": user_id, "title": b["title"],
                 "start": start, "end": end, "status": b["status"]},
            )
            print(f"  ✅ Booking: {b['asset']} — '{b['title']}' ({b['status']})")
        db.commit()

        # ── 7. Create Transfers ───────────────────────────────────
        print("\n━━━ Creating Transfers ━━━")
        ravi_id = user_ids.get("ravi.sharma@assetflow.com")
        transfers_data = [
            {"asset": "AF-0001", "from": "neha.gupta@assetflow.com", "to": "raj.kumar@assetflow.com", "reason": "Neha upgraded to MacBook, Raj needs a laptop", "status": "PENDING", "requested_by": "raj.kumar@assetflow.com"},
            {"asset": "AF-0019", "from": "arjun.reddy@assetflow.com", "to": "simran.kaur@assetflow.com", "reason": "Arjun returning from field, Simran needs for site visit", "status": "PENDING", "requested_by": "simran.kaur@assetflow.com"},
            {"asset": "AF-0010", "from": "simran.kaur@assetflow.com", "to": "arjun.reddy@assetflow.com", "reason": "Vehicle reassignment for field operations", "status": "APPROVED", "requested_by": "ravi.sharma@assetflow.com"},
        ]

        for t in transfers_data:
            asset_id = asset_ids.get(t["asset"])
            from_id = user_ids.get(t["from"])
            to_id = user_ids.get(t["to"])
            req_by = user_ids.get(t["requested_by"])
            if not all([asset_id, from_id, to_id, req_by]):
                continue

            existing = db.execute(
                text("SELECT id FROM transfers WHERE asset_id = :aid AND from_user_id = :fid AND to_user_id = :tid AND status = :status"),
                {"aid": asset_id, "fid": from_id, "tid": to_id, "status": t["status"]},
            ).first()
            if existing:
                print(f"  ⏭  Transfer {t['asset']} already exists")
                continue

            tid = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO transfers (id, asset_id, from_user_id, to_user_id, reason, status, requested_by, approved_by, created_at, updated_at)
                    VALUES (:id, :asset_id, :from_id, :to_id, :reason, :status, :req_by, :approved_by, NOW(), NOW())
                """),
                {"id": tid, "asset_id": asset_id, "from_id": from_id, "to_id": to_id,
                 "reason": t["reason"], "status": t["status"], "req_by": req_by,
                 "approved_by": ravi_id if t["status"] == "APPROVED" else None},
            )
            print(f"  ✅ Transfer: {t['asset']} {t['from'].split('@')[0]} → {t['to'].split('@')[0]} ({t['status']})")
        db.commit()

        # ── 8. Create Maintenance Requests ────────────────────────
        print("\n━━━ Creating Maintenance Requests ━━━")
        maint_data = [
            {"asset": "AF-0004", "requested_by": "simran.kaur@assetflow.com", "priority": "HIGH", "issue": "Laptop screen flickering intermittently, may need display replacement", "status": "IN_PROGRESS", "approved_by": "ravi.sharma@assetflow.com"},
            {"asset": "AF-0015", "requested_by": "pooja.verma@assetflow.com", "priority": "MEDIUM", "issue": "Printer paper jam occurring frequently, needs roller cleaning", "status": "PENDING", "approved_by": None},
            {"asset": "AF-0018", "requested_by": "priya.patel@assetflow.com", "priority": "CRITICAL", "issue": "UPS beeping continuously, battery may need replacement", "status": "APPROVED", "approved_by": "ravi.sharma@assetflow.com"},
            {"asset": "AF-0017", "requested_by": "raj.kumar@assetflow.com", "priority": "LOW", "issue": "Switch port 24 not functioning, other ports OK", "status": "RESOLVED", "approved_by": "ravi.sharma@assetflow.com", "resolution": "Port replaced, switch firmware updated to latest version"},
            {"asset": "AF-0009", "requested_by": "arjun.reddy@assetflow.com", "priority": "MEDIUM", "issue": "Vehicle AC not cooling properly, needs servicing", "status": "PENDING", "approved_by": None},
        ]

        for m in maint_data:
            asset_id = asset_ids.get(m["asset"])
            req_by_id = user_ids.get(m["requested_by"])
            approved_by_id = user_ids.get(m["approved_by"]) if m["approved_by"] else None
            if not asset_id or not req_by_id:
                continue

            existing = db.execute(
                text("SELECT id FROM maintenance_requests WHERE asset_id = :aid AND requested_by_user_id = :rid AND issue_description = :issue"),
                {"aid": asset_id, "rid": req_by_id, "issue": m["issue"]},
            ).first()
            if existing:
                print(f"  ⏭  Maintenance for {m['asset']} already exists")
                continue

            mid = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO maintenance_requests (id, asset_id, requested_by_user_id, approved_by_user_id,
                        priority, status, issue_description, resolution_notes, created_at, updated_at)
                    VALUES (:id, :asset_id, :req_by, :approved_by, :priority, :status, :issue, :resolution, NOW(), NOW())
                """),
                {"id": mid, "asset_id": asset_id, "req_by": req_by_id,
                 "approved_by": approved_by_id, "priority": m["priority"],
                 "status": m["status"], "issue": m["issue"],
                 "resolution": m.get("resolution")},
            )
            print(f"  ✅ Maintenance: {m['asset']} — {m['priority']} ({m['status']})")
        db.commit()

        # ── 9. Create Audit Cycle ─────────────────────────────────
        print("\n━━━ Creating Audit Cycle ━━━")
        admin_id = user_ids.get("admin@assetflow.com")
        ravi_id = user_ids.get("ravi.sharma@assetflow.com")
        priya_id = user_ids.get("priya.patel@assetflow.com")
        if admin_id:
            existing_audit = db.execute(
                text("SELECT id FROM audit_cycles WHERE name = :name"),
                {"name": "Q3 2026 IT Asset Audit"},
            ).first()
            if existing_audit:
                print("  ⏭  Audit cycle 'Q3 2026 IT Asset Audit' already exists")
            else:
                audit_id = str(uuid.uuid4())
                it_dept_id = dept_ids.get("IT Department")
                db.execute(
                    text("""
                        INSERT INTO audit_cycles (id, name, scope_type, scope_id, created_by_user_id,
                            start_date, end_date, status, created_at, updated_at)
                        VALUES (:id, :name, 'DEPARTMENT', :scope_id, :created_by,
                            :start, :end, 'OPEN', NOW(), NOW())
                    """),
                    {"id": audit_id, "name": "Q3 2026 IT Asset Audit", "scope_id": it_dept_id,
                     "created_by": admin_id, "start": now - timedelta(days=5),
                     "end": now + timedelta(days=25)},
                )
                print(f"  ✅ Created audit cycle: Q3 2026 IT Asset Audit")

                # Add audit items for IT department assets
                it_assets = ["AF-0001", "AF-0002", "AF-0005", "AF-0016", "AF-0017", "AF-0018"]
                statuses = ["VERIFIED", "VERIFIED", "VERIFIED", "PENDING", "PENDING", "DAMAGED"]
                notes = ["Asset in good condition, serial matches", "Excellent condition, no issues found", "Working correctly",
                         None, None, "Minor dent on chassis, still functional"]
                auditor = priya_id or ravi_id

                for tag, phys_status, note in zip(it_assets, statuses, notes):
                    aid = asset_ids.get(tag)
                    if not aid:
                        continue
                    item_id = str(uuid.uuid4())
                    db.execute(
                        text("""
                            INSERT INTO audit_items (id, audit_cycle_id, asset_id, auditor_user_id,
                                physical_status, notes, created_at, updated_at)
                            VALUES (:id, :cycle_id, :asset_id, :auditor,
                                :status, :notes, NOW(), NOW())
                        """),
                        {"id": item_id, "cycle_id": audit_id, "asset_id": aid,
                         "auditor": auditor,
                         "status": phys_status, "notes": note},
                    )
                    print(f"    ✅ Audit item: {tag} → {phys_status}")
            db.commit()

        # ── 10. Create Notifications ──────────────────────────────
        print("\n━━━ Creating Notifications ━━━")
        notifications_data = [
            {"user": "neha.gupta@assetflow.com", "title": "Asset Allocated", "message": "Dell Latitude 5540 (AF-0001) has been allocated to you.", "type": "ASSET_ALLOCATED", "is_read": True},
            {"user": "raj.kumar@assetflow.com", "title": "Asset Allocated", "message": "MacBook Pro 14\" (AF-0002) has been allocated to you.", "type": "ASSET_ALLOCATED", "is_read": True},
            {"user": "ravi.sharma@assetflow.com", "title": "Maintenance Request", "message": "New maintenance request raised for HP EliteBook 840 (AF-0004) — Priority: HIGH", "type": "MAINTENANCE_REQUESTED", "is_read": False},
            {"user": "ravi.sharma@assetflow.com", "title": "Transfer Request", "message": "Raj Kumar requests transfer of Dell Latitude 5540 (AF-0001) from Neha Gupta.", "type": "GENERAL", "is_read": False},
            {"user": "simran.kaur@assetflow.com", "title": "Booking Confirmed", "message": "Your booking for Meeting Room Beta on tomorrow 2:00 PM - 2:30 PM has been confirmed.", "type": "BOOKING_CONFIRMED", "is_read": False},
            {"user": "priya.patel@assetflow.com", "title": "Audit Assigned", "message": "You have been assigned as auditor for Q3 2026 IT Asset Audit.", "type": "AUDIT_ASSIGNED", "is_read": True},
            {"user": "pooja.verma@assetflow.com", "title": "Maintenance Pending", "message": "Your maintenance request for Canon ImageRunner Printer (AF-0015) is pending approval.", "type": "MAINTENANCE_REQUESTED", "is_read": False},
            {"user": "admin@assetflow.com", "title": "Overdue Alert", "message": "Toyota Innova Crysta (AF-0009) allocated to Simran Kaur is overdue for return.", "type": "GENERAL", "is_read": False},
            {"user": "arjun.reddy@assetflow.com", "title": "Asset Allocated", "message": "iPad Pro 12.9\" (AF-0019) has been allocated to you.", "type": "ASSET_ALLOCATED", "is_read": True},
            {"user": "vikram.singh@assetflow.com", "title": "Asset Returned", "message": "ThinkPad X1 Carbon (AF-0003) has been successfully returned.", "type": "ASSET_RETURNED", "is_read": True},
        ]

        for n in notifications_data:
            uid = user_ids.get(n["user"])
            if not uid:
                continue

            existing = db.execute(
                text("SELECT id FROM notifications WHERE user_id = :uid AND title = :title AND message = :msg"),
                {"uid": uid, "title": n["title"], "msg": n["message"]},
            ).first()
            if existing:
                print(f"  ⏭  Notification for {n['user'].split('@')[0]} already exists")
                continue

            nid = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO notifications (id, user_id, title, message, notification_type, is_read, created_at)
                    VALUES (:id, :uid, :title, :message, :type, :is_read, :created_at)
                """),
                {"id": nid, "uid": uid, "title": n["title"], "message": n["message"],
                 "type": n["type"], "is_read": n["is_read"],
                 "created_at": now - timedelta(hours=hash(n["title"]) % 72)},
            )
            print(f"  ✅ Notification: {n['user'].split('@')[0]} — {n['title']}")
        db.commit()

        # ── 11. Create Activity Logs ──────────────────────────────
        print("\n━━━ Creating Activity Logs ━━━")
        logs_data = [
            {"user": "admin@assetflow.com", "action": "CREATE", "entity": "DEPARTMENT", "details": {"name": "IT Department"}},
            {"user": "admin@assetflow.com", "action": "CREATE", "entity": "DEPARTMENT", "details": {"name": "Finance"}},
            {"user": "admin@assetflow.com", "action": "CREATE", "entity": "CATEGORY", "details": {"name": "Electronics"}},
            {"user": "admin@assetflow.com", "action": "PROMOTE", "entity": "USER", "details": {"email": "priya.patel@assetflow.com", "new_role": "DEPARTMENT_HEAD"}},
            {"user": "ravi.sharma@assetflow.com", "action": "REGISTER", "entity": "ASSET", "details": {"asset_tag": "AF-0001", "name": "Dell Latitude 5540"}},
            {"user": "ravi.sharma@assetflow.com", "action": "ALLOCATE", "entity": "ALLOCATION", "details": {"asset_tag": "AF-0001", "to_user": "Neha Gupta"}},
            {"user": "simran.kaur@assetflow.com", "action": "RAISE_REQUEST", "entity": "MAINTENANCE", "details": {"asset_tag": "AF-0004", "priority": "HIGH"}},
            {"user": "ravi.sharma@assetflow.com", "action": "APPROVE", "entity": "MAINTENANCE", "details": {"asset_tag": "AF-0004", "status": "APPROVED"}},
            {"user": "neha.gupta@assetflow.com", "action": "BOOK", "entity": "BOOKING", "details": {"asset_tag": "AF-0011", "title": "Sprint Planning"}},
            {"user": "raj.kumar@assetflow.com", "action": "REQUEST_TRANSFER", "entity": "TRANSFER", "details": {"asset_tag": "AF-0001", "from": "Neha Gupta", "to": "Raj Kumar"}},
            {"user": "admin@assetflow.com", "action": "CREATE_AUDIT", "entity": "AUDIT", "details": {"name": "Q3 2026 IT Asset Audit", "scope": "IT Department"}},
            {"user": "priya.patel@assetflow.com", "action": "AUDIT_VERIFY", "entity": "AUDIT_ITEM", "details": {"asset_tag": "AF-0001", "status": "VERIFIED"}},
        ]

        for i, log in enumerate(logs_data):
            uid = user_ids.get(log["user"])
            if not uid:
                continue

            log_id = str(uuid.uuid4())
            import json
            db.execute(
                text("""
                    INSERT INTO activity_logs (id, user_id, action_type, entity_type, details, created_at)
                    VALUES (:id, :uid, :action, :entity, :details, :created_at)
                """),
                {"id": log_id, "uid": uid, "action": log["action"], "entity": log["entity"],
                 "details": json.dumps(log["details"]),
                 "created_at": now - timedelta(hours=len(logs_data) - i)},
            )
        db.commit()
        print(f"  ✅ Created {len(logs_data)} activity log entries")

        # ── Done! ─────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("✅ Seed data created successfully!")
        print("=" * 60)
        print(f"\n📋 Summary:")
        print(f"   Departments:  {len(dept_ids)}")
        print(f"   Categories:   {len(cat_ids)}")
        print(f"   Users:        {len(user_ids)}")
        print(f"   Assets:       {len(asset_ids)}")
        print(f"   Allocations:  {len(allocations_data)}")
        print(f"   Bookings:     {len(bookings_data)}")
        print(f"   Transfers:    {len(transfers_data)}")
        print(f"   Maintenance:  {len(maint_data)}")
        print(f"   Audit Items:  6")
        print(f"   Notifications:{len(notifications_data)}")
        print(f"   Activity Logs:{len(logs_data)}")
        print(f"\n🔑 Login credentials (all passwords: {DEFAULT_PASSWORD}):")
        for u in users_data:
            print(f"   {u['email']:40s} → {u['role']}")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

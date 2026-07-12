"""
Database-level constraints, triggers, and DDL for AssetFlow edge cases.

Run this after Base.metadata.create_all() to apply:
  - EXCLUDE constraint on bookings (prevents overlapping time ranges)
  - Partial unique index on allocations (one ACTIVE allocation per asset)
  - BEFORE UPDATE triggers on audit_cycles / audit_items (immutable when CLOSED)
  - BEFORE UPDATE trigger on users (cascading deactivation)
  - BEFORE UPDATE trigger on assets (cascading status changes + lifecycle validation)
  - BEFORE DELETE prevent triggers on core entities (soft-delete enforcement)

Usage:
    from constraints import apply_all_constraints
    apply_all_constraints(engine)
"""

from __future__ import annotations

from sqlalchemy import DDL, event, text
from sqlalchemy.engine import Engine


# ---------------------------------------------------------------------------
# 1. EXCLUDE constraint on bookings  (btree_gist)
#    Prevents overlapping bookings per asset using strict < and > so that
#    back-to-back bookings (10:00 end, 10:00 start) are allowed.
# ---------------------------------------------------------------------------

_BOOKING_EXCLUDE_DDL = DDL(
    """
    -- Ensure the btree_gist extension is available (Supabase has it by default)
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    -- Drop the constraint if it already exists so this is idempotent
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_no_overlapping_bookings'
              AND conrelid = 'bookings'::regclass
        ) THEN
            ALTER TABLE bookings DROP CONSTRAINT uq_no_overlapping_bookings;
        END IF;
    END $$;

    ALTER TABLE bookings
        ADD CONSTRAINT uq_no_overlapping_bookings
        EXCLUDE USING gist (
            asset_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        )
        -- Only enforce for non-cancelled bookings
        WHERE (status NOT IN ('CANCELLED'));
    """
)

# Also add a CHECK: end_time > start_time
_BOOKING_TIME_CHECK_DDL = DDL(
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'ck_bookings_end_after_start'
              AND conrelid = 'bookings'::regclass
        ) THEN
            ALTER TABLE bookings
                ADD CONSTRAINT ck_bookings_end_after_start
                CHECK (end_time > start_time);
        END IF;
    END $$;
    """
)


# ---------------------------------------------------------------------------
# 2. Partial unique index on allocations
#    Ensures only one ACTIVE allocation per asset at any time.
# ---------------------------------------------------------------------------

_ALLOCATION_UNIQUE_INDEX_DDL = DDL(
    """
    DROP INDEX IF EXISTS uix_allocations_active_per_asset;
    CREATE UNIQUE INDEX uix_allocations_active_per_asset
        ON allocations (asset_id)
        WHERE status = 'ACTIVE';
    """
)


# ---------------------------------------------------------------------------
# 3. Immutable historical records — BEFORE UPDATE triggers
#    Prevents edits to audit_cycles / audit_items once status = 'CLOSED'.
# ---------------------------------------------------------------------------

_IMMUTABLE_AUDIT_CYCLE_TRIGGER = DDL(
    """
    CREATE OR REPLACE FUNCTION fn_prevent_closed_audit_cycle_update()
    RETURNS TRIGGER AS $$
    BEGIN
        IF OLD.status = 'CLOSED' THEN
            RAISE EXCEPTION
                'Audit cycle "%" (id: %) is CLOSED and cannot be modified.',
                OLD.name, OLD.id;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_prevent_closed_audit_cycle_update ON audit_cycles;
    CREATE TRIGGER trg_prevent_closed_audit_cycle_update
        BEFORE UPDATE ON audit_cycles
        FOR EACH ROW
        EXECUTE FUNCTION fn_prevent_closed_audit_cycle_update();
    """
)

_IMMUTABLE_AUDIT_ITEM_TRIGGER = DDL(
    """
    CREATE OR REPLACE FUNCTION fn_prevent_closed_audit_item_update()
    RETURNS TRIGGER AS $$
    DECLARE
        cycle_status TEXT;
    BEGIN
        SELECT status INTO cycle_status
        FROM audit_cycles
        WHERE id = OLD.audit_cycle_id;

        IF cycle_status = 'CLOSED' THEN
            RAISE EXCEPTION
                'Audit item % belongs to CLOSED cycle and cannot be modified.',
                OLD.id;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_prevent_closed_audit_item_update ON audit_items;
    CREATE TRIGGER trg_prevent_closed_audit_item_update
        BEFORE UPDATE ON audit_items
        FOR EACH ROW
        EXECUTE FUNCTION fn_prevent_closed_audit_item_update();
    """
)


# ---------------------------------------------------------------------------
# 4. Cascading state inconsistencies — User deactivation trigger
#    When a user is deactivated (is_active = FALSE), automatically:
#      - RETURN all their ACTIVE allocations
#      - Set the corresponding assets back to AVAILABLE
# ---------------------------------------------------------------------------

_CASCADE_USER_DEACTIVATION_TRIGGER = DDL(
    """
    CREATE OR REPLACE FUNCTION fn_cascade_user_deactivation()
    RETURNS TRIGGER AS $$
    BEGIN
        IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
            -- Return all active allocations for this user
            UPDATE allocations
            SET status = 'RETURNED',
                actual_return_date = NOW(),
                updated_at = NOW()
            WHERE user_id = NEW.id
              AND status = 'ACTIVE';

            -- Revert corresponding assets to AVAILABLE
            UPDATE assets
            SET current_status = 'AVAILABLE',
                updated_at = NOW()
            WHERE id IN (
                SELECT asset_id FROM allocations
                WHERE user_id = NEW.id
                  AND status = 'RETURNED'
            )
            AND current_status = 'ALLOCATED';
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_cascade_user_deactivation ON users;
    CREATE TRIGGER trg_cascade_user_deactivation
        AFTER UPDATE OF is_active ON users
        FOR EACH ROW
        WHEN (OLD.is_active = TRUE AND NEW.is_active = FALSE)
        EXECUTE FUNCTION fn_cascade_user_deactivation();
    """
)


# ---------------------------------------------------------------------------
# 5. Cascading state inconsistencies — Asset status change trigger
#    When an asset status changes, automatically:
#      - UNDER_MAINTENANCE: cancel all future UPCOMING bookings
#      - LOST / RETIRED / DISPOSED: cancel all future bookings,
#        return any active allocation
# ---------------------------------------------------------------------------

_CASCADE_ASSET_STATUS_TRIGGER = DDL(
    """
    CREATE OR REPLACE FUNCTION fn_cascade_asset_status_change()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Asset going UNDER_MAINTENANCE: cancel future bookings
        IF NEW.current_status = 'UNDER_MAINTENANCE'
           AND OLD.current_status != 'UNDER_MAINTENANCE'
        THEN
            UPDATE bookings
            SET status = 'CANCELLED',
                updated_at = NOW()
            WHERE asset_id = NEW.id
              AND status IN ('UPCOMING', 'ONGOING')
              AND start_time > NOW();
        END IF;

        -- Asset going LOST / RETIRED / DISPOSED: cancel all future bookings + return allocation
        IF NEW.current_status IN ('LOST', 'RETIRED', 'DISPOSED')
           AND OLD.current_status NOT IN ('LOST', 'RETIRED', 'DISPOSED')
        THEN
            -- Cancel future bookings
            UPDATE bookings
            SET status = 'CANCELLED',
                updated_at = NOW()
            WHERE asset_id = NEW.id
              AND status IN ('UPCOMING', 'ONGOING');

            -- Return active allocation
            UPDATE allocations
            SET status = 'RETURNED',
                actual_return_date = NOW(),
                updated_at = NOW()
            WHERE asset_id = NEW.id
              AND status = 'ACTIVE';
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_cascade_asset_status_change ON assets;
    CREATE TRIGGER trg_cascade_asset_status_change
        AFTER UPDATE OF current_status ON assets
        FOR EACH ROW
        WHEN (OLD.current_status IS DISTINCT FROM NEW.current_status)
        EXECUTE FUNCTION fn_cascade_asset_status_change();
    """
)


# ---------------------------------------------------------------------------
# 6. Lifecycle state transition validation (DB-level fallback)
#    Only validates transitions that should never happen regardless of ORM.
# ---------------------------------------------------------------------------

_ASSET_STATUS_LIFECYCLE_TRIGGER = DDL(
    """
    CREATE OR REPLACE FUNCTION fn_validate_asset_status_transition()
    RETURNS TRIGGER AS $$
    BEGIN
        -- DISPOSED is a terminal state — cannot transition to anything else
        IF OLD.current_status = 'DISPOSED' AND NEW.current_status != 'DISPOSED' THEN
            RAISE EXCEPTION
                'Asset is DISPOSED (terminal state). Cannot transition to %.',
                NEW.current_status;
        END IF;

        -- RETIRED is a terminal state
        IF OLD.current_status = 'RETIRED' AND NEW.current_status != 'RETIRED' THEN
            RAISE EXCEPTION
                'Asset is RETIRED (terminal state). Cannot transition to %.',
                NEW.current_status;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_validate_asset_status_transition ON assets;
    CREATE TRIGGER trg_validate_asset_status_transition
        BEFORE UPDATE OF current_status ON assets
        FOR EACH ROW
        WHEN (OLD.current_status IS DISTINCT FROM NEW.current_status)
        EXECUTE FUNCTION fn_validate_asset_status_transition();
    """
)


# ---------------------------------------------------------------------------
# 7. Hard-delete prevention on core entities
# ---------------------------------------------------------------------------

def _make_prevent_delete_trigger_ddl(table_name: str) -> DDL:
    fn_name = f"fn_prevent_delete_{table_name}"
    trg_name = f"trg_prevent_delete_{table_name}"
    return DDL(
        f"""
        CREATE OR REPLACE FUNCTION {fn_name}()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION
                'Hard deletes are not allowed on table "{table_name}". '
                'Use soft-delete (set is_active = FALSE) instead.';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS {trg_name} ON {table_name};
        CREATE TRIGGER {trg_name}
            BEFORE DELETE ON {table_name}
            FOR EACH ROW
            EXECUTE FUNCTION {fn_name}();
        """
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_all_constraints(engine: Engine) -> None:
    """Apply all edge-case constraints and triggers to the database."""

    ddl_statements = [
        # EC1: Overlap prevention on bookings
        _BOOKING_EXCLUDE_DDL,
        _BOOKING_TIME_CHECK_DDL,
        # EC2: Unique active allocation per asset
        _ALLOCATION_UNIQUE_INDEX_DDL,
        # EC3: Immutable historical records
        _IMMUTABLE_AUDIT_CYCLE_TRIGGER,
        _IMMUTABLE_AUDIT_ITEM_TRIGGER,
        # EC4: Lifecycle validation (DB fallback)
        _ASSET_STATUS_LIFECYCLE_TRIGGER,
        # EC5: Cascading state inconsistencies
        _CASCADE_USER_DEACTIVATION_TRIGGER,
        _CASCADE_ASSET_STATUS_TRIGGER,
        # EC7: Hard-delete prevention on core entities
        _make_prevent_delete_trigger_ddl("departments"),
        _make_prevent_delete_trigger_ddl("users"),
        _make_prevent_delete_trigger_ddl("asset_categories"),
        _make_prevent_delete_trigger_ddl("assets"),
        _make_prevent_delete_trigger_ddl("allocations"),
        _make_prevent_delete_trigger_ddl("bookings"),
        _make_prevent_delete_trigger_ddl("maintenance_requests"),
        _make_prevent_delete_trigger_ddl("audit_cycles"),
        _make_prevent_delete_trigger_ddl("audit_items"),
    ]

    with engine.begin() as conn:
        for ddl in ddl_statements:
            # DDL objects may choke on '%' in PL/pgSQL; extract the string
            # and execute via text() instead.
            sql = ddl.statement if hasattr(ddl, 'statement') else str(ddl)
            conn.execute(text(sql))

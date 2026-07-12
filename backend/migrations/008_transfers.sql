-- 008: Transfers table + condition_notes on allocations + indexes

-- 1. Add condition_notes to allocations
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS condition_notes TEXT;

-- 2. Transfer status enum
DO $$ BEGIN
    CREATE TYPE transfer_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Transfers table
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    status transfer_status_enum NOT NULL DEFAULT 'PENDING',
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS ix_allocations_asset_status ON allocations (asset_id, status);
CREATE INDEX IF NOT EXISTS ix_transfers_asset ON transfers (asset_id);
CREATE INDEX IF NOT EXISTS ix_transfers_status ON transfers (status);
CREATE INDEX IF NOT EXISTS ix_transfers_from_user ON transfers (from_user_id);
CREATE INDEX IF NOT EXISTS ix_transfers_to_user ON transfers (to_user_id);

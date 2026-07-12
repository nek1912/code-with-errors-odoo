-- 010_maintenance_indexes.sql
-- Add composite index for maintenance requests and new columns.

-- Add new columns
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS previous_asset_status VARCHAR(50);

-- Composite index for active request lookup per asset
CREATE INDEX IF NOT EXISTS ix_maintenance_asset_status
    ON maintenance_requests (asset_id, status);

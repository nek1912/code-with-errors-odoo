-- 011_audit_indexes.sql
-- Add indexes for audit_items and update PhysicalStatus enum.

-- Composite index for fast audit item lookups
CREATE INDEX IF NOT EXISTS ix_audit_items_cycle_asset
    ON audit_items (audit_cycle_id, asset_id);

-- Index for finding items by status
CREATE INDEX IF NOT EXISTS ix_audit_items_status
    ON audit_items (physical_status);

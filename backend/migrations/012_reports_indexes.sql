-- 012_reports_indexes.sql
-- Add indexes and column for reports aggregation performance.

-- Add expected_lifespan_years to asset_categories
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS expected_lifespan_years INTEGER;

-- Index for allocation department aggregation
CREATE INDEX IF NOT EXISTS ix_allocations_dept_status
    ON allocations (department_id, status);

-- Index for booking asset aggregation
CREATE INDEX IF NOT EXISTS ix_bookings_asset_created
    ON bookings (asset_id, created_at);

-- Index for maintenance asset aggregation
CREATE INDEX IF NOT EXISTS ix_maintenance_asset_created
    ON maintenance_requests (asset_id, created_at);

-- 009_booking_indexes.sql
-- Add composite index for fast overlap queries on bookings
-- and add title column to bookings table.

-- Add title column (nullable, for optional booking descriptions)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Composite index for overlap queries: asset_id + start_time + end_time
-- Enables fast lookup of overlapping bookings per resource
CREATE INDEX IF NOT EXISTS ix_bookings_asset_time
    ON bookings (asset_id, start_time, end_time);

-- Partial index for active bookings only (excludes cancelled)
-- Further optimizes overlap queries which always filter out CANCELLED
CREATE INDEX IF NOT EXISTS ix_bookings_active_overlap
    ON bookings (asset_id, start_time, end_time)
    WHERE status != 'CANCELLED';

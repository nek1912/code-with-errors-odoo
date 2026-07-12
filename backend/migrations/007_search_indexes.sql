-- EC6: Add pg_trgm GIN index for fast ILIKE search on asset names
-- The pg_trgm extension enables trigram matching which makes LIKE/ILIKE queries
-- use an index instead of sequential scan.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for trigram-based text search on asset name
CREATE INDEX IF NOT EXISTS ix_assets_name_trgm ON assets USING gin (name gin_trgm_ops);

-- Also ensure B-tree indexes exist for exact-match and prefix searches
CREATE INDEX IF NOT EXISTS ix_assets_tag ON assets (asset_tag);
CREATE INDEX IF NOT EXISTS ix_assets_serial ON assets (serial_number);
CREATE INDEX IF NOT EXISTS ix_assets_category ON assets (category_id);
CREATE INDEX IF NOT EXISTS ix_assets_status ON assets (current_status);
CREATE INDEX IF NOT EXISTS ix_assets_department ON assets (department_id);

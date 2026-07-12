-- ── Asset Tag Auto-Generation (AF-XXXX format) ────────────────
-- Uses a PostgreSQL sequence + trigger to auto-generate unique tags.

CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_asset_tag()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.asset_tag IS NULL OR NEW.asset_tag = '' THEN
        NEW.asset_tag := 'AF-' || LPAD(nextval('asset_tag_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_tag ON assets;
CREATE TRIGGER trg_asset_tag
    BEFORE INSERT ON assets
    FOR EACH ROW
    EXECUTE FUNCTION generate_asset_tag();

-- Additional indexes for search performance
CREATE INDEX IF NOT EXISTS ix_assets_tag ON assets (asset_tag);
CREATE INDEX IF NOT EXISTS ix_assets_serial ON assets (serial_number);
CREATE INDEX IF NOT EXISTS ix_assets_name_trgm ON assets USING gin (name gin_trgm_ops);

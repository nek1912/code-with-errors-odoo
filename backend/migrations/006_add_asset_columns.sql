-- Add condition enum, photo_url, and auto-generate asset_tag trigger

-- 1. Asset condition enum
DO $$ BEGIN
    CREATE TYPE asset_condition_enum AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add condition column (default GOOD for existing rows)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS condition asset_condition_enum NOT NULL DEFAULT 'GOOD';

-- 3. Add photo_url column
ALTER TABLE assets ADD COLUMN IF NOT EXISTS photo_url VARCHAR(512);

-- 4. Asset tag sequence + trigger
CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_asset_tag()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.asset_tag IS NULL OR NEW.asset_tag = '' OR NEW.asset_tag = 'AF-PLACEHOLDER' THEN
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

-- 5. Additional indexes for search
CREATE INDEX IF NOT EXISTS ix_assets_tag ON assets (asset_tag);
CREATE INDEX IF NOT EXISTS ix_assets_serial ON assets (serial_number);

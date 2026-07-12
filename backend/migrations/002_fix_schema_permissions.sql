-- ============================================================
-- FIX: Restore schema permissions for all Supabase roles
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Grant USAGE on the public schema (minimum requirement for PostgREST)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant table access
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Grant function execution
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 4. Ensure future tables/functions inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO service_role;

-- 5. Verify fix (should return all TRUE)
SELECT
    has_schema_privilege('anon', 'public', 'USAGE') AS anon_usage,
    has_schema_privilege('authenticated', 'public', 'USAGE') AS auth_usage,
    has_schema_privilege('service_role', 'public', 'USAGE') AS svc_usage;

-- ============================================================
-- RLS Policies for Organization Setup tables
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── DEPARTMENTS: Admin-only write ─────────────────────────────
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read departments
CREATE POLICY departments_read ON public.departments
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only Admin can insert/update/delete
CREATE POLICY departments_admin_insert ON public.departments
    FOR INSERT WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY departments_admin_update ON public.departments
    FOR UPDATE USING (public.user_role() = 'ADMIN');

CREATE POLICY departments_admin_delete ON public.departments
    FOR DELETE USING (public.user_role() = 'ADMIN');

-- ── ASSET_CATEGORIES: Admin-only write ────────────────────────
-- (already has a read policy from 003_rls_policies.sql, but add write)

-- Only Admin can insert/update/delete categories
CREATE POLICY categories_admin_insert ON public.asset_categories
    FOR INSERT WITH CHECK (public.user_role() = 'ADMIN');

CREATE POLICY categories_admin_update ON public.asset_categories
    FOR UPDATE USING (public.user_role() = 'ADMIN');

CREATE POLICY categories_admin_delete ON public.asset_categories
    FOR DELETE USING (public.user_role() = 'ADMIN');

-- ── USERS: Admin-only role/status changes ─────────────────────
-- (users already has policies from 001/003 migrations)

-- Only Admin can update users (for role/status changes)
CREATE POLICY users_admin_update ON public.users
    FOR UPDATE USING (public.user_role() = 'ADMIN');

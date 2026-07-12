-- ============================================================
-- AssetFlow RLS Policies for Dashboard Tables
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================
-- These policies ensure that even if the FastAPI backend
-- misses a filter, the database prevents data leakage.
-- ============================================================

-- ── Helper: get current user's role ───────────────────────────
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

-- ── Helper: get current user's department ─────────────────────
CREATE OR REPLACE FUNCTION public.user_department_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT department_id FROM public.users WHERE id = auth.uid();
$$;

-- ============================================================
-- ASSETS TABLE
-- ============================================================
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Admin and Asset Manager: full access
CREATE POLICY assets_admin_full ON public.assets
    FOR ALL
    USING (public.user_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- Department Head: read/write assets in their department + shared assets
CREATE POLICY assets_dept_head ON public.assets
    FOR ALL
    USING (
        public.user_role() = 'DEPARTMENT_HEAD'
        AND (
            department_id = public.user_department_id()
            OR is_shared = TRUE
        )
    );

-- Employee: read shared assets and assets in their department
CREATE POLICY assets_employee_read ON public.assets
    FOR SELECT
    USING (
        public.user_role() = 'EMPLOYEE'
        AND (
            is_shared = TRUE
            OR department_id = public.user_department_id()
        )
    );

-- ============================================================
-- ALLOCATIONS TABLE
-- ============================================================
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

-- Admin and Asset Manager: full access
CREATE POLICY allocations_admin_full ON public.allocations
    FOR ALL
    USING (public.user_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- Department Head: read/write allocations in their department
CREATE POLICY allocations_dept_head ON public.allocations
    FOR ALL
    USING (
        public.user_role() = 'DEPARTMENT_HEAD'
        AND department_id = public.user_department_id()
    );

-- Employee: read own allocations only
CREATE POLICY allocations_employee_read ON public.allocations
    FOR SELECT
    USING (
        public.user_role() = 'EMPLOYEE'
        AND user_id = auth.uid()
    );

-- ============================================================
-- BOOKINGS TABLE
-- ============================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Admin and Asset Manager: full access
CREATE POLICY bookings_admin_full ON public.bookings
    FOR ALL
    USING (public.user_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- Department Head: read/write own bookings + department bookings
CREATE POLICY bookings_dept_head ON public.bookings
    FOR ALL
    USING (
        public.user_role() = 'DEPARTMENT_HEAD'
        AND user_id = auth.uid()
    );

-- Employee: read/write own bookings
CREATE POLICY bookings_employee_own ON public.bookings
    FOR ALL
    USING (
        public.user_role() = 'EMPLOYEE'
        AND user_id = auth.uid()
    );

-- ============================================================
-- ACTIVITY_LOGS TABLE (read-only for all authenticated users)
-- ============================================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read activity logs
CREATE POLICY activity_logs_read ON public.activity_logs
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only service role can insert (backend writes via service_role key)
CREATE POLICY activity_logs_insert ON public.activity_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY notifications_read_own ON public.notifications
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================
-- MAINTENANCE_REQUESTS TABLE
-- ============================================================
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Admin and Asset Manager: full access
CREATE POLICY maintenance_admin_full ON public.maintenance_requests
    FOR ALL
    USING (public.user_role() IN ('ADMIN', 'ASSET_MANAGER'));

-- Department Head: read/write in their department
CREATE POLICY maintenance_dept_head ON public.maintenance_requests
    FOR ALL
    USING (
        public.user_role() = 'DEPARTMENT_HEAD'
        AND asset_id IN (
            SELECT id FROM public.assets
            WHERE department_id = public.user_department_id()
        )
    );

-- Employee: read own requests + create new ones
CREATE POLICY maintenance_employee_read ON public.maintenance_requests
    FOR SELECT
    USING (
        public.user_role() = 'EMPLOYEE'
        AND requested_by_user_id = auth.uid()
    );

CREATE POLICY maintenance_employee_insert ON public.maintenance_requests
    FOR INSERT
    WITH CHECK (
        public.user_role() = 'EMPLOYEE'
        AND requested_by_user_id = auth.uid()
    );

-- ============================================================
-- DEPARTMENTS TABLE (read-only for all authenticated users)
-- ============================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY departments_read ON public.departments
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================================
-- ASSET_CATEGORIES TABLE (read-only for all authenticated users)
-- ============================================================
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_read ON public.asset_categories
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================================
-- AUDIT_CYCLES TABLE
-- ============================================================
ALTER TABLE public.audit_cycles ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY audit_cycles_admin ON public.audit_cycles
    FOR ALL
    USING (public.user_role() = 'ADMIN');

-- Department Head: read cycles affecting their department
CREATE POLICY audit_cycles_dept_head ON public.audit_cycles
    FOR SELECT
    USING (
        public.user_role() = 'DEPARTMENT_HEAD'
        AND (
            scope_type = 'ALL'
            OR (scope_type = 'DEPARTMENT' AND scope_id = public.user_department_id())
        )
    );

-- Employee: read only cycles scoped to ALL or their department
CREATE POLICY audit_cycles_employee ON public.audit_cycles
    FOR SELECT
    USING (
        public.user_role() = 'EMPLOYEE'
        AND (
            scope_type = 'ALL'
            OR (scope_type = 'DEPARTMENT' AND scope_id = public.user_department_id())
        )
    );

-- ============================================================
-- Verify policies (should return rows for each table)
-- ============================================================
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
--   AND tablename IN ('assets', 'allocations', 'bookings', 'activity_logs',
--                      'notifications', 'maintenance_requests', 'departments',
--                      'asset_categories', 'audit_cycles')
--   ORDER BY tablename, policyname;

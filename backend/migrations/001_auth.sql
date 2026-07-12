-- ============================================================
-- AssetFlow Auth Migration
-- Run this AFTER the base schema (models.py tables)
-- ============================================================

-- 1. Add auth columns to existing users table
-- ============================================================
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON public.users (locked_until) WHERE locked_until IS NOT NULL;

-- 2. Function: Check login eligibility
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_login_eligibility(user_email TEXT)
RETURNS TABLE (is_allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    user_record RECORD;
BEGIN
    SELECT id, is_active, locked_until, email_confirmed_at
    INTO user_record
    FROM public.users
    WHERE LOWER(email) = LOWER(user_email);

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Invalid email or password'::TEXT;
        RETURN;
    END IF;

    IF NOT user_record.is_active THEN
        RETURN QUERY SELECT FALSE, 'Account is deactivated. Contact your administrator.'::TEXT;
        RETURN;
    END IF;

    IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
        RETURN QUERY SELECT FALSE, 'Account is temporarily locked. Try again later.'::TEXT;
        RETURN;
    END IF;

    IF user_record.email_confirmed_at IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Email not verified. Please check your inbox.'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Login allowed'::TEXT;
END;
$fn$;

-- 3. Function: Record failed login attempt
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_failed_login(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    max_attempts CONSTANT INTEGER := 5;
    lockout_window CONSTANT INTERVAL := '15 minutes';
BEGIN
    UPDATE public.users
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
            WHEN failed_login_attempts + 1 >= max_attempts
            THEN NOW() + lockout_window
            ELSE locked_until
        END,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(user_email);
END;
$fn$;

-- 4. Function: Reset failed login on success
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_failed_login(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    UPDATE public.users
    SET failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(user_email);
END;
$fn$;

-- 5. Function: Auto-create user record on Supabase auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, is_active, email_confirmed_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
        'EMPLOYEE',
        TRUE,
        NEW.email_confirmed_at
    );
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Function: Sync email_confirmed_at from auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        UPDATE public.users
        SET email_confirmed_at = NEW.email_confirmed_at,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
    EXECUTE FUNCTION public.handle_email_confirmed();

-- 7. RLS Policies
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY service_role_all ON public.users
    FOR ALL USING (auth.role() = 'service_role');

-- Migration 013: Notifications & Activity Logs indexes + RLS policies
-- Run: psql -f migrations/013_notifications_activity_logs.sql

-- ── Indexes ──────────────────────────────────────────────────────
-- Composite index for the unread badge query (WHERE user_id = X AND is_read = FALSE)
CREATE INDEX IF NOT EXISTS ix_notifications_user_unread
    ON notifications (user_id, is_read);

-- Composite index for activity_logs filtering and pagination
CREATE INDEX IF NOT EXISTS ix_activity_logs_created
    ON activity_logs (created_at DESC);

-- Composite index for activity_logs by action_type
CREATE INDEX IF NOT EXISTS ix_activity_logs_action
    ON activity_logs (action_type, created_at DESC);

-- ── Row Level Security Policies ──────────────────────────────────

-- Notifications: Users can only SELECT their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Notifications: Users can UPDATE (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Activity Logs: Only admins/managers can SELECT
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view activity logs"
    ON activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('ADMIN', 'ASSET_MANAGER')
        )
    );

-- Activity Logs: No direct INSERT/UPDATE/DELETE via API
-- (Only backend middleware writes to this table via service role)
CREATE POLICY "Prevent direct inserts on activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Prevent direct updates on activity logs"
    ON activity_logs FOR UPDATE
    USING (false);

CREATE POLICY "Prevent direct deletes on activity logs"
    ON activity_logs FOR DELETE
    USING (false);

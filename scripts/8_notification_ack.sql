-- ============================================================
-- SCRIPT 8: Add acknowledged_by column to notifications
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID[] DEFAULT '{}';

COMMENT ON COLUMN public.notifications.acknowledged_by IS 'Array of employee IDs who have acknowledged (thumbs up) this notification';

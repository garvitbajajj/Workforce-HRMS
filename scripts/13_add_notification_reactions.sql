-- ── Add Reactions Column to Notifications ────────────────────────
-- Run this script in your Supabase SQL Editor.
-- It adds a jsonb reactions column to notifications table.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

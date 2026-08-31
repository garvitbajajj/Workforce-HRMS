-- ── Add Developer Access Flag ─────────────────────────────────
-- Run this script in your Supabase SQL Editor.
-- Adds an is_dev boolean flag to the employees table and grants
-- dev access to the listed accounts while keeping their existing roles.
-- ─────────────────────────────────────────────────────────────────

-- 1. Add the is_dev column
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS is_dev BOOLEAN DEFAULT false;

-- 2. Grant dev access (replace with your developer accounts' emails)
UPDATE public.employees 
SET is_dev = true 
WHERE LOWER(email) IN (
  'dev1@example.com',
  'dev2@example.com'
);

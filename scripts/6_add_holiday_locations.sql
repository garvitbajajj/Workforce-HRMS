-- ============================================================
-- SCRIPT 6: Add Location Fields to Holidays Table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.holidays
  ADD COLUMN IF NOT EXISTS pune BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS indore BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS noida BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS bangalore BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.holidays.pune IS 'Whether this holiday is active for Pune office';
COMMENT ON COLUMN public.holidays.indore IS 'Whether this holiday is active for Indore office';
COMMENT ON COLUMN public.holidays.noida IS 'Whether this holiday is active for Noida office';
COMMENT ON COLUMN public.holidays.bangalore IS 'Whether this holiday is active for Bangalore office';

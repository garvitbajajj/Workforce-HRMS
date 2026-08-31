-- ============================================================
-- SCRIPT 1b: Fix Grade Check Constraint
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- The grade column has a strict CHECK constraint that rejects
-- values like "HB 1.4" that weren't in our original list.
-- This script drops those constraints to allow all grade/level values.

-- Drop the grade check constraint (allows any HB x.y value)
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_grade_check;

-- Drop the level check constraint too (just to be safe)
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_level_check;

-- Confirm constraints are removed
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name   = 'employees'
ORDER BY constraint_name;

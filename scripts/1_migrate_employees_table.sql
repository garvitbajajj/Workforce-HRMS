-- ============================================================
-- SCRIPT 1: Add Company Excel Columns to Employees Table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Step 1: Add new columns matching the company Excel data ─────────────

ALTER TABLE public.employees
  -- Gender (Male/Female from the company data)
  ADD COLUMN IF NOT EXISTS gender     text
    CHECK (gender IN ('Male', 'Female', 'Other')),

  -- Account Manager — the AM assigned to this employee (free text name)
  ADD COLUMN IF NOT EXISTS am         text,

  -- Grade — company's internal grading system (HB x.y format)
  -- Values seen in data: HB 1.1, HB 1.2, HB 1.3, HB 2.1, HB 2.2,
  --                      HB 3.1, HB 3.2, HB 4.1, HB 4.2, HB 4.3
  ADD COLUMN IF NOT EXISTS grade      text
    CHECK (grade IN (
      'HB 1.1', 'HB 1.2', 'HB 1.3',
      'HB 2.1', 'HB 2.2',
      'HB 3.1', 'HB 3.2',
      'HB 4.1', 'HB 4.2', 'HB 4.3',
      'HB 5.1', 'HB 5.2'
    )),

  -- Level — seniority level (Level 1 = junior, Level 5 = senior leadership)
  ADD COLUMN IF NOT EXISTS level      text
    CHECK (level IN ('Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5')),

  -- DOJ Month — human-readable joining month (e.g. "Feb-25", "Jan-25")
  ADD COLUMN IF NOT EXISTS doj_month  text,

  -- Job Role — the functional role from the Excel "Role" column.
  -- NOTE: This is DIFFERENT from the system `role` column (admin/hr/manager/employee).
  -- The system role controls LOGIN PERMISSIONS. This column stores job function.
  -- Values seen: Team Lead, Account Manager, Talent Specialist, Recruitment Executive,
  --              Sr Recruitment Executive, Jr Recruitment Executive,
  --              Sr Talent Specialist, Jr Talent Specialist,
  --              Sr Search Associate, Consultant Search, HR - Executive
  ADD COLUMN IF NOT EXISTS job_role   text;

-- ── Step 2: Update employment_type CHECK to accept Excel "Mode" values ──
-- The current constraint allows: 'full_time', 'part_time', 'contract', 'intern'
-- The Excel has: 'Salary' (= full_time) and 'Consultant' (= contract)
-- We keep the existing DB values but note the mapping here for the import.

-- ── Step 3: Add descriptive comments ───────────────────────────────────
COMMENT ON COLUMN public.employees.gender    IS 'Employee gender: Male / Female / Other';
COMMENT ON COLUMN public.employees.am        IS 'Account Manager (AM) assigned to this employee';
COMMENT ON COLUMN public.employees.grade     IS 'Company grade: HB 1.1 through HB 4.3+';
COMMENT ON COLUMN public.employees.level     IS 'Seniority level: Level 1 (junior) to Level 5 (leadership)';
COMMENT ON COLUMN public.employees.doj_month IS 'Joining month in short format e.g. Feb-25';
COMMENT ON COLUMN public.employees.job_role  IS 'Functional job role e.g. Talent Specialist, Team Lead (separate from system role)';

-- ── Step 4: Verify all columns exist ───────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employees'
ORDER BY ordinal_position;

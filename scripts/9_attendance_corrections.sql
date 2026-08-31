-- ============================================================
-- SCRIPT 9: Create attendance_corrections table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,
  clock_in     TIMESTAMPTZ NOT NULL,
  clock_out    TIMESTAMPTZ NOT NULL,
  reason       TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by  UUID REFERENCES public.employees(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

COMMENT ON TABLE public.attendance_corrections IS 'Stores employee requests to correct/regularize past attendance records.';

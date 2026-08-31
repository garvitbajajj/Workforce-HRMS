-- ============================================================
-- SCRIPT 5: Add Profile Fields to Employees Table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE public.employees
  -- Emergency Contact Info (e.g. JSON string or formatted text)
  ADD COLUMN IF NOT EXISTS emergency_contact text,

  -- Bank Details (e.g. JSON string or formatted text)
  ADD COLUMN IF NOT EXISTS bank_details text;

COMMENT ON COLUMN public.employees.emergency_contact IS 'Emergency contact information for the employee';
COMMENT ON COLUMN public.employees.bank_details IS 'Bank account information for payroll processing';

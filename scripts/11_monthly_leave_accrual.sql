-- ── Monthly Leave Accrual Automation ─────────────────────────────
-- Run this script in your Supabase SQL Editor.
-- It creates a function to accrue 1.75 leaves to all employees' current year leave balance,
-- and schedules it to run automatically on the 1st of every month.
-- ─────────────────────────────────────────────────────────────────

-- 1. Drop existing function if it exists to avoid return type mismatch conflicts
DROP FUNCTION IF EXISTS public.accrue_monthly_leaves();

CREATE OR REPLACE FUNCTION public.accrue_monthly_leaves()
RETURNS void AS $$
DECLARE
  current_yr INT;
  rec RECORD;
BEGIN
  current_yr := EXTRACT(YEAR FROM NOW());

  -- Update existing leave balances
  UPDATE public.leave_balances
  SET total_allocated = total_allocated + 1.75,
      updated_at = NOW()
  WHERE year = current_yr;

  -- Create a success notification for each employee who received the accrual
  FOR rec IN (
    SELECT DISTINCT lb.employee_id 
    FROM public.leave_balances lb
    JOIN public.employees e ON e.id = lb.employee_id
    WHERE lb.year = current_yr
  ) LOOP
    INSERT INTO public.notifications (employee_id, title, message, type)
    VALUES (
      rec.employee_id,
      '📅 Monthly Leaves Accrued',
      '1.75 leaves have been automatically accrued to your balance for this month.',
      'success'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Unschedule first if it already exists to prevent duplicate schedules
SELECT cron.unschedule('accrue-leaves-monthly') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'accrue-leaves-monthly'
);

-- 4. Schedule the cron job to run at 00:00 on the 1st of every month
SELECT cron.schedule(
  'accrue-leaves-monthly',
  '0 0 1 * *',
  'SELECT public.accrue_monthly_leaves();'
);

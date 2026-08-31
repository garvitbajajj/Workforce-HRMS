-- ── Create SECURITY DEFINER function to handle password reset requests ──
-- This runs with superuser privileges, bypassing RLS to insert notification for admins.

CREATE OR REPLACE FUNCTION request_password_reset(user_email TEXT)
RETURNS VOID AS $$
DECLARE
  admin_rec RECORD;
BEGIN
  -- Loop through all admin and HR employees
  FOR admin_rec IN 
    SELECT id FROM employees 
    WHERE LOWER(role) IN ('admin', 'hr')
  LOOP
    -- Insert notification for each admin
    INSERT INTO notifications (employee_id, title, message, type, is_read, created_at)
    VALUES (
      admin_rec.id, 
      '🔑 Password Reset Request', 
      'An employee (' || user_email || ') has requested a password reset. Please reset their password and inform them.', 
      'warning', 
      FALSE, 
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to anon and authenticated users
GRANT EXECUTE ON FUNCTION request_password_reset(TEXT) TO anon, authenticated;

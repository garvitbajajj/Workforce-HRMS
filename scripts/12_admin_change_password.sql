-- ============================================================
-- SCRIPT 12: Admin Change Password Function (SECURITY DEFINER)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE OR REPLACE FUNCTION admin_change_password(target_email TEXT, new_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- 1. Check if the caller is an admin or HR.
  -- In Supabase, auth.uid() returns the UUID of the currently logged-in user.
  -- We query the public.employees table to get their role.
  SELECT role INTO caller_role 
  FROM public.employees 
  WHERE user_id = auth.uid();
  
  -- If not admin or HR, throw an exception
  IF caller_role IS NULL OR LOWER(caller_role) NOT IN ('admin', 'hr') THEN
    RAISE EXCEPTION 'Only Admin or HR can change employee passwords.';
  END IF;

  -- 2. Update the password in auth.users
  -- Note: we use extension pgcrypto for crypt/gen_salt
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE email = target_email;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION admin_change_password(TEXT, TEXT) TO authenticated;

-- Set Priyam's password to a strong (non-HIBP) value and elevate to super admin
DO $$
DECLARE
  v_auth_id uuid := 'bf3ef839-70dd-4a72-8729-7aa61267a3d3';
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt('EduLoans#Priyam2026!', gen_salt('bf')),
      updated_at = now(),
      email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = v_auth_id;
END $$;

UPDATE public.users
SET is_super_admin = true, updated_at = now()
WHERE email = 'priyam@cashkaro.com';
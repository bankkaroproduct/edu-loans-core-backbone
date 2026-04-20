-- Create auth credential for the pre-existing Reports@Cashkaro.com admin profile.
-- The handle_new_auth_user trigger will link this auth.users row to the existing public.users row.

DO $$
DECLARE
  v_email text := 'Reports@Cashkaro.com';
  v_password text := 'Reports@12345';
  v_user_id uuid;
  v_existing_auth_id uuid;
BEGIN
  -- Skip if an auth user with this email already exists (idempotent)
  SELECT id INTO v_existing_auth_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_existing_auth_id IS NOT NULL THEN
    RAISE NOTICE 'Auth user already exists for %, skipping insert', v_email;
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', 'Reports Admin'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_email,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );
END $$;
UPDATE auth.users
SET encrypted_password = crypt('Priyam@12345', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE lower(email) = 'priyam@cashkaro.com';

# Fix: Create the Reports@Cashkaro.com admin auth credential

## Root cause
- `public.users` row exists for `Reports@Cashkaro.com` with `role = 'admin'`
- `auth.users` row does NOT exist → Supabase returns `invalid_credentials`
- `/admin/login` is sign-in only, so the user can't self-register
- Previous migration created the profile row but never the auth credential

## Fix (single migration)

Insert the auth user directly into `auth.users` with:
- `email = 'Reports@Cashkaro.com'` (preserve casing)
- `encrypted_password = crypt('Reports@12345', gen_salt('bf'))`
- `email_confirmed_at = now()` (skip email verification — this is a test admin)
- `aud = 'authenticated'`, `role = 'authenticated'`
- `raw_app_meta_data = {"provider":"email","providers":["email"]}`
- `raw_user_meta_data = {"full_name":"Reports Admin"}`
- A matching row in `auth.identities` with `provider = 'email'`, `provider_id = email`, `identity_data = {sub, email}`

The existing `handle_new_auth_user` trigger on `auth.users` AFTER INSERT will automatically:
- Link the new `auth.users.id` → existing `public.users.auth_user_id`
- Insert into `public.user_roles` with role `admin`

No code changes needed — `Login.tsx`, `AdminLogin.tsx`, and `useAuth.tsx` are already correct.

## Verification (post-migration, in default mode)
1. Re-query `public.users` for `Reports@Cashkaro.com` → confirm `auth_user_id` is now populated
2. Confirm row in `public.user_roles` with role `admin`
3. User signs in at `/admin/login` with the credentials → should succeed and land on `/admin`

## Then resume Prompt 3 closure
Once login works, proceed with:
- Admin UI QA on a fresh disposable lead under the real admin session
- Negative auth test using the partner credentials
- Portal isolation re-check
- Cross-portal verification

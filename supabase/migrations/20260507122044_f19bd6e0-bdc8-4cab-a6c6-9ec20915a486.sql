
-- 1) username column on public.users (nullable, lowercase, unique when present)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username text;

-- Enforce uniqueness case-insensitively, ignoring NULLs
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
  ON public.users (lower(username))
  WHERE username IS NOT NULL;

-- 2) resolve_login_email: identifier -> email (or NULL).
-- If identifier contains '@', it's treated as an email and returned lowercased.
-- Otherwise, it's looked up against users.username (case-insensitive) and the
-- corresponding users.email is returned. Only active users are resolved.
-- SECURITY DEFINER so anonymous partners can resolve before signing in.
CREATE OR REPLACE FUNCTION public.resolve_login_email(_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_email text;
BEGIN
  IF _identifier IS NULL THEN RETURN NULL; END IF;
  v_id := lower(trim(_identifier));
  IF v_id = '' THEN RETURN NULL; END IF;

  IF position('@' IN v_id) > 0 THEN
    RETURN v_id;
  END IF;

  SELECT email INTO v_email
  FROM public.users
  WHERE lower(username) = v_id
    AND is_active = true
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

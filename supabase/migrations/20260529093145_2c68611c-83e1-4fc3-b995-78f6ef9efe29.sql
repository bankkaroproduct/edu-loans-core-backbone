
-- 1. Extend admin_section_key enum with 'calendar'
ALTER TYPE public.admin_section_key ADD VALUE IF NOT EXISTS 'calendar';

-- 2. Create admin_google_tokens table
CREATE TABLE public.admin_google_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_name TEXT,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.admin_google_tokens TO authenticated;
GRANT ALL ON public.admin_google_tokens TO service_role;

ALTER TABLE public.admin_google_tokens ENABLE ROW LEVEL SECURITY;

-- Owners can read/delete their own connection
CREATE POLICY "Admin reads own google connection"
ON public.admin_google_tokens FOR SELECT
TO authenticated
USING (
  user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "Admin deletes own google connection"
ON public.admin_google_tokens FOR DELETE
TO authenticated
USING (
  user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
);

-- Super admins can read all (for team calendar)
CREATE POLICY "Super admins read all google connections"
ON public.admin_google_tokens FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_admin_google_tokens_updated_at
BEFORE UPDATE ON public.admin_google_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

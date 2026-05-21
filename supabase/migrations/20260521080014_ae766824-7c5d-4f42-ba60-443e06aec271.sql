-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.admin_section_key AS ENUM (
    'dashboard','lead_queue','reports','add_lead','bulk_upload',
    'master_data','partners','lenders','premiere_lists',
    'bre','communications','admin_users'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.admin_access_level AS ENUM ('hidden','view','full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- USERS table additions
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_admin_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz;

-- Backfill: existing super_admin role rows get is_super_admin = true
UPDATE public.users SET is_super_admin = true WHERE role = 'super_admin' AND is_super_admin = false;

-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_section_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section public.admin_section_key NOT NULL,
  access_level public.admin_access_level NOT NULL DEFAULT 'hidden',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);
CREATE INDEX IF NOT EXISTS idx_admin_section_perms_user ON public.admin_section_permissions(user_id);

CREATE TABLE IF NOT EXISTS public.admin_partner_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partner_organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_partner_assign_user ON public.admin_partner_assignments(user_id);

-- updated_at trigger for permissions
DROP TRIGGER IF EXISTS trg_admin_section_perms_updated ON public.admin_section_permissions;
CREATE TRIGGER trg_admin_section_perms_updated
  BEFORE UPDATE ON public.admin_section_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_auth_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = _auth_id
      AND is_super_admin = true
      AND is_active = true
      AND terminated_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.get_admin_section_access(_auth_id uuid, _section public.admin_section_key)
RETURNS public.admin_access_level LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_is_super boolean;
  v_active boolean;
  v_terminated timestamptz;
  v_level public.admin_access_level;
BEGIN
  SELECT id, is_super_admin, is_active, terminated_at
    INTO v_user_id, v_is_super, v_active, v_terminated
  FROM public.users WHERE auth_user_id = _auth_id LIMIT 1;
  IF v_user_id IS NULL OR v_active IS NOT TRUE OR v_terminated IS NOT NULL THEN
    RETURN 'hidden'::public.admin_access_level;
  END IF;
  IF v_is_super THEN
    RETURN 'full'::public.admin_access_level;
  END IF;
  SELECT access_level INTO v_level
  FROM public.admin_section_permissions
  WHERE user_id = v_user_id AND section = _section;
  RETURN COALESCE(v_level, 'hidden'::public.admin_access_level);
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_assigned_partner_ids(_auth_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(partner_id), ARRAY[]::uuid[])
  FROM public.admin_partner_assignments
  WHERE user_id = (SELECT id FROM public.users WHERE auth_user_id = _auth_id LIMIT 1)
$$;

-- ============================================================
-- RLS — super admins only
-- ============================================================
ALTER TABLE public.admin_section_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_partner_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admins manage section perms" ON public.admin_section_permissions;
CREATE POLICY "super admins manage section perms"
  ON public.admin_section_permissions FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Admins can read their own section permissions (for the access-control hook)
DROP POLICY IF EXISTS "users read own section perms" ON public.admin_section_permissions;
CREATE POLICY "users read own section perms"
  ON public.admin_section_permissions FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "super admins manage partner assignments" ON public.admin_partner_assignments;
CREATE POLICY "super admins manage partner assignments"
  ON public.admin_partner_assignments FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "users read own partner assignments" ON public.admin_partner_assignments;
CREATE POLICY "users read own partner assignments"
  ON public.admin_partner_assignments FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1));
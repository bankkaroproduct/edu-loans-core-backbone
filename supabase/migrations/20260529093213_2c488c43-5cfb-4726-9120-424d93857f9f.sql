
-- Backfill: give every current admin/super_admin Full Access to calendar
INSERT INTO public.admin_section_permissions (user_id, section, access_level)
SELECT u.id, 'calendar'::public.admin_section_key, 'full'::public.admin_access_level
FROM public.users u
WHERE u.role IN ('admin', 'super_admin')
  AND u.is_active = true
  AND u.terminated_at IS NULL
ON CONFLICT (user_id, section) DO NOTHING;

-- Update access function: calendar defaults to 'full' instead of 'hidden'
CREATE OR REPLACE FUNCTION public.get_admin_section_access(_auth_id uuid, _section admin_section_key)
 RETURNS admin_access_level
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_is_super boolean;
  v_active boolean;
  v_terminated timestamptz;
  v_role public.app_role;
  v_level public.admin_access_level;
BEGIN
  SELECT id, is_super_admin, is_active, terminated_at, role
    INTO v_user_id, v_is_super, v_active, v_terminated, v_role
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
  IF v_level IS NOT NULL THEN
    RETURN v_level;
  END IF;
  -- Calendar defaults to 'full' for any active admin without an explicit row
  IF _section = 'calendar'::public.admin_section_key AND v_role IN ('admin','super_admin') THEN
    RETURN 'full'::public.admin_access_level;
  END IF;
  RETURN 'hidden'::public.admin_access_level;
END $function$;

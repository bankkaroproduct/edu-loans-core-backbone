CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  linked_user public.users%ROWTYPE;
BEGIN
  SELECT *
  INTO linked_user
  FROM public.users
  WHERE lower(email) = lower(NEW.email)
    AND (auth_user_id IS NULL OR auth_user_id = NEW.id)
  ORDER BY CASE WHEN auth_user_id = NEW.id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  IF linked_user.id IS NOT NULL THEN
    UPDATE public.users
    SET auth_user_id = NEW.id,
        email = COALESCE(NEW.email, linked_user.email),
        full_name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), linked_user.full_name),
        updated_at = now()
    WHERE id = linked_user.id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (linked_user.id, linked_user.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.users (auth_user_id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
      'partner_agent'
    )
    RETURNING * INTO linked_user;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (linked_user.id, linked_user.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
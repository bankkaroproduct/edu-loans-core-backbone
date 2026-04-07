
-- Create a trigger function to auto-create a users row when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'partner_agent'
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, u.role FROM public.users u WHERE u.auth_user_id = NEW.id
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Add unique constraint on auth_user_id to prevent duplicates
ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);

-- Link the existing auth user raghav@cashkaro.com to users table
INSERT INTO public.users (auth_user_id, email, full_name, role)
VALUES (
  '431953c1-21ee-4678-a9e9-4869a9715b3c',
  'raghav@cashkaro.com',
  'Raghav',
  'super_admin'
)
ON CONFLICT (auth_user_id) DO NOTHING;

-- Also add to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.users WHERE auth_user_id = '431953c1-21ee-4678-a9e9-4869a9715b3c'
ON CONFLICT (user_id, role) DO NOTHING;

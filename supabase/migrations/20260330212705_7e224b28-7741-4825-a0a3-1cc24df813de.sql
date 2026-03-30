
-- Insert missing profiles for users that exist in auth.users but not in profiles
INSERT INTO public.profiles (id, tenant_id, full_name)
VALUES 
  ('3f7de88c-fdff-415a-96b9-ccbe86872929', '00000000-0000-0000-0000-000000000001', 'Harold Admin'),
  ('c0b0be0e-4c65-4c52-a820-5079750e1e09', 'adbb0b2a-b23f-4caf-a43f-52e2a8a72e1c', 'Jose luis pascual')
ON CONFLICT (id) DO NOTHING;

-- Recreate the trigger on auth.users to auto-create profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, tenant_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data ->> 'tenant_id')::UUID,
      (SELECT id FROM public.tenants LIMIT 1)
    ),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::app_role,
    'viewer'
  ));

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

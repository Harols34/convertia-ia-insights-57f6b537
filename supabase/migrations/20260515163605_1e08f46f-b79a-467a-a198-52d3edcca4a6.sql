CREATE OR REPLACE FUNCTION public.search_shareable_users(search_term text)
RETURNS TABLE (id uuid, full_name text, avatar_url text, tenant_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, t.name as tenant_name
  FROM public.profiles p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.is_active = true
    AND p.id <> auth.uid()
    AND (
      search_term IS NULL
      OR search_term = ''
      OR p.full_name ILIKE '%' || search_term || '%'
    )
  ORDER BY p.full_name
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_shareable_users(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(user_ids uuid[])
RETURNS TABLE (id uuid, full_name text, avatar_url text, tenant_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, t.name as tenant_name
  FROM public.profiles p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.id = ANY(user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids(uuid[]) TO authenticated;
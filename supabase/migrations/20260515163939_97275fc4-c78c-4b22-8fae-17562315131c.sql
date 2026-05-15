INSERT INTO public.profiles (id, tenant_id, full_name, is_active, created_at, updated_at)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'tenant_id','')::uuid,
    (SELECT uta.tenant_id FROM public.user_tenant_access uta WHERE uta.user_id = u.id LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  ) as tenant_id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1), 'Usuario') as full_name,
  true as is_active,
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND u.email <> 'noop@telegram.local'
ON CONFLICT (id) DO NOTHING;
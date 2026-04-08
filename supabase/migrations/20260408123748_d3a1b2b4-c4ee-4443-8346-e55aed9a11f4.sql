CREATE OR REPLACE FUNCTION public.get_accessible_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tids uuid[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  IF public.has_role(_user_id, 'super_admin') THEN
    SELECT COALESCE(array_agg(t.id ORDER BY t.id), ARRAY[]::uuid[])
    INTO tids
    FROM public.tenants t
    WHERE COALESCE(t.is_active, true);

    RETURN COALESCE(tids, ARRAY[]::uuid[]);
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x.tid ORDER BY x.tid), ARRAY[]::uuid[])
  INTO tids
  FROM (
    SELECT p.tenant_id AS tid
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.tenant_id IS NOT NULL

    UNION

    SELECT p.active_tenant_id AS tid
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.active_tenant_id IS NOT NULL

    UNION

    SELECT u.tenant_id AS tid
    FROM public.user_tenant_access u
    WHERE u.user_id = _user_id
  ) x
  WHERE x.tid IS NOT NULL;

  RETURN COALESCE(tids, ARRAY[]::uuid[]);
END;
$$;

INSERT INTO public.profiles (id, tenant_id, full_name, active_tenant_id, is_active)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data ->> 'tenant_id', '')::uuid,
    (
      SELECT uta.tenant_id
      FROM public.user_tenant_access uta
      WHERE uta.user_id = u.id
      ORDER BY uta.created_at ASC
      LIMIT 1
    ),
    (
      SELECT t.id
      FROM public.tenants t
      WHERE COALESCE(t.is_active, true)
      ORDER BY t.created_at ASC
      LIMIT 1
    )
  ) AS tenant_id,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), NULLIF(u.email, ''), 'Usuario') AS full_name,
  NULL,
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'role', '')::public.app_role, 'viewer'::public.app_role)
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = u.id
);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS analytics_boards_select_own ON public.analytics_user_boards;
DROP POLICY IF EXISTS analytics_boards_insert_own ON public.analytics_user_boards;
DROP POLICY IF EXISTS analytics_boards_update_own ON public.analytics_user_boards;
DROP POLICY IF EXISTS analytics_boards_delete_own ON public.analytics_user_boards;

CREATE POLICY analytics_boards_select_accessible
ON public.analytics_user_boards
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
);

CREATE POLICY analytics_boards_insert_accessible
ON public.analytics_user_boards
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
);

CREATE POLICY analytics_boards_update_accessible
ON public.analytics_user_boards
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
)
WITH CHECK (
  user_id = auth.uid()
  AND tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
);

CREATE POLICY analytics_boards_delete_accessible
ON public.analytics_user_boards
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
);

DROP POLICY IF EXISTS analytics_widgets_all_own_board ON public.analytics_board_widgets;

CREATE POLICY analytics_widgets_all_accessible_board
ON public.analytics_board_widgets
FOR ALL
TO authenticated
USING (
  board_id IN (
    SELECT b.id
    FROM public.analytics_user_boards b
    WHERE b.user_id = auth.uid()
      AND b.tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
  )
)
WITH CHECK (
  board_id IN (
    SELECT b.id
    FROM public.analytics_user_boards b
    WHERE b.user_id = auth.uid()
      AND b.tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
  )
);
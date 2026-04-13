
-- 1) tenant_data_sources: drop the broad SELECT and replace with a scoped one
DROP POLICY IF EXISTS "Authenticated view active data sources" ON public.tenant_data_sources;

CREATE POLICY "Authenticated view active data sources"
ON public.tenant_data_sources
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'tenant_admin'::app_role)
    OR allow_dashboards = true
    OR allow_reports = true
    OR allow_chatbots = true
  )
);

-- 2) user_custom_roles: add INSERT policy for admins scoped to their tenant
CREATE POLICY "Admin insert user custom roles"
ON public.user_custom_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      has_role(auth.uid(), 'tenant_admin'::app_role)
      AND custom_role_id IN (
        SELECT cr.id FROM public.custom_roles cr
        WHERE cr.tenant_id = get_user_tenant(auth.uid())
      )
    )
  )
);

-- 3) user_custom_roles: add DELETE policy for admins scoped to their tenant
CREATE POLICY "Admin delete user custom roles"
ON public.user_custom_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'tenant_admin'::app_role)
    AND custom_role_id IN (
      SELECT cr.id FROM public.custom_roles cr
      WHERE cr.tenant_id = get_user_tenant(auth.uid())
    )
  )
);

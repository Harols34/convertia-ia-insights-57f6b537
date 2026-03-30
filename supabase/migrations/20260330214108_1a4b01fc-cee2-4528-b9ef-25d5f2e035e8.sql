-- Fix: Let users view ALL tenants they have access to, not just the active one
DROP POLICY IF EXISTS "Users view own tenant" ON public.tenants;
CREATE POLICY "Users view accessible tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id = ANY(get_accessible_tenant_ids(auth.uid())));
-- Allow super_admin to insert tenants
CREATE POLICY "Super admin insert tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to update tenants
CREATE POLICY "Super admin update tenants"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- Allow super_admin to view ALL tenants (not just their own)
CREATE POLICY "Super admin view all tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));
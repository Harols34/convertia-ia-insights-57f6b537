-- 1) Super admin puede leer cualquier perfil (listados multi-tenant, edición de usuarios)
DROP POLICY IF EXISTS "Superadmin select all profiles" ON public.profiles;
CREATE POLICY "Superadmin select all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 2) Sustituir política UPDATE única por dos: super_admin sin restricción de tenant en el nuevo
--    fila; tenant_admin solo si el perfil sigue perteneciendo a su tenant (antes y después).
DROP POLICY IF EXISTS "Admins update tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admin update profiles same tenant" ON public.profiles;

CREATE POLICY "Superadmin update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admin update profiles same tenant"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'tenant_admin')
    AND tenant_id = public.get_user_tenant(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'tenant_admin')
    AND tenant_id = public.get_user_tenant(auth.uid())
  );

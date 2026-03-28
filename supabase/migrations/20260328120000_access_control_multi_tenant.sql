-- Multi-cuenta (session tenant), permisos por módulo, bots solo super_admin

-- 1) Perfil: tenant activo (sesión) opcional
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.active_tenant_id IS 'Cuenta activa para RLS; debe estar en tenant "home" o en user_tenant_access.';

-- 2) Acceso explícito a cuentas adicionales (además del tenant del perfil)
CREATE TABLE IF NOT EXISTS public.user_tenant_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_access_tenant ON public.user_tenant_access(tenant_id);

ALTER TABLE public.user_tenant_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tenant_access_select"
  ON public.user_tenant_access FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "user_tenant_access_write"
  ON public.user_tenant_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "user_tenant_access_delete"
  ON public.user_tenant_access FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3) get_user_tenant: respeta cuenta activa válida
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  home uuid;
  active uuid;
BEGIN
  SELECT p.tenant_id, p.active_tenant_id INTO home, active
  FROM public.profiles p
  WHERE p.id = _user_id;

  IF home IS NULL THEN
    RETURN NULL;
  END IF;

  IF active IS NOT NULL THEN
    IF active = home THEN
      RETURN active;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.user_tenant_access u
      WHERE u.user_id = _user_id AND u.tenant_id = active
    ) THEN
      RETURN active;
    END IF;
  END IF;

  RETURN home;
END;
$$;

-- 4) Cuentas accesibles para un usuario
CREATE OR REPLACE FUNCTION public.get_accessible_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.tid ORDER BY x.tid), ARRAY[]::uuid[])
  FROM (
    SELECT p.tenant_id AS tid FROM public.profiles p WHERE p.id = _user_id
    UNION
    SELECT u.tenant_id AS tid FROM public.user_tenant_access u WHERE u.user_id = _user_id
  ) x;
$$;

-- 5) Cambiar cuenta activa (validado)
CREATE OR REPLACE FUNCTION public.set_active_tenant(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  home uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT tenant_id INTO home FROM public.profiles WHERE id = uid;

  IF _tenant_id IS NULL THEN
    UPDATE public.profiles SET active_tenant_id = NULL WHERE id = uid;
    RETURN;
  END IF;

  IF _tenant_id = home THEN
    UPDATE public.profiles SET active_tenant_id = _tenant_id WHERE id = uid;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_tenant_access WHERE user_id = uid AND tenant_id = _tenant_id) THEN
    UPDATE public.profiles SET active_tenant_id = _tenant_id WHERE id = uid;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Sin acceso a esta cuenta';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accessible_tenant_ids(uuid) TO authenticated;

-- 6) Módulo Cuentas (Tenants) si falta
INSERT INTO public.modules (name, slug, description, sort_order, is_active)
VALUES ('Cuentas (Tenants)', 'cuentas', 'Administración de cuentas / tenants', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- 7) Permiso "view" por módulo
INSERT INTO public.permissions (module_id, action, description)
SELECT m.id, 'view', 'Acceso al módulo'
FROM public.modules m
WHERE m.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.module_id = m.id AND p.action = 'view'
  );

-- 8) Semilla role_permissions (idempotente)
-- super_admin: todos los permisos view
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin'::public.app_role, p.id
FROM public.permissions p
WHERE p.action = 'view'
ON CONFLICT (role, permission_id) DO NOTHING;

-- tenant_admin: todos excepto módulo cuentas (solo super)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'tenant_admin'::public.app_role, p.id
FROM public.permissions p
JOIN public.modules m ON m.id = p.module_id
WHERE p.action = 'view' AND m.slug <> 'cuentas'
ON CONFLICT (role, permission_id) DO NOTHING;

-- manager: amplio (sin cuentas, roles, auditoría)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::public.app_role, p.id
FROM public.permissions p
JOIN public.modules m ON m.id = p.module_id
WHERE p.action = 'view'
  AND m.slug IN (
    'dashboard', 'dashboards-ia', 'analytics', 'reportes', 'exportaciones',
    'bots', 'integraciones', 'usuarios', 'configuracion', 'soporte'
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- analyst
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'analyst'::public.app_role, p.id
FROM public.permissions p
JOIN public.modules m ON m.id = p.module_id
WHERE p.action = 'view'
  AND m.slug IN (
    'dashboard', 'dashboards-ia', 'analytics', 'reportes', 'exportaciones',
    'bots', 'integraciones', 'soporte', 'configuracion'
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- operator
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'operator'::public.app_role, p.id
FROM public.permissions p
JOIN public.modules m ON m.id = p.module_id
WHERE p.action = 'view'
  AND m.slug IN (
    'dashboard', 'dashboards-ia', 'analytics', 'reportes', 'exportaciones',
    'bots', 'soporte', 'configuracion'
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- viewer: lectura básica (sin bots, usuarios, roles, auditoría, integraciones, cuentas)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer'::public.app_role, p.id
FROM public.permissions p
JOIN public.modules m ON m.id = p.module_id
WHERE p.action = 'view'
  AND m.slug IN (
    'dashboard', 'dashboards-ia', 'analytics', 'reportes', 'exportaciones',
    'soporte', 'configuracion'
  )
ON CONFLICT (role, permission_id) DO NOTHING;

-- 9) RPC: slugs de módulos accesibles para el usuario actual
CREATE OR REPLACE FUNCTION public.get_my_accessible_module_slugs()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  slugs text[];
BEGIN
  IF uid IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF public.has_role(uid, 'super_admin') THEN
    SELECT COALESCE(array_agg(m.slug ORDER BY m.sort_order), ARRAY[]::text[])
    INTO slugs
    FROM public.modules m
    WHERE m.is_active = true;
    RETURN slugs;
  END IF;

  WITH eff AS (
    SELECT rp.permission_id
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = uid
    UNION
    SELECT crp.permission_id
    FROM public.user_custom_roles ucr
    JOIN public.custom_role_permissions crp ON crp.custom_role_id = ucr.custom_role_id
    WHERE ucr.user_id = uid
    UNION
    SELECT up.permission_id
    FROM public.user_permissions up
    WHERE up.user_id = uid AND up.granted = true
  ),
  denied AS (
    SELECT up.permission_id
    FROM public.user_permissions up
    WHERE up.user_id = uid AND up.granted = false
  )
  SELECT COALESCE(array_agg(DISTINCT m.slug ORDER BY m.slug), ARRAY[]::text[])
  INTO slugs
  FROM eff e
  JOIN public.permissions p ON p.id = e.permission_id AND p.action = 'view'
  JOIN public.modules m ON m.id = p.module_id AND m.is_active = true
  WHERE NOT EXISTS (SELECT 1 FROM denied d WHERE d.permission_id = e.permission_id);

  RETURN COALESCE(slugs, ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_accessible_module_slugs() TO authenticated;

-- 10) Bots: crear/editar/eliminar solo super_admin (uso del módulo sigue con permisos view)
DROP POLICY IF EXISTS "Insert tenant bots" ON public.bots;
DROP POLICY IF EXISTS "Update tenant bots" ON public.bots;
DROP POLICY IF EXISTS "Delete tenant bots" ON public.bots;

CREATE POLICY "Insert tenant bots superadmin"
  ON public.bots FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Update tenant bots superadmin"
  ON public.bots FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Delete tenant bots superadmin"
  ON public.bots FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND public.has_role(auth.uid(), 'super_admin')
  );

-- 11) Permitir a super_admin insertar/actualizar/borrar role_permissions (SELECT sigue abierto)
CREATE POLICY "Superadmin insert role_permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Superadmin update role_permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Superadmin delete role_permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

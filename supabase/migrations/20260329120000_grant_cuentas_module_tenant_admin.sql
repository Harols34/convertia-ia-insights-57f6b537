-- Permitir ver el módulo «cuentas» a administradores de tenant (y manager).
-- RLS en public.tenants sigue limitando datos: solo super_admin ve/edita todas las cuentas.
INSERT INTO public.role_permissions (role, permission_id)
SELECT r.role, p.id
FROM public.permissions p
JOIN public.modules m ON m.id = p.module_id
CROSS JOIN (
  SELECT unnest(ARRAY['tenant_admin', 'manager']::public.app_role[]) AS role
) r
WHERE p.action = 'view' AND m.slug = 'cuentas' AND m.is_active = true
ON CONFLICT (role, permission_id) DO NOTHING;

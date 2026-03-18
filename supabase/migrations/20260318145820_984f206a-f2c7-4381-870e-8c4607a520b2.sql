
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tenant_admin', 'manager', 'analyst', 'operator', 'viewer');

-- Tenants table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0ea5e9',
  plan TEXT NOT NULL DEFAULT 'growth' CHECK (plan IN ('enterprise', 'pro', 'growth')),
  timezone TEXT DEFAULT 'America/Mexico_City',
  language TEXT DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Modules table
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

-- Permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  UNIQUE (module_id, action)
);

-- Role permissions (which permissions each role gets)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE (role, permission_id)
);

-- Custom roles per tenant
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- Custom role permissions
CREATE TABLE public.custom_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE (custom_role_id, permission_id)
);

-- User custom role assignments
CREATE TABLE public.user_custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, custom_role_id)
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT,
  detail JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

-- RLS Policies
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants: users can only see their own tenant
CREATE POLICY "Users view own tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.get_user_tenant(auth.uid()));

-- Profiles: users see profiles in their tenant
CREATE POLICY "Users view tenant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- User roles: viewable by tenant admins
CREATE POLICY "View user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'tenant_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Modules: all authenticated users can view
CREATE POLICY "View modules" ON public.modules
  FOR SELECT TO authenticated USING (true);

-- Permissions: all authenticated users can view
CREATE POLICY "View permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- Role permissions: all authenticated can view
CREATE POLICY "View role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Custom roles: tenant members can view
CREATE POLICY "View custom roles" ON public.custom_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Custom role permissions: tenant members can view
CREATE POLICY "View custom role perms" ON public.custom_role_permissions
  FOR SELECT TO authenticated
  USING (
    custom_role_id IN (
      SELECT id FROM public.custom_roles WHERE tenant_id = public.get_user_tenant(auth.uid())
    )
  );

-- User custom roles: viewable by self or admin
CREATE POLICY "View user custom roles" ON public.user_custom_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'tenant_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Audit logs: tenant members can view
CREATE POLICY "View audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Insert audit logs
CREATE POLICY "Insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

-- Seed default modules
INSERT INTO public.modules (name, slug, icon, sort_order) VALUES
  ('Dashboard Ejecutivo', 'dashboard', 'LayoutDashboard', 1),
  ('Dashboards con IA', 'dashboards-ia', 'Brain', 2),
  ('Analytics Conversacional', 'analytics', 'MessageSquare', 3),
  ('Reportes', 'reportes', 'FileBarChart', 4),
  ('Exportaciones', 'exportaciones', 'Download', 5),
  ('Chatbots / AI Agents', 'bots', 'Bot', 6),
  ('Integraciones', 'integraciones', 'Plug', 7),
  ('Usuarios', 'usuarios', 'Users', 8),
  ('Roles y Permisos', 'roles', 'ShieldCheck', 9),
  ('Auditoría y Logs', 'auditoria', 'ScrollText', 10),
  ('Configuración', 'configuracion', 'Settings', 11),
  ('Soporte', 'soporte', 'HelpCircle', 12);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

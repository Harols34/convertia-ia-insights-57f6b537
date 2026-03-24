
-- 1. Dashboard messages table for per-message persistence
CREATE TABLE IF NOT EXISTS public.dashboard_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.dashboard_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text',
  structured jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_messages_session ON public.dashboard_messages(session_id);

CREATE POLICY "View own session messages" ON public.dashboard_messages
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM public.dashboard_sessions WHERE user_id = auth.uid()));

CREATE POLICY "Insert own session messages" ON public.dashboard_messages
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (SELECT id FROM public.dashboard_sessions WHERE user_id = auth.uid()));

-- 2. Add UPDATE policy to dashboard_sessions + status column
ALTER TABLE public.dashboard_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

CREATE POLICY "Update own sessions" ON public.dashboard_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 3. Tenant data sources for Integraciones module
CREATE TABLE IF NOT EXISTS public.tenant_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text DEFAULT 'general',
  is_active boolean DEFAULT false,
  allow_dashboards boolean DEFAULT false,
  allow_reports boolean DEFAULT false,
  allow_chatbots boolean DEFAULT false,
  allow_joins boolean DEFAULT false,
  allow_cross_analysis boolean DEFAULT false,
  priority int DEFAULT 0,
  restrictions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE POLICY "Superadmin full access data sources" ON public.tenant_data_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated view active data sources" ON public.tenant_data_sources
  FOR SELECT TO authenticated
  USING (is_active = true);

INSERT INTO public.tenant_data_sources (table_name, display_name, description, category, is_active, allow_dashboards, allow_reports, allow_chatbots)
VALUES ('leads', 'Leads', 'Tabla principal de leads y gestión comercial', 'comercial', true, true, true, true)
ON CONFLICT (table_name) DO NOTHING;

-- 4. Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_tenant ON public.support_tickets(tenant_id);

CREATE POLICY "View tenant tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Insert tenant tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Update tenant tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

-- 5. Ticket comments
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_internal boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE POLICY "View ticket comments" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM public.support_tickets WHERE tenant_id = public.get_user_tenant(auth.uid())));

CREATE POLICY "Insert ticket comments" ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (SELECT id FROM public.support_tickets WHERE tenant_id = public.get_user_tenant(auth.uid())));

-- 6. User permissions for per-user overrides
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

CREATE POLICY "Admins view user permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'));

CREATE POLICY "Superadmin manage user permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 7. System settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text DEFAULT 'general',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key)
);

CREATE POLICY "View tenant settings" ON public.system_settings
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Admins manage settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'));

-- 8. Delete tenants policy for super_admin
CREATE POLICY "Super admin delete tenants" ON public.tenants
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 9. Admin role management policies for user_roles
CREATE POLICY "Superadmin manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admin manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'));

-- 10. Custom roles management
CREATE POLICY "Superadmin manage custom roles" ON public.custom_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Superadmin manage custom role perms" ON public.custom_role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 11. Bot conversations update policy
CREATE POLICY "Update own conversations" ON public.bot_conversations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 12. Profiles insert for admin user creation
CREATE POLICY "Superadmin insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'tenant_admin'));

-- 13. Admin manage profiles
CREATE POLICY "Admins update tenant profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR (public.has_role(auth.uid(), 'tenant_admin') AND tenant_id = public.get_user_tenant(auth.uid())));

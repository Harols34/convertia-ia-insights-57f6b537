
-- Bots table
CREATE TABLE public.bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp', 'telegram', 'webchat')),
  system_prompt TEXT DEFAULT 'Eres un asistente inteligente de análisis de datos.',
  model TEXT DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  n8n_workflow_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bot conversations
CREATE TABLE public.bot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bot messages
CREATE TABLE public.bot_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.bot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard sessions
CREATE TABLE public.dashboard_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  result JSONB DEFAULT '{}'::jsonb,
  title TEXT DEFAULT 'Sin título',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exports
CREATE TABLE public.exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('pdf', 'xlsx', 'csv', 'pptx')),
  source_module TEXT,
  file_name TEXT,
  file_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies for bots
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View tenant bots" ON public.bots FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Insert tenant bots" ON public.bots FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Update tenant bots" ON public.bots FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Delete tenant bots" ON public.bots FOR DELETE TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));

-- RLS for bot_conversations
ALTER TABLE public.bot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View tenant conversations" ON public.bot_conversations FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Insert tenant conversations" ON public.bot_conversations FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Delete tenant conversations" ON public.bot_conversations FOR DELETE TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));

-- RLS for bot_messages
ALTER TABLE public.bot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View conversation messages" ON public.bot_messages FOR SELECT TO authenticated USING (
  conversation_id IN (SELECT id FROM public.bot_conversations WHERE tenant_id = get_user_tenant(auth.uid()))
);
CREATE POLICY "Insert conversation messages" ON public.bot_messages FOR INSERT TO authenticated WITH CHECK (
  conversation_id IN (SELECT id FROM public.bot_conversations WHERE tenant_id = get_user_tenant(auth.uid()))
);

-- RLS for dashboard_sessions
ALTER TABLE public.dashboard_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View tenant sessions" ON public.dashboard_sessions FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Insert tenant sessions" ON public.dashboard_sessions FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Delete tenant sessions" ON public.dashboard_sessions FOR DELETE TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));

-- RLS for exports
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View tenant exports" ON public.exports FOR SELECT TO authenticated USING (tenant_id = get_user_tenant(auth.uid()));
CREATE POLICY "Insert tenant exports" ON public.exports FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

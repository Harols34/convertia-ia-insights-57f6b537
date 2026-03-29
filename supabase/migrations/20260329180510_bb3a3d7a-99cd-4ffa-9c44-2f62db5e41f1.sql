
-- =====================================================
-- MULTI-TENANT RLS: Allow users to SELECT from ALL accessible tenants
-- Keep INSERT/UPDATE/DELETE scoped to get_user_tenant for writes
-- =====================================================

-- 1) LEADS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View tenant leads" ON public.leads;
CREATE POLICY "View accessible tenant leads" ON public.leads
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 2) AUDIT_LOGS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View audit logs" ON public.audit_logs;
CREATE POLICY "View accessible audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 3) DASHBOARD_SESSIONS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View tenant sessions" ON public.dashboard_sessions;
CREATE POLICY "View accessible tenant sessions" ON public.dashboard_sessions
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- INSERT: allow into any accessible tenant
DROP POLICY IF EXISTS "Insert tenant sessions" ON public.dashboard_sessions;
CREATE POLICY "Insert accessible tenant sessions" ON public.dashboard_sessions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- DELETE: allow for any accessible tenant
DROP POLICY IF EXISTS "Delete tenant sessions" ON public.dashboard_sessions;
CREATE POLICY "Delete accessible tenant sessions" ON public.dashboard_sessions
  FOR DELETE TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 4) BOT_CONVERSATIONS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View tenant conversations" ON public.bot_conversations;
CREATE POLICY "View accessible tenant conversations" ON public.bot_conversations
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Insert tenant conversations" ON public.bot_conversations;
CREATE POLICY "Insert accessible tenant conversations" ON public.bot_conversations
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Delete tenant conversations" ON public.bot_conversations;
CREATE POLICY "Delete accessible tenant conversations" ON public.bot_conversations
  FOR DELETE TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 5) BOT_MESSAGES: SELECT via accessible conversations
DROP POLICY IF EXISTS "View conversation messages" ON public.bot_messages;
CREATE POLICY "View accessible conversation messages" ON public.bot_messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (
    SELECT id FROM bot_conversations
    WHERE tenant_id = ANY(get_accessible_tenant_ids(auth.uid()))
  ));

DROP POLICY IF EXISTS "Insert conversation messages" ON public.bot_messages;
CREATE POLICY "Insert accessible conversation messages" ON public.bot_messages
  FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (
    SELECT id FROM bot_conversations
    WHERE tenant_id = ANY(get_accessible_tenant_ids(auth.uid()))
  ));

-- 6) BOTS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View tenant bots" ON public.bots;
CREATE POLICY "View accessible tenant bots" ON public.bots
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 7) EXPORTS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View tenant exports" ON public.exports;
CREATE POLICY "View accessible tenant exports" ON public.exports
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Insert tenant exports" ON public.exports;
CREATE POLICY "Insert accessible tenant exports" ON public.exports
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 8) SUPPORT_TICKETS: SELECT across all accessible tenants
DROP POLICY IF EXISTS "View tenant tickets" ON public.support_tickets;
CREATE POLICY "View accessible tenant tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Insert tenant tickets" ON public.support_tickets;
CREATE POLICY "Insert accessible tenant tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

DROP POLICY IF EXISTS "Update tenant tickets" ON public.support_tickets;
CREATE POLICY "Update accessible tenant tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 9) INSERT on leads: allow into any accessible tenant
DROP POLICY IF EXISTS "Insert tenant leads" ON public.leads;
CREATE POLICY "Insert accessible tenant leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 10) INSERT on audit_logs
DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY "Insert accessible audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 11) Update search_dashboard_sessions to work across all accessible tenants
CREATE OR REPLACE FUNCTION public.search_dashboard_sessions(
  _search_text text DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, title text, created_at timestamptz)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT s.id, s.title, s.created_at
  FROM dashboard_sessions s
  WHERE s.tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
    AND s.user_id = auth.uid()
    AND (s.status IS NULL OR s.status = 'active')
    AND (_date_from IS NULL OR (s.created_at AT TIME ZONE 'America/Santiago')::date >= _date_from)
    AND (_date_to IS NULL OR (s.created_at AT TIME ZONE 'America/Santiago')::date <= _date_to)
    AND (
      _search_text IS NULL
      OR btrim(_search_text) = ''
      OR s.title ILIKE '%' || btrim(_search_text) || '%'
      OR s.prompt ILIKE '%' || btrim(_search_text) || '%'
      OR EXISTS (
        SELECT 1 FROM dashboard_messages m
        WHERE m.session_id = s.id
          AND m.content ILIKE '%' || btrim(_search_text) || '%'
      )
    )
  ORDER BY s.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(_offset, 0);
$$;

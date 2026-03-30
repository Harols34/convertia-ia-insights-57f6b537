-- Bots: all authenticated users can see all bots
DROP POLICY IF EXISTS "View accessible tenant bots" ON public.bots;
CREATE POLICY "View all bots"
  ON public.bots FOR SELECT
  TO authenticated
  USING (true);

-- Bot conversations: all authenticated users can see all conversations (filtered by user_id in app)
DROP POLICY IF EXISTS "View accessible tenant conversations" ON public.bot_conversations;
CREATE POLICY "View all bot conversations"
  ON public.bot_conversations FOR SELECT
  TO authenticated
  USING (true);

-- Bot conversations insert: any authenticated user can create
DROP POLICY IF EXISTS "Insert accessible tenant conversations" ON public.bot_conversations;
CREATE POLICY "Insert bot conversations"
  ON public.bot_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Dashboard sessions: all authenticated can view all
DROP POLICY IF EXISTS "View accessible tenant sessions" ON public.dashboard_sessions;
CREATE POLICY "View all dashboard sessions"
  ON public.dashboard_sessions FOR SELECT
  TO authenticated
  USING (true);

-- Dashboard sessions insert: any authenticated
DROP POLICY IF EXISTS "Insert accessible tenant sessions" ON public.dashboard_sessions;
CREATE POLICY "Insert dashboard sessions"
  ON public.dashboard_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);
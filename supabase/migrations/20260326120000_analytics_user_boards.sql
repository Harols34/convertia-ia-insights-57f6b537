-- Tableros personales de Analytics (por usuario y tenant) + widgets guardados

CREATE TABLE IF NOT EXISTS public.analytics_user_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Mi tablero',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_boards_tenant_user
  ON public.analytics_user_boards (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS public.analytics_board_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.analytics_user_boards(id) ON DELETE CASCADE,
  widget_type text NOT NULL DEFAULT 'pivot',
  title text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  layout jsonb NOT NULL DEFAULT '{"x":0,"y":0,"w":6,"h":10,"minW":3,"minH":5}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_board_widgets_board ON public.analytics_board_widgets (board_id);

ALTER TABLE public.analytics_user_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_board_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_boards_select_own"
  ON public.analytics_user_boards FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "analytics_boards_insert_own"
  ON public.analytics_user_boards FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "analytics_boards_update_own"
  ON public.analytics_user_boards FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "analytics_boards_delete_own"
  ON public.analytics_user_boards FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "analytics_widgets_all_own_board"
  ON public.analytics_board_widgets FOR ALL TO authenticated
  USING (
    board_id IN (
      SELECT id FROM public.analytics_user_boards
      WHERE tenant_id = public.get_user_tenant(auth.uid())
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id FROM public.analytics_user_boards
      WHERE tenant_id = public.get_user_tenant(auth.uid())
        AND user_id = auth.uid()
    )
  );

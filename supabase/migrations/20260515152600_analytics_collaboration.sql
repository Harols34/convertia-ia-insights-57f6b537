-- ============================================================
-- Collaborative Dashboards: Share and edit boards across users
-- ============================================================

-- 1. Create analytics_board_shares table
CREATE TABLE IF NOT EXISTS public.analytics_board_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id uuid REFERENCES public.analytics_user_boards(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'edit' CHECK (access_level IN ('view', 'edit')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(board_id, user_id)
);

-- 2. Enable RLS
ALTER TABLE public.analytics_board_shares ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for analytics_board_shares
-- Only the owner of the board can manage shares
CREATE POLICY "Owners can manage board shares"
  ON public.analytics_board_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.analytics_user_boards
      WHERE id = analytics_board_shares.board_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Shared users can view their shares"
  ON public.analytics_board_shares
  FOR SELECT
  USING (user_id = auth.uid());

-- 4. Update RLS Policies for analytics_user_boards
-- We need to allow shared users to SELECT and UPDATE
DROP POLICY IF EXISTS "Users can view their own boards" ON public.analytics_user_boards;
CREATE POLICY "Users can view own or shared boards"
  ON public.analytics_user_boards
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.analytics_board_shares
      WHERE board_id = id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own boards" ON public.analytics_user_boards;
CREATE POLICY "Users can update own or shared boards with edit access"
  ON public.analytics_user_boards
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.analytics_board_shares
      WHERE board_id = id AND user_id = auth.uid() AND access_level = 'edit'
    )
  );

-- 5. Update RLS Policies for analytics_board_widgets
-- Widgets should be visible and editable if the parent board is visible and editable
DROP POLICY IF EXISTS "Users can view widgets of their boards" ON public.analytics_board_widgets;
CREATE POLICY "Users can view widgets of own or shared boards"
  ON public.analytics_board_widgets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analytics_user_boards
      WHERE id = board_id AND (
        user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM public.analytics_board_shares
          WHERE board_id = analytics_user_boards.id AND user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage widgets of their boards" ON public.analytics_board_widgets;
CREATE POLICY "Users can manage widgets of own or shared boards with edit access"
  ON public.analytics_board_widgets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.analytics_user_boards
      WHERE id = board_id AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.analytics_board_shares
          WHERE board_id = analytics_user_boards.id AND user_id = auth.uid() AND access_level = 'edit'
        )
      )
    )
  );

-- 6. Grant permissions
GRANT ALL ON public.analytics_board_shares TO authenticated;
GRANT ALL ON public.analytics_board_shares TO service_role;

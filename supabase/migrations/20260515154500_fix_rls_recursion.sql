-- ============================================================
-- Fix Infinite Recursion in RLS Policies (V2 - Corrected)
-- ============================================================

-- 1. Create a security definer function to check board ownership without triggering RLS loops
CREATE OR REPLACE FUNCTION public.check_board_ownership(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.analytics_user_boards
    WHERE id = p_board_id AND user_id = p_user_id
  );
END;
$$;

-- 2. Create a security definer function to check board access
CREATE OR REPLACE FUNCTION public.check_board_access(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.analytics_user_boards
    WHERE id = p_board_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.analytics_board_shares
    WHERE board_id = p_board_id AND user_id = p_user_id
  );
END;
$$;

-- 3. Update policies for analytics_board_shares using the function
DROP POLICY IF EXISTS "Owners can manage board shares" ON public.analytics_board_shares;
CREATE POLICY "Owners can manage board shares"
  ON public.analytics_board_shares
  FOR ALL
  USING (
    public.check_board_ownership(board_id, auth.uid())
  );

-- 4. Update policies for analytics_user_boards using the function
DROP POLICY IF EXISTS "Users can view own or shared boards" ON public.analytics_user_boards;
CREATE POLICY "Users can view own or shared boards"
  ON public.analytics_user_boards
  FOR SELECT
  USING (
    public.check_board_access(id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own or shared boards with edit access" ON public.analytics_user_boards;
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

-- 5. Update policies for analytics_board_widgets to use the access function
-- Nota: La tabla analytics_board_widgets NO tiene user_id, usa board_id
DROP POLICY IF EXISTS "Users can view widgets of own or shared boards" ON public.analytics_board_widgets;
CREATE POLICY "Users can view widgets of own or shared boards"
  ON public.analytics_board_widgets
  FOR SELECT
  USING (
    public.check_board_access(board_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage widgets of own or shared boards with edit access" ON public.analytics_board_widgets;
CREATE POLICY "Users can manage widgets of own or shared boards with edit access"
  ON public.analytics_board_widgets
  FOR ALL
  USING (
    public.check_board_ownership(board_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.analytics_board_shares
      WHERE board_id = analytics_board_widgets.board_id AND user_id = auth.uid() AND access_level = 'edit'
    )
  );

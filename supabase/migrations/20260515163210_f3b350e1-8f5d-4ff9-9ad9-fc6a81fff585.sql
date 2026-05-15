DO $$
DECLARE
  target_user uuid := '7b2b5b38-a6a4-4e87-a24b-69c597e80f63';
BEGIN
  DELETE FROM public.analytics_board_shares s
  USING public.analytics_user_boards b
  WHERE s.board_id = b.id
    AND b.user_id = target_user;

  DELETE FROM public.analytics_board_shares
  WHERE user_id = target_user;

  DELETE FROM public.analytics_board_widgets w
  USING public.analytics_user_boards b
  WHERE w.board_id = b.id
    AND b.user_id = target_user;

  DELETE FROM public.analytics_user_boards
  WHERE user_id = target_user;
END $$;
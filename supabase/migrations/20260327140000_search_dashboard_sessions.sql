-- Búsqueda de chats Dashboard IA: título, prompt y contenido de mensajes; paginación; filtro por fecha (Chile)

CREATE OR REPLACE FUNCTION public.search_dashboard_sessions(
  _search_text text DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, s.title, s.created_at
  FROM dashboard_sessions s
  WHERE s.tenant_id = public.get_user_tenant(auth.uid())
    AND s.user_id = auth.uid()
    AND (s.status IS NULL OR s.status = 'active')
    AND (
      _date_from IS NULL
      OR (s.created_at AT TIME ZONE 'America/Santiago')::date >= _date_from
    )
    AND (
      _date_to IS NULL
      OR (s.created_at AT TIME ZONE 'America/Santiago')::date <= _date_to
    )
    AND (
      _search_text IS NULL
      OR btrim(_search_text) = ''
      OR s.title ILIKE '%' || btrim(_search_text) || '%'
      OR s.prompt ILIKE '%' || btrim(_search_text) || '%'
      OR EXISTS (
        SELECT 1
        FROM dashboard_messages m
        WHERE m.session_id = s.id
          AND m.content ILIKE '%' || btrim(_search_text) || '%'
      )
    )
  ORDER BY s.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(_offset, 0);
$$;

COMMENT ON FUNCTION public.search_dashboard_sessions(text, date, date, int, int) IS
  'Lista sesiones del usuario con búsqueda por título/prompt/mensajes y rango de fechas (día en America/Santiago).';

GRANT EXECUTE ON FUNCTION public.search_dashboard_sessions(text, date, date, int, int) TO authenticated;

-- Metadatos de columnas para dashboards dinámicos (Integraciones).
-- Solo tablas registradas, activas y con allow_dashboards.

CREATE OR REPLACE FUNCTION public.list_integration_table_columns(p_table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  udt_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_table_name IS NULL OR p_table_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Nombre de tabla no válido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_data_sources t
    WHERE lower(t.table_name) = lower(p_table_name)
      AND t.is_active = true
      AND coalesce(t.allow_dashboards, false) = true
  ) THEN
    RAISE EXCEPTION 'La tabla no está habilitada para dashboards o no está activa';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = lower(p_table_name)
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION 'La tabla no existe en el esquema public';
  END IF;

  RETURN QUERY
  SELECT
    a.attname::text AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod)::text AS data_type,
    ty.typname::text AS udt_name
  FROM pg_catalog.pg_attribute a
  JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
  JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
  JOIN pg_catalog.pg_type ty ON a.atttypid = ty.oid
  WHERE n.nspname = 'public'
    AND c.relname = lower(p_table_name)
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum;
END;
$$;

REVOKE ALL ON FUNCTION public.list_integration_table_columns(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_integration_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_integration_table_columns(text) TO service_role;

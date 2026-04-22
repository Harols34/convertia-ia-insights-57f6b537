CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_creacion_desc ON public.leads (tenant_id, fch_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_negocio_desc ON public.leads (tenant_id, fch_negocio DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_agente_prim_gestion ON public.leads (tenant_id, agente_prim_gestion);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_campana_mkt ON public.leads (tenant_id, campana_mkt);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_ciudad ON public.leads (tenant_id, ciudad);

CREATE OR REPLACE FUNCTION public.accessible_leads_timeseries(
  _metric text DEFAULT 'leads',
  _granularity text DEFAULT 'day',
  _limit integer DEFAULT 90,
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _date_field text DEFAULT 'fch_creacion',
  _filters jsonb DEFAULT NULL,
  _match_column text DEFAULT NULL,
  _match_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  df text;
  fw text;
  bucket_expr text;
  metric_expr text;
  match_filter text := '';
  r json;
  safe_limit integer := GREATEST(1, LEAST(COALESCE(_limit, 90), 366));
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  CASE _granularity
    WHEN 'day' THEN bucket_expr := format('%I::date', df);
    WHEN 'week' THEN bucket_expr := format('date_trunc(''week'', %I)::date', df);
    WHEN 'month' THEN bucket_expr := format('date_trunc(''month'', %I)::date', df);
    ELSE RAISE EXCEPTION 'Granularidad no válida: %', _granularity;
  END CASE;

  IF _match_column IS NOT NULL AND _match_column <> '' THEN
    IF _match_column NOT IN (
      'agente_negocio','agente_prim_gestion','agente_ultim_gestion','campana_mkt','campana_inconcert',
      'tipo_llamada','ciudad','categoria_mkt','result_negocio','result_prim_gestion','result_ultim_gestion',
      'prim_resultado_marcadora','bpo','cliente','keyword','email','id_lead','id_llave'
    ) THEN
      RAISE EXCEPTION 'Columna match no válida: %', _match_column;
    END IF;

    match_filter := CASE
      WHEN _match_token IS NULL OR _match_token = '' THEN ''
      WHEN _match_token = '__vacío__' THEN format(' AND COALESCE(%I, '''') = ''''', _match_column)
      ELSE format(' AND COALESCE(%I, '''') = %L', _match_column, _match_token)
    END;
  END IF;

  CASE _metric
    WHEN 'leads' THEN metric_expr := 'COUNT(*)::bigint';
    WHEN 'ventas' THEN metric_expr := 'COUNT(*) FILTER (WHERE es_venta)::bigint';
    WHEN 'efectividad' THEN metric_expr := 'ROUND((COUNT(*) FILTER (WHERE es_venta))::numeric / NULLIF(COUNT(*),0) * 100, 2)';
    WHEN 'contactados' THEN metric_expr := 'COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL)::bigint';
    WHEN 'negocios' THEN metric_expr := 'COUNT(*) FILTER (WHERE fch_negocio IS NOT NULL)::bigint';
    WHEN 'match_count' THEN
      IF _match_column IS NULL OR _match_column = '' THEN
        RAISE EXCEPTION 'match_column es requerido para metric=match_count';
      END IF;
      metric_expr := 'COUNT(*)::bigint';
    ELSE
      RAISE EXCEPTION 'Métrica no válida: %', _metric;
  END CASE;

  EXECUTE format(
    'SELECT COALESCE(json_agg(x ORDER BY x.bucket), ''[]''::json)
     FROM (
       SELECT %1$s AS bucket,
              %2$s AS value
       FROM public.leads
       WHERE tenant_id = ANY($1)
         AND ($2::date IS NULL OR %3$I::date >= $2)
         AND ($3::date IS NULL OR %3$I::date <= $3)%4$s%5$s
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT $4
     ) x',
    bucket_expr,
    metric_expr,
    df,
    fw,
    match_filter
  ) USING tids, _fecha_desde, _fecha_hasta, safe_limit INTO r;

  RETURN COALESCE(r, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_funnel(
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _date_field text DEFAULT 'fch_creacion',
  _filters jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  df text;
  fw text;
  r json;
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  EXECUTE format(
    'SELECT json_build_object(
      ''total'', COUNT(*)::bigint,
      ''con_prim_gestion'', COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL)::bigint,
      ''con_ultim_gestion'', COUNT(*) FILTER (WHERE fch_ultim_gestion IS NOT NULL)::bigint,
      ''con_negocio'', COUNT(*) FILTER (WHERE fch_negocio IS NOT NULL)::bigint,
      ''ventas'', COUNT(*) FILTER (WHERE es_venta)::bigint,
      ''tasa_contacto'', ROUND((COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL))::numeric / NULLIF(COUNT(*),0) * 100, 2),
      ''tasa_negocio'', ROUND((COUNT(*) FILTER (WHERE fch_negocio IS NOT NULL))::numeric / NULLIF(COUNT(*),0) * 100, 2),
      ''tasa_conversion'', ROUND((COUNT(*) FILTER (WHERE es_venta))::numeric / NULLIF(COUNT(*),0) * 100, 2)
    )
    FROM public.leads
    WHERE tenant_id = ANY($1)
      AND ($2::date IS NULL OR %1$I::date >= $2)
      AND ($3::date IS NULL OR %1$I::date <= $3)%2$s',
    df,
    fw
  ) USING tids, _fecha_desde, _fecha_hasta INTO r;

  RETURN COALESCE(r, '{}'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_weekday_metrics(
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _date_field text DEFAULT 'fch_creacion',
  _filters jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  df text;
  fw text;
  sql_text text;
  r json;
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  sql_text := format(
    'SELECT COALESCE(json_agg(x ORDER BY x.iso_day), ''[]''::json)
     FROM (
       SELECT
         EXTRACT(ISODOW FROM %1$I)::int AS iso_day,
         CASE EXTRACT(ISODOW FROM %1$I)::int
           WHEN 1 THEN ''Lun''
           WHEN 2 THEN ''Mar''
           WHEN 3 THEN ''Mié''
           WHEN 4 THEN ''Jue''
           WHEN 5 THEN ''Vie''
           WHEN 6 THEN ''Sáb''
           ELSE ''Dom''
         END AS day,
         COUNT(*)::bigint AS count
       FROM public.leads
       WHERE tenant_id = ANY($1)
         AND %1$I IS NOT NULL
         AND ($2::date IS NULL OR %1$I::date >= $2)
         AND ($3::date IS NULL OR %1$I::date <= $3)%2$s
       GROUP BY 1,2
     ) x',
    df,
    fw
  );

  EXECUTE sql_text USING tids, _fecha_desde, _fecha_hasta INTO r;
  RETURN COALESCE(r, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_agent_metrics(
  _field text DEFAULT 'agente_prim_gestion',
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _limit integer DEFAULT 12,
  _date_field text DEFAULT 'fch_creacion',
  _filters jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  df text;
  fw text;
  fe text;
  ff text;
  r json;
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  CASE _field
    WHEN 'agente_prim_gestion' THEN fe := 'agente_prim_gestion'; ff := 'agente_prim_gestion IS NOT NULL AND agente_prim_gestion <> ''''';
    WHEN 'agente_ultim_gestion' THEN fe := 'agente_ultim_gestion'; ff := 'agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion <> ''''';
    WHEN 'agente_negocio' THEN fe := 'agente_negocio'; ff := 'agente_negocio IS NOT NULL AND agente_negocio <> ''''';
    ELSE RAISE EXCEPTION 'Campo de agente no válido: %', _field;
  END CASE;

  EXECUTE format(
    'SELECT COALESCE(json_agg(x ORDER BY x.value DESC), ''[]''::json)
     FROM (
       SELECT %1$s AS name,
              COUNT(*)::bigint AS value,
              COUNT(*) FILTER (WHERE es_venta)::bigint AS ventas
       FROM public.leads
       WHERE tenant_id = ANY($1)
         AND ($2::date IS NULL OR %2$I::date >= $2)
         AND ($3::date IS NULL OR %2$I::date <= $3)
         AND %3$s%4$s
       GROUP BY 1
       ORDER BY 2 DESC
       LIMIT $4
     ) x',
    fe,
    df,
    ff,
    fw
  ) USING tids, _fecha_desde, _fecha_hasta, GREATEST(1, LEAST(COALESCE(_limit, 12), 50)) INTO r;

  RETURN COALESCE(r, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.analytics_dimension_values(
  p_table_name text,
  p_field text,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_date_granularity text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  hidden_cols text[];
  is_allowed boolean;
  is_date_field boolean;
  value_expr text;
  search_sql text := '';
  r json;
BEGIN
  IF p_table_name IS NULL OR p_table_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Nombre de tabla no válido';
  END IF;
  IF p_field IS NULL OR p_field !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Campo no válido';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_data_sources t
    WHERE lower(t.table_name) = lower(p_table_name)
      AND t.is_active = true
      AND coalesce(t.allow_dashboards, false) = true
  ) INTO is_allowed;

  IF NOT is_allowed THEN
    RAISE EXCEPTION 'La tabla no está habilitada para dashboards';
  END IF;

  SELECT coalesce(
    array(
      SELECT jsonb_array_elements_text(coalesce(t.restrictions -> 'hidden_columns', '[]'::jsonb))
      FROM public.tenant_data_sources t
      WHERE lower(t.table_name) = lower(p_table_name)
      LIMIT 1
    ),
    array[]::text[]
  ) INTO hidden_cols;

  IF p_field = ANY(hidden_cols)
     AND NOT public.has_role(auth.uid(), 'super_admin')
     AND NOT public.has_role(auth.uid(), 'tenant_admin') THEN
    RAISE EXCEPTION 'Campo no disponible';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = lower(p_table_name)
      AND a.attname = p_field
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) THEN
    RAISE EXCEPTION 'Campo no existe en la tabla';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_catalog.pg_type ty ON a.atttypid = ty.oid
    WHERE n.nspname = 'public'
      AND c.relname = lower(p_table_name)
      AND a.attname = p_field
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND (
        ty.typname IN ('date','timestamp','timestamptz')
        OR pg_catalog.format_type(a.atttypid, a.atttypmod) ILIKE 'timestamp%'
      )
  ) INTO is_date_field;

  IF is_date_field THEN
    CASE COALESCE(p_date_granularity, 'month')
      WHEN 'day' THEN value_expr := format('to_char(%I::date, ''YYYY-MM-DD'')', p_field);
      WHEN 'week' THEN value_expr := format('to_char(date_trunc(''week'', %I), ''YYYY-MM-DD'')', p_field);
      WHEN 'month' THEN value_expr := format('to_char(date_trunc(''month'', %I), ''YYYY-MM-DD'')', p_field);
      WHEN 'year' THEN value_expr := format('to_char(date_trunc(''year'', %I), ''YYYY-MM-DD'')', p_field);
      ELSE RAISE EXCEPTION 'Granularidad de fecha no válida';
    END CASE;
  ELSE
    value_expr := format('NULLIF(TRIM(%I::text), '''')', p_field);
  END IF;

  IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
    search_sql := format(' WHERE COALESCE(v.value, ''(vacío)'') ILIKE %L', '%' || btrim(p_search) || '%');
  END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(x.value ORDER BY x.sort_value), ''[]''::json)
     FROM (
       SELECT COALESCE(v.value, ''(vacío)'') AS value,
              CASE WHEN v.value IS NULL OR v.value = ''(vacío)'' THEN ''~~~~'' ELSE v.value END AS sort_value
       FROM (
         SELECT DISTINCT %1$s AS value
         FROM public.%2$I
       ) v%3$s
       ORDER BY 2
       LIMIT %4$s
     ) x',
    value_expr,
    lower(p_table_name),
    search_sql,
    GREATEST(1, LEAST(COALESCE(p_limit, 200), 500))
  ) INTO r;

  RETURN COALESCE(r, '[]'::json);
END;
$$;
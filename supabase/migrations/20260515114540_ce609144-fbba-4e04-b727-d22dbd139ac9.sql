CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_id_live
ON public.leads (tenant_id, fch_creacion ASC, id ASC);

CREATE OR REPLACE FUNCTION public._leads_filter_clause(_filters jsonb, _alias text DEFAULT 'l')
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  item record;
  allowed_cols text[] := ARRAY[
    'agente_negocio','agente_prim_gestion','agente_ultim_gestion',
    'campana_mkt','campana_inconcert','tipo_llamada','ciudad','categoria_mkt',
    'result_negocio','result_prim_gestion','result_ultim_gestion',
    'prim_resultado_marcadora','bpo','cliente','keyword','email','id_lead','id_llave','es_venta'
  ];
  out_sql text := '';
  arr text[];
  token text;
  normalized text[];
  qalias text := CASE WHEN _alias IS NULL OR btrim(_alias) = '' THEN '' ELSE format('%I.', _alias) END;
BEGIN
  IF _filters IS NULL OR _filters = 'null'::jsonb OR _filters = '{}'::jsonb THEN
    RETURN '';
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(_filters) LOOP
    IF NOT (item.key = ANY(allowed_cols)) THEN
      CONTINUE;
    END IF;

    IF item.key = 'es_venta' THEN
      IF jsonb_typeof(item.value) = 'boolean' THEN
        out_sql := out_sql || format(' AND %ses_venta IS NOT DISTINCT FROM %L::boolean', qalias, item.value::text);
      ELSIF jsonb_typeof(item.value) = 'string' AND item.value #>> '{}' IN ('true','false') THEN
        out_sql := out_sql || format(' AND %ses_venta IS NOT DISTINCT FROM %L::boolean', qalias, item.value #>> '{}');
      END IF;
      CONTINUE;
    END IF;

    IF jsonb_typeof(item.value) = 'array' THEN
      arr := ARRAY(SELECT jsonb_array_elements_text(item.value));
    ELSIF jsonb_typeof(item.value) IN ('string','number','boolean') THEN
      arr := ARRAY[item.value #>> '{}'];
    ELSE
      CONTINUE;
    END IF;

    normalized := ARRAY[]::text[];
    FOREACH token IN ARRAY arr LOOP
      IF token IS NOT NULL AND btrim(token) <> '' THEN
        normalized := normalized || token;
      END IF;
    END LOOP;

    IF coalesce(array_length(normalized, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    out_sql := out_sql || ' AND (';
    FOR i IN 1..array_length(normalized, 1) LOOP
      IF i > 1 THEN out_sql := out_sql || ' OR '; END IF;
      IF normalized[i] = '__vacío__' THEN
        out_sql := out_sql || format('COALESCE(%s%I, '''') = ''''', qalias, item.key);
      ELSE
        out_sql := out_sql || format('COALESCE(%s%I, '''') = %L', qalias, item.key, normalized[i]);
      END IF;
    END LOOP;
    out_sql := out_sql || ')';
  END LOOP;

  RETURN out_sql;
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_daily_metrics(
  _fecha_desde date DEFAULT NULL::date,
  _fecha_hasta date DEFAULT NULL::date,
  _filters jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(dia date, leads bigint, ventas bigint, contactados bigint, gestionados bigint, no_gestionados bigint, abandonos bigint, total_ttf_min numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  fw text := public._leads_filter_clause(_filters, 'l');
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT
       l.fch_creacion::date AS dia,
       COUNT(*)::bigint AS leads,
       COUNT(*) FILTER (WHERE l.es_venta)::bigint AS ventas,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NOT NULL OR l.prim_resultado_marcadora IN (''CONNECTED'',''FINISHED'',''Closed''))::bigint AS contactados,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NOT NULL)::bigint AS gestionados,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NULL)::bigint AS no_gestionados,
       COUNT(*) FILTER (WHERE l.prim_resultado_marcadora = ''ABANDONED'')::bigint AS abandonos,
       COALESCE(SUM(EXTRACT(EPOCH FROM (l.fch_prim_gestion - l.fch_creacion)) / 60) FILTER (WHERE l.fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM (l.fch_prim_gestion - l.fch_creacion)) BETWEEN 0 AND 2592000), 0)::numeric AS total_ttf_min
     FROM public.leads l
     WHERE l.tenant_id = ANY($1)
       AND ($2::date IS NULL OR l.fch_creacion::date >= $2)
       AND ($3::date IS NULL OR l.fch_creacion::date <= $3)%s
     GROUP BY 1
     ORDER BY 1 ASC',
    fw
  ) USING tids, _fecha_desde, _fecha_hasta;
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_hourly_metrics(
  _fecha_desde date DEFAULT NULL::date,
  _fecha_hasta date DEFAULT NULL::date,
  _filters jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(hora timestamp with time zone, leads bigint, ventas bigint, contactados bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  fw text := public._leads_filter_clause(_filters, 'l');
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT
       date_trunc(''hour'', l.fch_creacion) AS hora,
       COUNT(*)::bigint AS leads,
       COUNT(*) FILTER (WHERE l.es_venta)::bigint AS ventas,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NOT NULL OR l.prim_resultado_marcadora IN (''CONNECTED'',''FINISHED'',''Closed''))::bigint AS contactados
     FROM public.leads l
     WHERE l.tenant_id = ANY($1)
       AND ($2::date IS NULL OR l.fch_creacion::date >= $2)
       AND ($3::date IS NULL OR l.fch_creacion::date <= $3)%s
     GROUP BY 1
     ORDER BY 1 ASC',
    fw
  ) USING tids, _fecha_desde, _fecha_hasta;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_strategic_bi_scorecard(
  _tenant_id uuid,
  _fecha_desde date,
  _fecha_hasta date,
  _filters jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  curr record;
  prev record;
  prev_start date := _fecha_desde - (_fecha_hasta - _fecha_desde + 1);
  prev_end date := _fecha_desde - 1;
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  fw text := public._leads_filter_clause(_filters, 'l');
BEGIN
  EXECUTE format(
    'SELECT
       COUNT(*)::bigint AS leads,
       COUNT(*) FILTER (WHERE l.es_venta)::bigint AS ventas,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NOT NULL OR l.prim_resultado_marcadora IN (''CONNECTED'',''FINISHED'',''Closed''))::bigint AS contactados,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NOT NULL)::bigint AS gestionados,
       COUNT(*) FILTER (WHERE l.fch_prim_gestion IS NULL)::bigint AS no_gestionados,
       COUNT(*) FILTER (WHERE l.prim_resultado_marcadora = ''ABANDONED'')::bigint AS abandonos,
       ROUND((AVG(EXTRACT(EPOCH FROM (l.fch_prim_gestion - l.fch_creacion)) / 60) FILTER (WHERE l.fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM (l.fch_prim_gestion - l.fch_creacion)) BETWEEN 0 AND 2592000))::numeric, 2) AS avg_ttf_min
     FROM public.leads l
     WHERE l.tenant_id = ANY($1)
       AND l.fch_creacion::date >= $2
       AND l.fch_creacion::date <= $3%s',
    fw
  ) USING tids, _fecha_desde, _fecha_hasta INTO curr;

  EXECUTE format(
    'SELECT
       COUNT(*)::bigint AS leads,
       COUNT(*) FILTER (WHERE l.es_venta)::bigint AS ventas
     FROM public.leads l
     WHERE l.tenant_id = ANY($1)
       AND l.fch_creacion::date >= $2
       AND l.fch_creacion::date <= $3%s',
    fw
  ) USING tids, prev_start, prev_end INTO prev;

  RETURN json_build_object(
    'actual', json_build_object(
      'leads', COALESCE(curr.leads, 0),
      'ventas', COALESCE(curr.ventas, 0),
      'efectividad', ROUND(COALESCE(curr.ventas, 0)::numeric / NULLIF(COALESCE(curr.leads, 0), 0) * 100, 2),
      'contactabilidad', ROUND(COALESCE(curr.contactados, 0)::numeric / NULLIF(COALESCE(curr.leads, 0), 0) * 100, 2),
      'gestionados', COALESCE(curr.gestionados, 0),
      'no_gestionados', COALESCE(curr.no_gestionados, 0),
      'abandonos', COALESCE(curr.abandonos, 0),
      'avg_ttf_min', COALESCE(curr.avg_ttf_min, 0)
    ),
    'anterior', json_build_object(
      'leads', COALESCE(prev.leads, 0),
      'ventas', COALESCE(prev.ventas, 0)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_bi_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_hourly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_agent_daily;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accessible_leads_daily_metrics(date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_leads_hourly_metrics(date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_strategic_bi_scorecard(uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_bi_materialized_views() TO authenticated;

SELECT public.refresh_bi_materialized_views();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule('refresh-bi-materialized-views-every-15-minutes')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-bi-materialized-views-every-15-minutes');

    PERFORM cron.schedule(
      'refresh-bi-materialized-views-every-15-minutes',
      '*/15 * * * *',
      'SELECT public.refresh_bi_materialized_views();'
    );
  END IF;
END $$;
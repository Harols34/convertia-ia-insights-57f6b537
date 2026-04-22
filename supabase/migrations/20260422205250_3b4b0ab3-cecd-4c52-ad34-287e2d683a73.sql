CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_creacion ON public.leads (tenant_id, fch_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_negocio ON public.leads (tenant_id, fch_negocio DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_prim_gestion ON public.leads (tenant_id, fch_prim_gestion DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_ultim_gestion ON public.leads (tenant_id, fch_ultim_gestion DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_fch_prim_resultado_marcadora ON public.leads (tenant_id, fch_prim_resultado_marcadora DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_campana_mkt ON public.leads (tenant_id, campana_mkt) WHERE campana_mkt IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_cliente ON public.leads (tenant_id, cliente) WHERE cliente IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_ciudad ON public.leads (tenant_id, ciudad) WHERE ciudad IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_bpo ON public.leads (tenant_id, bpo) WHERE bpo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_agente_negocio ON public.leads (tenant_id, agente_negocio) WHERE agente_negocio IS NOT NULL;

CREATE OR REPLACE FUNCTION public.accessible_leads_dimensions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  r json;
BEGIN
  SELECT json_build_object(
    'agentes_negocio', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT agente_negocio AS x FROM public.leads WHERE tenant_id = ANY(tids) AND agente_negocio IS NOT NULL AND agente_negocio <> '') s),
    'agentes_prim_gestion', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT agente_prim_gestion AS x FROM public.leads WHERE tenant_id = ANY(tids) AND agente_prim_gestion IS NOT NULL AND agente_prim_gestion <> '') s),
    'agentes_ultim_gestion', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT agente_ultim_gestion AS x FROM public.leads WHERE tenant_id = ANY(tids) AND agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion <> '') s),
    'campanas_mkt', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT campana_mkt AS x FROM public.leads WHERE tenant_id = ANY(tids) AND campana_mkt IS NOT NULL AND campana_mkt <> '') s),
    'campanas_inconcert', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT campana_inconcert AS x FROM public.leads WHERE tenant_id = ANY(tids) AND campana_inconcert IS NOT NULL AND campana_inconcert <> '') s),
    'tipos_llamada', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT tipo_llamada AS x FROM public.leads WHERE tenant_id = ANY(tids) AND tipo_llamada IS NOT NULL AND tipo_llamada <> '') s),
    'ciudades', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT ciudad AS x FROM public.leads WHERE tenant_id = ANY(tids) AND ciudad IS NOT NULL AND ciudad <> '') s),
    'resultados_negocio', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT result_negocio AS x FROM public.leads WHERE tenant_id = ANY(tids) AND result_negocio IS NOT NULL AND result_negocio <> '') s),
    'resultados_prim_gestion', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT result_prim_gestion AS x FROM public.leads WHERE tenant_id = ANY(tids) AND result_prim_gestion IS NOT NULL AND result_prim_gestion <> '') s),
    'resultados_ultim_gestion', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT result_ultim_gestion AS x FROM public.leads WHERE tenant_id = ANY(tids) AND result_ultim_gestion IS NOT NULL AND result_ultim_gestion <> '') s),
    'categorias_mkt', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT categoria_mkt AS x FROM public.leads WHERE tenant_id = ANY(tids) AND categoria_mkt IS NOT NULL AND categoria_mkt <> '') s),
    'prim_resultado_marcadora', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT prim_resultado_marcadora AS x FROM public.leads WHERE tenant_id = ANY(tids) AND prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora <> '') s),
    'clientes', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT cliente AS x FROM public.leads WHERE tenant_id = ANY(tids) AND cliente IS NOT NULL AND cliente <> '') s),
    'bpos', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT bpo AS x FROM public.leads WHERE tenant_id = ANY(tids) AND bpo IS NOT NULL AND bpo <> '') s),
    'rango_fechas', (SELECT json_build_object('desde', MIN(fch_creacion::date), 'hasta', MAX(fch_creacion::date)) FROM public.leads WHERE tenant_id = ANY(tids)),
    'campos_fecha', '["fch_creacion","fch_negocio","fch_prim_gestion","fch_ultim_gestion","fch_prim_resultado_marcadora"]'::json
  ) INTO r;

  RETURN COALESCE(r, '{}'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_kpis(
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
  r json;
  df text;
  fw text;
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  EXECUTE format(
    'SELECT json_build_object(
      ''total_leads'', COUNT(*)::bigint,
      ''total_ventas'', COUNT(*) FILTER (WHERE es_venta)::bigint,
      ''conv_pct'', ROUND((COUNT(*) FILTER (WHERE es_venta))::numeric / NULLIF(COUNT(*),0) * 100, 2),
      ''contactabilidad_marcadora_pct'', ROUND((COUNT(*) FILTER (WHERE prim_resultado_marcadora IN (''CONNECTED'',''FINISHED'')))::numeric / NULLIF(COUNT(*),0) * 100, 2),
      ''con_gestion'', COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL)::bigint,
      ''sin_gestion'', COUNT(*) FILTER (WHERE fch_prim_gestion IS NULL)::bigint,
      ''con_negocio'', COUNT(*) FILTER (WHERE fch_negocio IS NOT NULL)::bigint,
      ''fecha_min'', MIN(%1$I::date),
      ''fecha_max'', MAX(%1$I::date),
      ''dias_rango'', GREATEST(MAX(%1$I::date) - MIN(%1$I::date) + 1, 1),
      ''tasa_contacto_pct'', ROUND((COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL))::numeric / NULLIF(COUNT(*),0) * 100, 2),
      ''avg_resp_min'', ROUND((AVG(EXTRACT(EPOCH FROM (fch_prim_gestion - fch_creacion)) / 60) FILTER (WHERE fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM (fch_prim_gestion - fch_creacion)) BETWEEN 0 AND 2592000))::numeric, 1),
      ''avg_ciclo_min'', ROUND((AVG(EXTRACT(EPOCH FROM (fch_negocio - fch_creacion)) / 60) FILTER (WHERE fch_negocio IS NOT NULL AND EXTRACT(EPOCH FROM (fch_negocio - fch_creacion)) BETWEEN 0 AND 2592000))::numeric, 1)
    )
    FROM public.leads
    WHERE tenant_id = ANY($1)
      AND ($2::date IS NULL OR %1$I::date >= $2)
      AND ($3::date IS NULL OR %1$I::date <= $3)%2$s',
    df,
    fw
  ) USING tids, _fecha_desde, _fecha_hasta INTO r;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_group_metrics(
  _dimension text,
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _limit integer DEFAULT 50,
  _date_field text DEFAULT 'fch_creacion',
  _filters jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  de text;
  oe text;
  nf text;
  df text;
  fw text;
  r json;
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  CASE _dimension
    WHEN 'agente_negocio' THEN de := 'agente_negocio'; nf := 'agente_negocio IS NOT NULL AND agente_negocio <> ''''';
    WHEN 'agente_prim_gestion' THEN de := 'agente_prim_gestion'; nf := 'agente_prim_gestion IS NOT NULL AND agente_prim_gestion <> ''''';
    WHEN 'agente_ultim_gestion' THEN de := 'agente_ultim_gestion'; nf := 'agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion <> ''''';
    WHEN 'campana_mkt' THEN de := 'campana_mkt'; nf := 'campana_mkt IS NOT NULL AND campana_mkt <> ''''';
    WHEN 'campana_inconcert' THEN de := 'campana_inconcert'; nf := 'campana_inconcert IS NOT NULL AND campana_inconcert <> ''''';
    WHEN 'tipo_llamada' THEN de := 'tipo_llamada'; nf := 'tipo_llamada IS NOT NULL AND tipo_llamada <> ''''';
    WHEN 'ciudad' THEN de := 'ciudad'; nf := 'ciudad IS NOT NULL AND ciudad <> ''''';
    WHEN 'categoria_mkt' THEN de := 'categoria_mkt'; nf := 'categoria_mkt IS NOT NULL AND categoria_mkt <> ''''';
    WHEN 'result_negocio' THEN de := 'result_negocio'; nf := 'result_negocio IS NOT NULL AND result_negocio <> ''''';
    WHEN 'result_prim_gestion' THEN de := 'result_prim_gestion'; nf := 'result_prim_gestion IS NOT NULL AND result_prim_gestion <> ''''';
    WHEN 'result_ultim_gestion' THEN de := 'result_ultim_gestion'; nf := 'result_ultim_gestion IS NOT NULL AND result_ultim_gestion <> ''''';
    WHEN 'prim_resultado_marcadora' THEN de := 'prim_resultado_marcadora'; nf := 'prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora <> ''''';
    WHEN 'bpo' THEN de := 'COALESCE(bpo,''Sin BPO'')'; nf := 'TRUE';
    WHEN 'cliente' THEN de := 'COALESCE(cliente,''Sin cliente'')'; nf := 'TRUE';
    WHEN 'hora' THEN de := format('EXTRACT(HOUR FROM %I)::int', df); nf := format('%I IS NOT NULL', df);
    WHEN 'hora_negocio' THEN de := 'EXTRACT(HOUR FROM fch_negocio)::int'; nf := 'fch_negocio IS NOT NULL';
    WHEN 'fecha' THEN de := format('%I::date', df); nf := format('%I IS NOT NULL', df);
    WHEN 'fecha_negocio' THEN de := 'fch_negocio::date'; nf := 'fch_negocio IS NOT NULL';
    WHEN 'dia_semana' THEN de := format('TO_CHAR(%I,''Day'')', df); nf := format('%I IS NOT NULL', df);
    WHEN 'tramo_horario' THEN
      de := format('CASE WHEN EXTRACT(HOUR FROM %1$I)>=8 AND EXTRACT(HOUR FROM %1$I)<12 THEN ''Mañana(08-12)'' WHEN EXTRACT(HOUR FROM %1$I)>=12 AND EXTRACT(HOUR FROM %1$I)<15 THEN ''Mediodía(12-15)'' WHEN EXTRACT(HOUR FROM %1$I)>=15 AND EXTRACT(HOUR FROM %1$I)<19 THEN ''Tarde(15-19)'' WHEN EXTRACT(HOUR FROM %1$I)>=19 AND EXTRACT(HOUR FROM %1$I)<23 THEN ''Noche(19-23)'' ELSE ''Madrugada(00-08)'' END', df);
      nf := format('%I IS NOT NULL', df);
    ELSE RAISE EXCEPTION 'Dimensión no válida: %', _dimension;
  END CASE;

  IF _dimension IN ('hora','hora_negocio','fecha','fecha_negocio') THEN oe := 'dimension ASC';
  ELSIF _dimension = 'dia_semana' THEN oe := 'dimension ASC';
  ELSE oe := 'leads DESC'; END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(t ORDER BY %1$s), ''[]''::json) FROM (
      SELECT %2$s AS dimension,
        COUNT(*)::bigint AS leads,
        COUNT(*) FILTER (WHERE es_venta)::bigint AS ventas,
        COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL)::bigint AS contactados,
        COUNT(*) FILTER (WHERE fch_ultim_gestion IS NOT NULL)::bigint AS con_ultim_gestion,
        COUNT(*) FILTER (WHERE fch_negocio IS NOT NULL)::bigint AS con_negocio,
        ROUND((COUNT(*) FILTER (WHERE es_venta))::numeric / NULLIF(COUNT(*),0) * 100, 2) AS conv_pct,
        ROUND((COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL))::numeric / NULLIF(COUNT(*),0) * 100, 2) AS contactabilidad_pct,
        ROUND((COUNT(*) FILTER (WHERE fch_negocio IS NOT NULL))::numeric / NULLIF(COUNT(*),0) * 100, 2) AS tasa_negocio_pct,
        ROUND((COUNT(*) FILTER (WHERE prim_resultado_marcadora IN (''CONNECTED'',''FINISHED'')))::numeric / NULLIF(COUNT(*),0) * 100, 2) AS contactabilidad_marcadora_pct
      FROM public.leads
      WHERE tenant_id = ANY($1)
        AND ($2::date IS NULL OR %3$I::date >= $2)
        AND ($3::date IS NULL OR %3$I::date <= $3)
        AND %4$s%5$s
      GROUP BY %2$s
      ORDER BY %1$s
      LIMIT $4
    ) t',
    oe, de, df, nf, fw
  ) USING tids, _fecha_desde, _fecha_hasta, GREATEST(1, LEAST(COALESCE(_limit, 50), 500)) INTO r;

  RETURN COALESCE(r, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_agg_2d(
  _dim1 text,
  _dim2 text,
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _top_n integer DEFAULT 10,
  _date_field text DEFAULT 'fch_creacion',
  _filters jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d1e text;
  d2e text;
  d1f text;
  d2f text;
  df text;
  fw text;
  r json;
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
BEGIN
  df := public._date_field_expr(_date_field);
  fw := public._build_filters_where(_filters);

  CASE _dim1
    WHEN 'agente_negocio' THEN d1e := 'agente_negocio'; d1f := 'agente_negocio IS NOT NULL AND agente_negocio <> ''''';
    WHEN 'agente_prim_gestion' THEN d1e := 'agente_prim_gestion'; d1f := 'agente_prim_gestion IS NOT NULL AND agente_prim_gestion <> ''''';
    WHEN 'agente_ultim_gestion' THEN d1e := 'agente_ultim_gestion'; d1f := 'agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion <> ''''';
    WHEN 'campana_mkt' THEN d1e := 'campana_mkt'; d1f := 'campana_mkt IS NOT NULL AND campana_mkt <> ''''';
    WHEN 'campana_inconcert' THEN d1e := 'campana_inconcert'; d1f := 'campana_inconcert IS NOT NULL AND campana_inconcert <> ''''';
    WHEN 'tipo_llamada' THEN d1e := 'tipo_llamada'; d1f := 'tipo_llamada IS NOT NULL AND tipo_llamada <> ''''';
    WHEN 'ciudad' THEN d1e := 'ciudad'; d1f := 'ciudad IS NOT NULL AND ciudad <> ''''';
    WHEN 'categoria_mkt' THEN d1e := 'categoria_mkt'; d1f := 'categoria_mkt IS NOT NULL AND categoria_mkt <> ''''';
    WHEN 'result_negocio' THEN d1e := 'result_negocio'; d1f := 'result_negocio IS NOT NULL AND result_negocio <> ''''';
    WHEN 'result_prim_gestion' THEN d1e := 'result_prim_gestion'; d1f := 'result_prim_gestion IS NOT NULL AND result_prim_gestion <> ''''';
    WHEN 'prim_resultado_marcadora' THEN d1e := 'prim_resultado_marcadora'; d1f := 'prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora <> ''''';
    WHEN 'bpo' THEN d1e := 'COALESCE(bpo,''Sin BPO'')'; d1f := 'TRUE';
    WHEN 'cliente' THEN d1e := 'COALESCE(cliente,''Sin cliente'')'; d1f := 'TRUE';
    WHEN 'hora' THEN d1e := format('EXTRACT(HOUR FROM %I)::int', df); d1f := format('%I IS NOT NULL', df);
    WHEN 'fecha' THEN d1e := format('%I::date', df); d1f := format('%I IS NOT NULL', df);
    WHEN 'dia_semana' THEN d1e := format('TO_CHAR(%I,''Day'')', df); d1f := format('%I IS NOT NULL', df);
    ELSE RAISE EXCEPTION 'dim1 no válida: %', _dim1;
  END CASE;

  CASE _dim2
    WHEN 'agente_negocio' THEN d2e := 'agente_negocio'; d2f := 'agente_negocio IS NOT NULL AND agente_negocio <> ''''';
    WHEN 'agente_prim_gestion' THEN d2e := 'agente_prim_gestion'; d2f := 'agente_prim_gestion IS NOT NULL AND agente_prim_gestion <> ''''';
    WHEN 'agente_ultim_gestion' THEN d2e := 'agente_ultim_gestion'; d2f := 'agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion <> ''''';
    WHEN 'campana_mkt' THEN d2e := 'campana_mkt'; d2f := 'campana_mkt IS NOT NULL AND campana_mkt <> ''''';
    WHEN 'campana_inconcert' THEN d2e := 'campana_inconcert'; d2f := 'campana_inconcert IS NOT NULL AND campana_inconcert <> ''''';
    WHEN 'tipo_llamada' THEN d2e := 'tipo_llamada'; d2f := 'tipo_llamada IS NOT NULL AND tipo_llamada <> ''''';
    WHEN 'ciudad' THEN d2e := 'ciudad'; d2f := 'ciudad IS NOT NULL AND ciudad <> ''''';
    WHEN 'categoria_mkt' THEN d2e := 'categoria_mkt'; d2f := 'categoria_mkt IS NOT NULL AND categoria_mkt <> ''''';
    WHEN 'result_negocio' THEN d2e := 'result_negocio'; d2f := 'result_negocio IS NOT NULL AND result_negocio <> ''''';
    WHEN 'result_prim_gestion' THEN d2e := 'result_prim_gestion'; d2f := 'result_prim_gestion IS NOT NULL AND result_prim_gestion <> ''''';
    WHEN 'prim_resultado_marcadora' THEN d2e := 'prim_resultado_marcadora'; d2f := 'prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora <> ''''';
    WHEN 'bpo' THEN d2e := 'COALESCE(bpo,''Sin BPO'')'; d2f := 'TRUE';
    WHEN 'cliente' THEN d2e := 'COALESCE(cliente,''Sin cliente'')'; d2f := 'TRUE';
    WHEN 'hora' THEN d2e := format('EXTRACT(HOUR FROM %I)::int', df); d2f := format('%I IS NOT NULL', df);
    WHEN 'fecha' THEN d2e := format('%I::date', df); d2f := format('%I IS NOT NULL', df);
    WHEN 'dia_semana' THEN d2e := format('TO_CHAR(%I,''Day'')', df); d2f := format('%I IS NOT NULL', df);
    ELSE RAISE EXCEPTION 'dim2 no válida: %', _dim2;
  END CASE;

  EXECUTE format(
    'SELECT COALESCE(json_agg(t), ''[]''::json) FROM (
      SELECT %1$s AS dim1,
             %2$s AS dim2,
             COUNT(*)::bigint AS leads,
             COUNT(*) FILTER (WHERE es_venta)::bigint AS ventas,
             ROUND((COUNT(*) FILTER (WHERE es_venta))::numeric / NULLIF(COUNT(*),0) * 100, 2) AS conv_pct
      FROM public.leads
      WHERE tenant_id = ANY($1)
        AND ($2::date IS NULL OR %3$I::date >= $2)
        AND ($3::date IS NULL OR %3$I::date <= $3)
        AND %4$s AND %5$s%6$s
      GROUP BY %1$s, %2$s
      ORDER BY COUNT(*) DESC
      LIMIT $4
    ) t',
    d1e, d2e, df, d1f, d2f, fw
  ) USING tids, _fecha_desde, _fecha_hasta, GREATEST(1, LEAST(COALESCE(_top_n, 10), 50)) * GREATEST(1, LEAST(COALESCE(_top_n, 10), 50)) INTO r;

  RETURN COALESCE(r, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_report_page(
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 25,
  _search text DEFAULT NULL,
  _cliente text DEFAULT NULL,
  _bpo text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  cliente text,
  id_lead text,
  campana_mkt text,
  bpo text,
  ciudad text,
  result_prim_gestion text,
  result_negocio text,
  fch_creacion timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  v_page integer := GREATEST(COALESCE(_page, 1), 1);
  v_size integer := GREATEST(LEAST(COALESCE(_page_size, 25), 200), 1);
  v_offset integer := (GREATEST(COALESCE(_page, 1), 1) - 1) * GREATEST(LEAST(COALESCE(_page_size, 25), 200), 1);
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.cliente,
    l.id_lead,
    l.campana_mkt,
    l.bpo,
    l.ciudad,
    l.result_prim_gestion,
    l.result_negocio,
    l.fch_creacion,
    COUNT(*) OVER()::bigint AS total_count
  FROM public.leads l
  WHERE l.tenant_id = ANY(tids)
    AND (_cliente IS NULL OR l.cliente = _cliente)
    AND (_bpo IS NULL OR l.bpo = _bpo)
    AND (
      _search IS NULL OR btrim(_search) = '' OR
      COALESCE(l.cliente, '') ILIKE '%' || btrim(_search) || '%' OR
      COALESCE(l.id_lead, '') ILIKE '%' || btrim(_search) || '%' OR
      COALESCE(l.campana_mkt, '') ILIKE '%' || btrim(_search) || '%' OR
      COALESCE(l.bpo, '') ILIKE '%' || btrim(_search) || '%' OR
      COALESCE(l.ciudad, '') ILIKE '%' || btrim(_search) || '%' OR
      COALESCE(l.result_negocio, '') ILIKE '%' || btrim(_search) || '%'
    )
  ORDER BY l.fch_creacion DESC NULLS LAST, l.created_at DESC
  LIMIT v_size OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.accessible_leads_report_filters()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
  r json;
BEGIN
  SELECT json_build_object(
    'clientes', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT cliente AS x FROM public.leads WHERE tenant_id = ANY(tids) AND cliente IS NOT NULL AND cliente <> '') s),
    'bpos', (SELECT COALESCE(json_agg(x ORDER BY x), '[]'::json) FROM (SELECT DISTINCT bpo AS x FROM public.leads WHERE tenant_id = ANY(tids) AND bpo IS NOT NULL AND bpo <> '') s),
    'total_leads', (SELECT COUNT(*)::bigint FROM public.leads WHERE tenant_id = ANY(tids))
  ) INTO r;
  RETURN COALESCE(r, '{}'::json);
END;
$$;
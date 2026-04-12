
-- 1. bot_conversations: replace SELECT USING(true) with tenant-scoped
DROP POLICY IF EXISTS "View all bot conversations" ON bot_conversations;
CREATE POLICY "View accessible tenant conversations" ON bot_conversations
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 2. bot_conversations: replace INSERT WITH CHECK(true) with tenant-scoped
DROP POLICY IF EXISTS "Insert bot conversations" ON bot_conversations;
CREATE POLICY "Insert accessible tenant conversations" ON bot_conversations
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 3. dashboard_sessions: replace SELECT USING(true) with user+tenant scoped
DROP POLICY IF EXISTS "View all dashboard sessions" ON dashboard_sessions;
CREATE POLICY "View own accessible sessions" ON dashboard_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 4. dashboard_sessions: replace INSERT WITH CHECK(true) with tenant-scoped
DROP POLICY IF EXISTS "Insert dashboard sessions" ON dashboard_sessions;
CREATE POLICY "Insert accessible tenant sessions" ON dashboard_sessions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 5. bots: replace SELECT USING(true) with tenant-scoped
DROP POLICY IF EXISTS "View all bots" ON bots;
CREATE POLICY "View accessible tenant bots" ON bots
  FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_accessible_tenant_ids(auth.uid())));

-- 6. memory_analitycs: explicit deny-all (service_role only)
CREATE POLICY "Deny all for anon and authenticated" ON memory_analitycs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 7. Fix mutable search_path on remaining SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.execute_leads_query(_tenant_id uuid, _query text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  safe_query TEXT;
  result JSON;
BEGIN
  safe_query := TRIM(UPPER(_query));
  IF NOT (safe_query LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Solo se permiten queries SELECT';
  END IF;
  IF safe_query ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC)' THEN
    RAISE EXCEPTION 'Operación no permitida';
  END IF;
  EXECUTE format('SELECT json_agg(t) FROM (%s) t', _query) INTO result;
  RETURN COALESCE(result, '[]'::JSON);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_leads_kpis(_tenant_id uuid, _fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _date_field text DEFAULT 'fch_creacion'::text, _filters jsonb DEFAULT NULL::jsonb)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r JSON; df TEXT; fw TEXT;
BEGIN
  df:=_date_field_expr(_date_field); fw:=_build_filters_where(_filters);
  EXECUTE format('SELECT json_build_object(
    ''total_leads'',COUNT(*), ''total_ventas'',COUNT(*) FILTER(WHERE es_venta),
    ''conv_pct'',ROUND((COUNT(*) FILTER(WHERE es_venta))::NUMERIC/NULLIF(COUNT(*),0)*100,2),
    ''contactabilidad_marcadora_pct'',ROUND((COUNT(*) FILTER(WHERE prim_resultado_marcadora IN (''CONNECTED'',''FINISHED'')))::NUMERIC/NULLIF(COUNT(*),0)*100,2),
    ''con_gestion'',COUNT(*) FILTER(WHERE fch_prim_gestion IS NOT NULL),
    ''sin_gestion'',COUNT(*) FILTER(WHERE fch_prim_gestion IS NULL),
    ''con_negocio'',COUNT(*) FILTER(WHERE fch_negocio IS NOT NULL),
    ''fecha_min'',MIN(%I::DATE), ''fecha_max'',MAX(%I::DATE),
    ''dias_rango'',GREATEST(MAX(%I::DATE)-MIN(%I::DATE)+1,1),
    ''tasa_contacto_pct'',ROUND((COUNT(*) FILTER(WHERE fch_prim_gestion IS NOT NULL))::NUMERIC/NULLIF(COUNT(*),0)*100,2),
    ''avg_resp_min'',ROUND((AVG(EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion))/60) FILTER(
      WHERE fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1),
    ''avg_ciclo_min'',ROUND((AVG(EXTRACT(EPOCH FROM(fch_negocio-fch_creacion))/60) FILTER(
      WHERE fch_negocio IS NOT NULL AND EXTRACT(EPOCH FROM(fch_negocio-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1)
  ) FROM leads WHERE tenant_id=$1 AND($2::DATE IS NULL OR %I::DATE>=$2) AND($3::DATE IS NULL OR %I::DATE<=$3) %s',
  df,df,df,df,df,df,fw) USING _tenant_id,_fecha_desde,_fecha_hasta INTO r;
  RETURN r;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_leads_dimensions(_tenant_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r JSON;
BEGIN
  SELECT json_build_object(
    'agentes_negocio',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT agente_negocio x FROM leads WHERE tenant_id=_tenant_id AND agente_negocio IS NOT NULL AND agente_negocio!='')s),
    'agentes_prim_gestion',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT agente_prim_gestion x FROM leads WHERE tenant_id=_tenant_id AND agente_prim_gestion IS NOT NULL AND agente_prim_gestion!='')s),
    'agentes_ultim_gestion',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT agente_ultim_gestion x FROM leads WHERE tenant_id=_tenant_id AND agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion!='')s),
    'campanas_mkt',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT campana_mkt x FROM leads WHERE tenant_id=_tenant_id AND campana_mkt IS NOT NULL AND campana_mkt!='')s),
    'campanas_inconcert',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT campana_inconcert x FROM leads WHERE tenant_id=_tenant_id AND campana_inconcert IS NOT NULL AND campana_inconcert!='')s),
    'tipos_llamada',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT tipo_llamada x FROM leads WHERE tenant_id=_tenant_id AND tipo_llamada IS NOT NULL AND tipo_llamada!='')s),
    'ciudades',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT ciudad x FROM leads WHERE tenant_id=_tenant_id AND ciudad IS NOT NULL AND ciudad!='')s),
    'resultados_negocio',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT result_negocio x FROM leads WHERE tenant_id=_tenant_id AND result_negocio IS NOT NULL AND result_negocio!='')s),
    'resultados_prim_gestion',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT result_prim_gestion x FROM leads WHERE tenant_id=_tenant_id AND result_prim_gestion IS NOT NULL AND result_prim_gestion!='')s),
    'resultados_ultim_gestion',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT result_ultim_gestion x FROM leads WHERE tenant_id=_tenant_id AND result_ultim_gestion IS NOT NULL AND result_ultim_gestion!='')s),
    'categorias_mkt',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT categoria_mkt x FROM leads WHERE tenant_id=_tenant_id AND categoria_mkt IS NOT NULL AND categoria_mkt!='')s),
    'prim_resultado_marcadora',(SELECT COALESCE(json_agg(DISTINCT x ORDER BY x),'[]'::json) FROM(SELECT prim_resultado_marcadora x FROM leads WHERE tenant_id=_tenant_id AND prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora!='')s),
    'rango_fechas',(SELECT json_build_object('desde',MIN(fch_creacion::date),'hasta',MAX(fch_creacion::date)) FROM leads WHERE tenant_id=_tenant_id),
    'campos_fecha','["fch_creacion","fch_negocio","fch_prim_gestion","fch_ultim_gestion","fch_prim_resultado_marcadora"]'::json
  ) INTO r;
  RETURN r;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generar_analitica_dinamica(_tenant_id text, _agrupador text, _fecha_desde text DEFAULT NULL::text, _fecha_hasta text DEFAULT NULL::text, _campana_mkt text DEFAULT NULL::text, _agente_negocio text DEFAULT NULL::text)
 RETURNS TABLE(dimension text, total_leads bigint, total_ventas bigint, tasa_conversion numeric, tiempo_resp_min numeric, tiempo_ciclo_min numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    columna_agrupacion text := CASE 
        WHEN _agrupador = 'fecha' THEN 'DATE(fch_creacion)::text'
        ELSE format('%I', _agrupador)
    END;
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT 
            COALESCE(%s::text, ''Sin asignar'') as dimension,
            COUNT(*)::bigint as total_leads,
            COUNT(NULLIF(es_venta, false))::bigint as total_ventas,
            ROUND((COUNT(NULLIF(es_venta, false))::numeric / GREATEST(COUNT(*), 1)) * 100, 2) as tasa_conversion,
            ROUND(AVG(EXTRACT(EPOCH FROM (fch_prim_gestion - fch_creacion))/60)::numeric, 1) as tiempo_resp_min,
            ROUND(AVG(EXTRACT(EPOCH FROM (fch_negocio - fch_creacion))/60)::numeric, 1) as tiempo_ciclo_min
        FROM leads
        WHERE tenant_id = %L
          AND (%L IS NULL OR fch_creacion >= %L::timestamp)
          AND (%L IS NULL OR fch_creacion <= %L::timestamp)
          AND (%L IS NULL OR campana_mkt = %L)
          AND (%L IS NULL OR agente_negocio = %L)
        GROUP BY 1
        ORDER BY total_leads DESC
        LIMIT 100;
    ', columna_agrupacion, _tenant_id, _fecha_desde, _fecha_desde, _fecha_hasta, _fecha_hasta, _campana_mkt, _campana_mkt, _agente_negocio, _agente_negocio);
END;
$function$;

CREATE OR REPLACE FUNCTION public._build_filters_where(_f jsonb)
 RETURNS text LANGUAGE plpgsql SET search_path = public
AS $function$
DECLARE k TEXT; v TEXT; out TEXT:='';
  ok TEXT[]:=ARRAY['agente_negocio','agente_prim_gestion','agente_ultim_gestion',
    'campana_mkt','campana_inconcert','tipo_llamada','ciudad','categoria_mkt',
    'result_negocio','result_prim_gestion','result_ultim_gestion',
    'prim_resultado_marcadora','bpo','cliente'];
BEGIN
  IF _f IS NULL OR _f='null'::JSONB OR _f='{}'::JSONB THEN RETURN ''; END IF;
  FOR k,v IN SELECT * FROM jsonb_each_text(_f) LOOP
    IF k=ANY(ok) AND v IS NOT NULL AND v!='' THEN out:=out||format(' AND %I=%L',k,v); END IF;
  END LOOP;
  RETURN out;
END $function$;

CREATE OR REPLACE FUNCTION public._date_field_expr(_d text)
 RETURNS text LANGUAGE plpgsql SET search_path = public
AS $function$
BEGIN
  IF _d IN ('fch_creacion','fch_negocio','fch_prim_gestion','fch_ultim_gestion','fch_prim_resultado_marcadora') THEN RETURN _d; END IF;
  RETURN 'fch_creacion';
END $function$;

CREATE OR REPLACE FUNCTION public.leads_agg_1d(_tenant_id uuid, _dimension text, _fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _limit integer DEFAULT 50, _date_field text DEFAULT 'fch_creacion'::text, _filters jsonb DEFAULT NULL::jsonb)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE de TEXT; oe TEXT; nf TEXT; df TEXT; fw TEXT; r JSON;
BEGIN
  df:=_date_field_expr(_date_field); fw:=_build_filters_where(_filters);
  CASE _dimension
    WHEN 'agente_negocio'           THEN de:='agente_negocio';           nf:='agente_negocio IS NOT NULL AND agente_negocio!=''''';
    WHEN 'agente_prim_gestion'      THEN de:='agente_prim_gestion';      nf:='agente_prim_gestion IS NOT NULL AND agente_prim_gestion!=''''';
    WHEN 'agente_ultim_gestion'     THEN de:='agente_ultim_gestion';     nf:='agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion!=''''';
    WHEN 'campana_mkt'              THEN de:='campana_mkt';              nf:='campana_mkt IS NOT NULL AND campana_mkt!=''''';
    WHEN 'campana_inconcert'        THEN de:='campana_inconcert';        nf:='campana_inconcert IS NOT NULL AND campana_inconcert!=''''';
    WHEN 'tipo_llamada'             THEN de:='tipo_llamada';             nf:='tipo_llamada IS NOT NULL AND tipo_llamada!=''''';
    WHEN 'ciudad'                   THEN de:='ciudad';                   nf:='ciudad IS NOT NULL AND ciudad!=''''';
    WHEN 'categoria_mkt'            THEN de:='categoria_mkt';            nf:='categoria_mkt IS NOT NULL AND categoria_mkt!=''''';
    WHEN 'result_negocio'           THEN de:='result_negocio';           nf:='result_negocio IS NOT NULL AND result_negocio!=''''';
    WHEN 'result_prim_gestion'      THEN de:='result_prim_gestion';      nf:='result_prim_gestion IS NOT NULL AND result_prim_gestion!=''''';
    WHEN 'result_ultim_gestion'     THEN de:='result_ultim_gestion';     nf:='result_ultim_gestion IS NOT NULL AND result_ultim_gestion!=''''';
    WHEN 'prim_resultado_marcadora' THEN de:='prim_resultado_marcadora'; nf:='prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora!=''''';
    WHEN 'bpo'          THEN de:='COALESCE(bpo,''Sin BPO'')'; nf:='TRUE';
    WHEN 'hora'          THEN de:=format('EXTRACT(HOUR FROM %I)::INT',df);           nf:=format('%I IS NOT NULL',df);
    WHEN 'hora_negocio'  THEN de:='EXTRACT(HOUR FROM fch_negocio)::INT';             nf:='fch_negocio IS NOT NULL';
    WHEN 'fecha'         THEN de:=format('%I::DATE',df);                              nf:=format('%I IS NOT NULL',df);
    WHEN 'fecha_negocio' THEN de:='fch_negocio::DATE';                               nf:='fch_negocio IS NOT NULL';
    WHEN 'dia_semana'    THEN de:=format('TO_CHAR(%I,''Day'')',df);                   nf:=format('%I IS NOT NULL',df);
    WHEN 'tramo_horario' THEN
      de:=format('CASE WHEN EXTRACT(HOUR FROM %I)>=8 AND EXTRACT(HOUR FROM %I)<12 THEN ''Mañana(08-12)''
        WHEN EXTRACT(HOUR FROM %I)>=12 AND EXTRACT(HOUR FROM %I)<15 THEN ''Mediodía(12-15)''
        WHEN EXTRACT(HOUR FROM %I)>=15 AND EXTRACT(HOUR FROM %I)<19 THEN ''Tarde(15-19)''
        WHEN EXTRACT(HOUR FROM %I)>=19 AND EXTRACT(HOUR FROM %I)<23 THEN ''Noche(19-23)''
        ELSE ''Madrugada(00-08)'' END',df,df,df,df,df,df,df,df);
      nf:=format('%I IS NOT NULL',df);
    ELSE RAISE EXCEPTION 'Dimensión no válida: %',_dimension;
  END CASE;
  IF _dimension IN('hora','hora_negocio','fecha','fecha_negocio') THEN oe:='dimension ASC';
  ELSIF _dimension='dia_semana' THEN oe:=format('MIN(EXTRACT(ISODOW FROM %I)) ASC',df);
  ELSE oe:='leads DESC'; END IF;
  EXECUTE format('SELECT COALESCE(json_agg(t ORDER BY %s),''[]''::JSON) FROM(
    SELECT %s AS dimension,COUNT(*)::INT AS leads,
      (COUNT(*) FILTER(WHERE es_venta))::INT AS ventas,
      ROUND((COUNT(*) FILTER(WHERE es_venta))::NUMERIC/NULLIF(COUNT(*),0)*100,1) AS conv_pct
    FROM leads WHERE tenant_id=$1
      AND($2::DATE IS NULL OR %I::DATE>=$2) AND($3::DATE IS NULL OR %I::DATE<=$3)
      AND %s %s
    GROUP BY %s ORDER BY %s LIMIT $4)t',
    oe,de,df,df,nf,fw,de,oe
  ) USING _tenant_id,_fecha_desde,_fecha_hasta,_limit INTO r;
  RETURN COALESCE(r,'[]'::JSON);
END $function$;

CREATE OR REPLACE FUNCTION public.leads_agg_2d(_tenant_id uuid, _dim1 text, _dim2 text, _fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _top_n integer DEFAULT 10, _date_field text DEFAULT 'fch_creacion'::text, _filters jsonb DEFAULT NULL::jsonb)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE d1e TEXT;d2e TEXT;d1f TEXT;d2f TEXT;df TEXT;fw TEXT;r JSON;
BEGIN
  df:=_date_field_expr(_date_field); fw:=_build_filters_where(_filters);
  CASE _dim1
    WHEN 'agente_negocio'      THEN d1e:='agente_negocio';      d1f:='agente_negocio IS NOT NULL AND agente_negocio!=''''';
    WHEN 'agente_prim_gestion' THEN d1e:='agente_prim_gestion'; d1f:='agente_prim_gestion IS NOT NULL AND agente_prim_gestion!=''''';
    WHEN 'agente_ultim_gestion'THEN d1e:='agente_ultim_gestion';d1f:='agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion!=''''';
    WHEN 'campana_mkt'         THEN d1e:='campana_mkt';         d1f:='campana_mkt IS NOT NULL AND campana_mkt!=''''';
    WHEN 'campana_inconcert'   THEN d1e:='campana_inconcert';   d1f:='campana_inconcert IS NOT NULL AND campana_inconcert!=''''';
    WHEN 'tipo_llamada'        THEN d1e:='tipo_llamada';        d1f:='tipo_llamada IS NOT NULL AND tipo_llamada!=''''';
    WHEN 'ciudad'              THEN d1e:='ciudad';              d1f:='ciudad IS NOT NULL AND ciudad!=''''';
    WHEN 'categoria_mkt'       THEN d1e:='categoria_mkt';       d1f:='categoria_mkt IS NOT NULL AND categoria_mkt!=''''';
    WHEN 'result_negocio'      THEN d1e:='result_negocio';      d1f:='result_negocio IS NOT NULL AND result_negocio!=''''';
    WHEN 'result_prim_gestion' THEN d1e:='result_prim_gestion'; d1f:='result_prim_gestion IS NOT NULL AND result_prim_gestion!=''''';
    WHEN 'prim_resultado_marcadora' THEN d1e:='prim_resultado_marcadora'; d1f:='prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora!=''''';
    WHEN 'bpo'        THEN d1e:='COALESCE(bpo,''Sin BPO'')'; d1f:='TRUE';
    WHEN 'hora'       THEN d1e:=format('EXTRACT(HOUR FROM %I)::INT',df); d1f:=format('%I IS NOT NULL',df);
    WHEN 'fecha'      THEN d1e:=format('%I::DATE',df);                    d1f:=format('%I IS NOT NULL',df);
    WHEN 'dia_semana' THEN d1e:=format('TO_CHAR(%I,''Day'')',df);         d1f:=format('%I IS NOT NULL',df);
    ELSE RAISE EXCEPTION 'dim1 no válida: %',_dim1;
  END CASE;
  CASE _dim2
    WHEN 'agente_negocio'      THEN d2e:='agente_negocio';      d2f:='agente_negocio IS NOT NULL AND agente_negocio!=''''';
    WHEN 'agente_prim_gestion' THEN d2e:='agente_prim_gestion'; d2f:='agente_prim_gestion IS NOT NULL AND agente_prim_gestion!=''''';
    WHEN 'agente_ultim_gestion'THEN d2e:='agente_ultim_gestion';d2f:='agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion!=''''';
    WHEN 'campana_mkt'         THEN d2e:='campana_mkt';         d2f:='campana_mkt IS NOT NULL AND campana_mkt!=''''';
    WHEN 'campana_inconcert'   THEN d2e:='campana_inconcert';   d2f:='campana_inconcert IS NOT NULL AND campana_inconcert!=''''';
    WHEN 'tipo_llamada'        THEN d2e:='tipo_llamada';        d2f:='tipo_llamada IS NOT NULL AND tipo_llamada!=''''';
    WHEN 'ciudad'              THEN d2e:='ciudad';              d2f:='ciudad IS NOT NULL AND ciudad!=''''';
    WHEN 'categoria_mkt'       THEN d2e:='categoria_mkt';       d2f:='categoria_mkt IS NOT NULL AND categoria_mkt!=''''';
    WHEN 'result_negocio'      THEN d2e:='result_negocio';      d2f:='result_negocio IS NOT NULL AND result_negocio!=''''';
    WHEN 'result_prim_gestion' THEN d2e:='result_prim_gestion'; d2f:='result_prim_gestion IS NOT NULL AND result_prim_gestion!=''''';
    WHEN 'prim_resultado_marcadora' THEN d2e:='prim_resultado_marcadora'; d2f:='prim_resultado_marcadora IS NOT NULL AND prim_resultado_marcadora!=''''';
    WHEN 'bpo'        THEN d2e:='COALESCE(bpo,''Sin BPO'')'; d2f:='TRUE';
    WHEN 'hora'       THEN d2e:=format('EXTRACT(HOUR FROM %I)::INT',df); d2f:=format('%I IS NOT NULL',df);
    WHEN 'fecha'      THEN d2e:=format('%I::DATE',df);                    d2f:=format('%I IS NOT NULL',df);
    WHEN 'dia_semana' THEN d2e:=format('TO_CHAR(%I,''Day'')',df);         d2f:=format('%I IS NOT NULL',df);
    ELSE RAISE EXCEPTION 'dim2 no válida: %',_dim2;
  END CASE;
  EXECUTE format('SELECT COALESCE(json_agg(t),''[]''::JSON) FROM(
    SELECT %s AS dim1,%s AS dim2,COUNT(*)::INT AS leads,
      (COUNT(*) FILTER(WHERE es_venta))::INT AS ventas,
      ROUND((COUNT(*) FILTER(WHERE es_venta))::NUMERIC/NULLIF(COUNT(*),0)*100,1) AS conv_pct
    FROM leads WHERE tenant_id=$1
      AND($2::DATE IS NULL OR %I::DATE>=$2) AND($3::DATE IS NULL OR %I::DATE<=$3)
      AND %s AND %s %s
    GROUP BY %s,%s ORDER BY COUNT(*) DESC LIMIT $4)t',
    d1e,d2e,df,df,d1f,d2f,fw,d1e,d2e
  ) USING _tenant_id,_fecha_desde,_fecha_hasta,(_top_n*_top_n) INTO r;
  RETURN COALESCE(r,'[]'::JSON);
END $function$;

CREATE OR REPLACE FUNCTION public.leads_time_metrics(_tenant_id uuid, _group_by text DEFAULT NULL::text, _fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _date_field text DEFAULT 'fch_creacion'::text, _filters jsonb DEFAULT NULL::jsonb)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r JSON; ge TEXT; gf TEXT; df TEXT; fw TEXT;
BEGIN
  df:=_date_field_expr(_date_field); fw:=_build_filters_where(_filters);
  IF _group_by IS NULL THEN
    EXECUTE format('SELECT json_build_object(
      ''n'',COUNT(*), ''con_gestion'',COUNT(*) FILTER(WHERE fch_prim_gestion IS NOT NULL),
      ''tasa_contacto_pct'',ROUND((COUNT(*) FILTER(WHERE fch_prim_gestion IS NOT NULL))::NUMERIC/NULLIF(COUNT(*),0)*100,1),
      ''avg_resp_min'',ROUND((AVG(EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion))/60) FILTER(
        WHERE fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1),
      ''med_resp_min'',ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion))/60) FILTER(
        WHERE fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1),
      ''avg_ciclo_min'',ROUND((AVG(EXTRACT(EPOCH FROM(fch_negocio-fch_creacion))/60) FILTER(
        WHERE fch_negocio IS NOT NULL AND EXTRACT(EPOCH FROM(fch_negocio-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1),
      ''avg_ciclo_ventas_min'',ROUND((AVG(EXTRACT(EPOCH FROM(fch_negocio-fch_creacion))/60) FILTER(
        WHERE fch_negocio IS NOT NULL AND es_venta AND EXTRACT(EPOCH FROM(fch_negocio-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1)
    ) FROM leads WHERE tenant_id=$1 AND($2::DATE IS NULL OR %I::DATE>=$2) AND($3::DATE IS NULL OR %I::DATE<=$3) %s',
    df,df,fw) USING _tenant_id,_fecha_desde,_fecha_hasta INTO r;
  ELSE
    CASE _group_by
      WHEN 'agente_negocio'      THEN ge:='agente_negocio';      gf:='agente_negocio IS NOT NULL AND agente_negocio!=''''';
      WHEN 'agente_prim_gestion' THEN ge:='agente_prim_gestion'; gf:='agente_prim_gestion IS NOT NULL AND agente_prim_gestion!=''''';
      WHEN 'agente_ultim_gestion'THEN ge:='agente_ultim_gestion';gf:='agente_ultim_gestion IS NOT NULL AND agente_ultim_gestion!=''''';
      WHEN 'campana_mkt'         THEN ge:='campana_mkt';         gf:='campana_mkt IS NOT NULL AND campana_mkt!=''''';
      WHEN 'campana_inconcert'   THEN ge:='campana_inconcert';   gf:='campana_inconcert IS NOT NULL AND campana_inconcert!=''''';
      WHEN 'tipo_llamada'        THEN ge:='tipo_llamada';        gf:='tipo_llamada IS NOT NULL AND tipo_llamada!=''''';
      WHEN 'ciudad'              THEN ge:='ciudad';              gf:='ciudad IS NOT NULL AND ciudad!=''''';
      WHEN 'hora'                THEN ge:=format('EXTRACT(HOUR FROM %I)::INT',df); gf:=format('%I IS NOT NULL',df);
      WHEN 'fecha'               THEN ge:=format('%I::DATE',df); gf:=format('%I IS NOT NULL',df);
      ELSE RAISE EXCEPTION 'group_by no válido: %',_group_by;
    END CASE;
    EXECUTE format('SELECT COALESCE(json_agg(t ORDER BY leads DESC),''[]''::JSON) FROM(
      SELECT %s AS dimension,COUNT(*)::INT AS leads,(COUNT(*) FILTER(WHERE es_venta))::INT AS ventas,
        ROUND((COUNT(*) FILTER(WHERE es_venta))::NUMERIC/NULLIF(COUNT(*),0)*100,1) AS conv_pct,
        ROUND((AVG(EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion))/60) FILTER(
          WHERE fch_prim_gestion IS NOT NULL AND EXTRACT(EPOCH FROM(fch_prim_gestion-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1) AS avg_resp_min,
        ROUND((AVG(EXTRACT(EPOCH FROM(fch_negocio-fch_creacion))/60) FILTER(
          WHERE fch_negocio IS NOT NULL AND EXTRACT(EPOCH FROM(fch_negocio-fch_creacion)) BETWEEN 0 AND 2592000))::NUMERIC,1) AS avg_ciclo_min
      FROM leads WHERE tenant_id=$1 AND($2::DATE IS NULL OR %I::DATE>=$2) AND($3::DATE IS NULL OR %I::DATE<=$3) AND %s %s
      GROUP BY %s ORDER BY COUNT(*) DESC LIMIT 30)t',
    ge,df,df,gf,fw,ge) USING _tenant_id,_fecha_desde,_fecha_hasta INTO r;
  END IF;
  RETURN COALESCE(r,'[]'::JSON);
END $function$;

CREATE OR REPLACE FUNCTION public.leads_funnel(_tenant_id uuid, _fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _date_field text DEFAULT 'fch_creacion'::text, _filters jsonb DEFAULT NULL::jsonb)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r JSON; df TEXT; fw TEXT;
BEGIN
  df:=_date_field_expr(_date_field); fw:=_build_filters_where(_filters);
  EXECUTE format('SELECT json_build_object(
    ''total'',COUNT(*)::INT,
    ''con_prim_gestion'',(COUNT(*) FILTER(WHERE fch_prim_gestion IS NOT NULL))::INT,
    ''con_ultim_gestion'',(COUNT(*) FILTER(WHERE fch_ultim_gestion IS NOT NULL))::INT,
    ''con_negocio'',(COUNT(*) FILTER(WHERE fch_negocio IS NOT NULL))::INT,
    ''ventas'',(COUNT(*) FILTER(WHERE es_venta))::INT,
    ''tasa_contacto'',ROUND((COUNT(*) FILTER(WHERE fch_prim_gestion IS NOT NULL))::NUMERIC/NULLIF(COUNT(*),0)*100,1),
    ''tasa_negocio'',ROUND((COUNT(*) FILTER(WHERE fch_negocio IS NOT NULL))::NUMERIC/NULLIF(COUNT(*),0)*100,1),
    ''tasa_conversion'',ROUND((COUNT(*) FILTER(WHERE es_venta))::NUMERIC/NULLIF(COUNT(*),0)*100,1)
  ) FROM leads WHERE tenant_id=$1 AND($2::DATE IS NULL OR %I::DATE>=$2) AND($3::DATE IS NULL OR %I::DATE<=$3) %s',
  df,df,fw) USING _tenant_id,_fecha_desde,_fecha_hasta INTO r;
  RETURN r;
END $function$;

-- DashDinamics: dimensiones para última gestión + contactabilidad según glosario (CONNECTED+FINISHED)

CREATE OR REPLACE FUNCTION public.get_leads_dimensions(_tenant_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.get_leads_kpis(_tenant_id uuid, _fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _date_field text DEFAULT 'fch_creacion'::text, _filters jsonb DEFAULT NULL::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
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

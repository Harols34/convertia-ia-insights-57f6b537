-- Phase 1: Optimizaciones BI Estratégicas para tabla 'leads'
-- Arquitectura de BI con Vistas Materializadas para alto rendimiento

-- 1. Índices Estratégicos (Simples y Compuestos)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_fch_creacion ON public.leads (fch_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_leads_es_venta ON public.leads (es_venta) WHERE es_venta = true;
CREATE INDEX IF NOT EXISTS idx_leads_agente_prim_gestion ON public.leads (agente_prim_gestion) WHERE agente_prim_gestion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_cliente_norm ON public.leads (UPPER(TRIM(cliente)));

-- Índice compuesto para filtros comunes
CREATE INDEX IF NOT EXISTS idx_leads_bi_lookup ON public.leads (tenant_id, fch_creacion DESC, cliente, campana_mkt);

-- BRIN index para eficiencia en rangos de fecha masivos
CREATE INDEX IF NOT EXISTS idx_leads_fch_creacion_brin ON public.leads USING BRIN (fch_creacion);

-- 2. Vistas Materializadas para Pre-agregación
-- Estas vistas reducen el escaneo de millones de filas a solo unos miles de registros agregados.

-- Agregado Diario Estratégico (Normalizado)
DROP MATERIALIZED VIEW IF EXISTS public.mv_leads_daily;
CREATE MATERIALIZED VIEW public.mv_leads_daily AS
SELECT
  date_trunc('day', fch_creacion)::date AS dia,
  tenant_id,
  UPPER(TRIM(COALESCE(cliente, 'SIN CLIENTE'))) as cliente,
  COALESCE(campana_mkt, 'SIN CAMPAÑA') as campana_mkt,
  COALESCE(categoria_mkt, 'SIN CATEGORÍA') as categoria_mkt,
  COALESCE(campana_inconcert, 'SIN CAMPAÑA IC') as campana_inconcert,
  COALESCE(tipo_llamada, 'OTRO') as tipo_llamada,
  COALESCE(ciudad, 'SIN CIUDAD') as ciudad,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE es_venta) AS ventas,
  COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL) AS gestionados,
  COUNT(*) FILTER (WHERE fch_prim_gestion IS NULL) AS no_gestionados,
  COUNT(*) FILTER (WHERE prim_resultado_marcadora = 'ABANDONED') AS abandonos,
  COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL OR prim_resultado_marcadora IN ('CONNECTED', 'FINISHED', 'Closed')) AS contactados,
  SUM(EXTRACT(EPOCH FROM (fch_prim_gestion - fch_creacion)) / 60) FILTER (WHERE fch_prim_gestion IS NOT NULL) AS total_ttf_min,
  SUM(EXTRACT(EPOCH FROM (fch_negocio - fch_creacion)) / 60) FILTER (WHERE fch_negocio IS NOT NULL) AS total_ttn_min
FROM public.leads
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

CREATE UNIQUE INDEX idx_mv_leads_daily_pk ON public.mv_leads_daily (dia, tenant_id, cliente, campana_mkt, categoria_mkt, campana_inconcert, tipo_llamada, ciudad);

-- Agregado Horario (Heatmap)
DROP MATERIALIZED VIEW IF EXISTS public.mv_leads_hourly;
CREATE MATERIALIZED VIEW public.mv_leads_hourly AS
SELECT
  date_trunc('hour', fch_creacion) AS hora,
  tenant_id,
  UPPER(TRIM(cliente)) as cliente,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE es_venta) AS ventas,
  COUNT(*) FILTER (WHERE fch_prim_gestion IS NOT NULL OR prim_resultado_marcadora IN ('CONNECTED', 'FINISHED', 'Closed')) AS contactados
FROM public.leads
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_leads_hourly_pk ON public.mv_leads_hourly (hora, tenant_id, cliente);

-- Agregado por Asesor (Productividad)
DROP MATERIALIZED VIEW IF EXISTS public.mv_leads_agent_daily;
CREATE MATERIALIZED VIEW public.mv_leads_agent_daily AS
SELECT
  date_trunc('day', fch_prim_gestion)::date AS dia,
  tenant_id,
  agente_prim_gestion as agente,
  COUNT(*) AS gestionados,
  COUNT(*) FILTER (WHERE es_venta) AS ventas,
  COUNT(*) FILTER (WHERE prim_resultado_marcadora IN ('CONNECTED', 'FINISHED', 'Closed')) AS contactados,
  SUM(EXTRACT(EPOCH FROM (fch_prim_gestion - fch_creacion)) / 60) AS total_ttf_min
FROM public.leads
WHERE fch_prim_gestion IS NOT NULL AND agente_prim_gestion <> 'BOT'
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_mv_leads_agent_daily_pk ON public.mv_leads_agent_daily (dia, tenant_id, agente);

-- 3. Funciones de Ayuda
CREATE OR REPLACE FUNCTION public.refresh_bi_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_hourly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leads_agent_daily;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPCs Estratégicos para Frontend

-- Scorecard Ejecutivo con Comparativas
CREATE OR REPLACE FUNCTION public.get_strategic_bi_scorecard(
  _tenant_id uuid,
  _fecha_desde date,
  _fecha_hasta date,
  _filters jsonb DEFAULT '{}'
)
RETURNS json AS $$
DECLARE
  curr record;
  prev record;
  prev_start date := _fecha_desde - (_fecha_hasta - _fecha_desde + 1);
  prev_end date := _fecha_desde - 1;
BEGIN
  -- Métricas Periodo Actual
  SELECT
    SUM(leads)::bigint as leads,
    SUM(ventas)::bigint as ventas,
    SUM(contactados)::bigint as contactados,
    SUM(gestionados)::bigint as gestionados,
    SUM(no_gestionados)::bigint as no_gestionados,
    SUM(abandonos)::bigint as abandonos,
    ROUND(SUM(total_ttf_min)::numeric / NULLIF(SUM(gestionados),0), 2) as avg_ttf_min
  INTO curr
  FROM public.mv_leads_daily
  WHERE tenant_id = _tenant_id AND dia >= _fecha_desde AND dia <= _fecha_hasta;

  -- Métricas Periodo Anterior
  SELECT
    SUM(leads)::bigint as leads,
    SUM(ventas)::bigint as ventas
  INTO prev
  FROM public.mv_leads_daily
  WHERE tenant_id = _tenant_id AND dia >= prev_start AND dia <= prev_end;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1) Daily metrics RPC consolidating all accessible tenants
CREATE OR REPLACE FUNCTION public.accessible_leads_daily_metrics(
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  dia date,
  leads bigint,
  ventas bigint,
  contactados bigint,
  gestionados bigint,
  no_gestionados bigint,
  abandonos bigint,
  total_ttf_min numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.dia,
    SUM(m.leads)::bigint,
    SUM(m.ventas)::bigint,
    SUM(m.contactados)::bigint,
    SUM(m.gestionados)::bigint,
    SUM(m.no_gestionados)::bigint,
    SUM(m.abandonos)::bigint,
    SUM(m.total_ttf_min)::numeric
  FROM public.mv_leads_daily m
  WHERE m.tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
    AND (_fecha_desde IS NULL OR m.dia >= _fecha_desde)
    AND (_fecha_hasta IS NULL OR m.dia <= _fecha_hasta)
  GROUP BY m.dia
  ORDER BY m.dia ASC;
$$;

GRANT EXECUTE ON FUNCTION public.accessible_leads_daily_metrics(date, date) TO authenticated;

-- 2) Hourly metrics RPC
CREATE OR REPLACE FUNCTION public.accessible_leads_hourly_metrics(
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL
)
RETURNS TABLE (
  hora timestamptz,
  leads bigint,
  ventas bigint,
  contactados bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.hora,
    SUM(m.leads)::bigint,
    SUM(m.ventas)::bigint,
    SUM(m.contactados)::bigint
  FROM public.mv_leads_hourly m
  WHERE m.tenant_id = ANY(public.get_accessible_tenant_ids(auth.uid()))
    AND (_fecha_desde IS NULL OR m.hora::date >= _fecha_desde)
    AND (_fecha_hasta IS NULL OR m.hora::date <= _fecha_hasta)
  GROUP BY m.hora
  ORDER BY m.hora ASC;
$$;

GRANT EXECUTE ON FUNCTION public.accessible_leads_hourly_metrics(date, date) TO authenticated;

-- 3) Rewrite strategic scorecard to use accessible tenants (ignore the legacy _tenant_id arg)
CREATE OR REPLACE FUNCTION public.get_strategic_bi_scorecard(
  _tenant_id uuid,
  _fecha_desde date,
  _fecha_hasta date,
  _filters jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  curr record;
  prev record;
  prev_start date := _fecha_desde - (_fecha_hasta - _fecha_desde + 1);
  prev_end   date := _fecha_desde - 1;
  tids uuid[] := public.get_accessible_tenant_ids(auth.uid());
BEGIN
  SELECT
    SUM(leads)::bigint            AS leads,
    SUM(ventas)::bigint           AS ventas,
    SUM(contactados)::bigint      AS contactados,
    SUM(gestionados)::bigint      AS gestionados,
    SUM(no_gestionados)::bigint   AS no_gestionados,
    SUM(abandonos)::bigint        AS abandonos,
    ROUND(SUM(total_ttf_min)::numeric / NULLIF(SUM(gestionados),0), 2) AS avg_ttf_min
  INTO curr
  FROM public.mv_leads_daily
  WHERE tenant_id = ANY(tids)
    AND dia >= _fecha_desde
    AND dia <= _fecha_hasta;

  SELECT
    SUM(leads)::bigint  AS leads,
    SUM(ventas)::bigint AS ventas
  INTO prev
  FROM public.mv_leads_daily
  WHERE tenant_id = ANY(tids)
    AND dia >= prev_start
    AND dia <= prev_end;

  RETURN json_build_object(
    'actual', json_build_object(
      'leads',          COALESCE(curr.leads, 0),
      'ventas',         COALESCE(curr.ventas, 0),
      'efectividad',    ROUND(COALESCE(curr.ventas, 0)::numeric / NULLIF(COALESCE(curr.leads, 0), 0) * 100, 2),
      'contactabilidad',ROUND(COALESCE(curr.contactados, 0)::numeric / NULLIF(COALESCE(curr.leads, 0), 0) * 100, 2),
      'gestionados',    COALESCE(curr.gestionados, 0),
      'no_gestionados', COALESCE(curr.no_gestionados, 0),
      'abandonos',      COALESCE(curr.abandonos, 0),
      'avg_ttf_min',    COALESCE(curr.avg_ttf_min, 0)
    ),
    'anterior', json_build_object(
      'leads',  COALESCE(prev.leads, 0),
      'ventas', COALESCE(prev.ventas, 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_strategic_bi_scorecard(uuid, date, date, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accessible_leads_daily_metrics(date, date, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accessible_leads_hourly_metrics(date, date, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_strategic_bi_scorecard(uuid, date, date, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_bi_materialized_views() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._leads_filter_clause(jsonb, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accessible_leads_daily_metrics(date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_leads_hourly_metrics(date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_strategic_bi_scorecard(uuid, date, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_bi_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION public._leads_filter_clause(jsonb, text) TO authenticated;
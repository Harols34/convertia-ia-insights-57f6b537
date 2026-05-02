import { useQuery } from "@tanstack/react-query";
import { fetchExecutiveDashboardData, DashboardExecutiveData, leadsFiltersQueryKey } from "@/lib/dashboard-executive-rpc";
import { LeadsDashboardFilters } from "@/lib/dashboard-leads";
import { useMemo } from "react";

export type BILeadMetrics = {
  totalLeads: number;
  uniqueLeads: number;
  managedLeads: number;
  contactedLeads: number;
  totalSales: number;
  billedSales: number;
  conversionRate: number;
  contactRate: number;
  managementRate: number;
  avgTTF: number;
  abandoned: number;
  
  // Deltas vs previous period
  deltas: {
    leads: number;
    sales: number;
    conversion: number;
  };
  
  // Normalized series for charts
  dailySeries: { date: string; leads: number; sales: number; contactados: number; gestionados: number }[];
  weeklySeries: { date: string; label: string; leads: number; sales: number }[];
  
  // Strategic snapshot
  strategic: DashboardExecutiveData['strategic'];
};

export function useLeadsMetrics(filters: LeadsDashboardFilters, comparativePeriod: string = "prev_period") {
  const filterKey = useMemo(() => leadsFiltersQueryKey(filters), [filters]);

  const query = useQuery({
    queryKey: ["bi-metrics", filterKey, comparativePeriod],
    queryFn: () => fetchExecutiveDashboardData(filters, comparativePeriod),
    staleTime: 60_000,
  });

  const metrics = useMemo((): BILeadMetrics | null => {
    if (!query.data) return null;
    const d = query.data;
    const s = d.strategic.actual;
    
    return {
      totalLeads: s.leads,
      uniqueLeads: s.leads,
      managedLeads: s.gestionados,
      contactedLeads: s.leads * (s.contactabilidad / 100),
      totalSales: s.ventas,
      billedSales: s.ventas,
      conversionRate: s.efectividad,
      contactRate: s.contactabilidad,
      managementRate: s.leads > 0 ? (s.gestionados / s.leads) * 100 : 0,
      avgTTF: s.avg_ttf_min,
      abandoned: s.abandonos,
      
      deltas: {
        leads: d.cmp7.total.deltaPct,
        sales: d.cmp7.ventas.deltaPct,
        conversion: d.cmp7.tasaVenta.deltaPct,
      },
      
      dailySeries: d.daily,
      weeklySeries: d.weekly,
      strategic: d.strategic
    };
  }, [query.data]);

  return {
    ...query,
    metrics
  };
}

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  Map, 
  Activity,
  LayoutDashboard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useLeadsMetrics } from "@/hooks/use-leads-metrics";
import { useComparative } from "@/hooks/use-comparative";
import { 
  fetchDashboardFilterOptions,
  leadsFiltersQueryKey,
  DashboardExecutiveData
} from "@/lib/dashboard-executive-rpc";
import { BIHeader } from "@/components/dashboard/BIHeader";
import { ExecutiveTab } from "@/components/dashboard/ExecutiveTab";
import { MarketingTab } from "@/components/dashboard/MarketingTab";
import { TrendsTab } from "@/components/dashboard/TrendsTab";
import { OperationsTab } from "@/components/dashboard/OperationsTab";
import { GeographyTab } from "@/components/dashboard/GeographyTab";
import { ActivityTab } from "@/components/dashboard/ActivityTab";
import { ExecutiveDashboardBody } from "@/components/dashboard/ExecutiveDashboardBody";
import { LoadingOverlay, ErrorState, KpiSkeleton } from "@/components/dashboard/DashboardStates";
import { DASHBOARD_LEADS_QUERY_KEY, useDashboardLeadsDataset } from "@/hooks/use-dashboard-leads-dataset";
import { QuickFilterSidebar } from "@/components/dashboard/QuickFilterSidebar";
import { GlassCard } from "@/components/dashboard/GlassCard";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const {
    filters,
    setFilters,
    setDimension,
    activeFilterCount,
    clearAllFilters
  } = useDashboardFilters();

  const [activeTab, setActiveTab] = useState<string>("executive");
  const { period, setPeriod } = useComparative();
  const metricsQuery = useLeadsMetrics(filters, period);
  const { metrics, isLoading, isError, error, refetch, isFetching } = metricsQuery;
  const rpcData = metricsQuery.data;

  // Solo descargar el dataset pesado de leads cuando el usuario abre la pestaña "Actividad"
  // (las demás pestañas usan RPC agregado, mucho más rápido).
  const datasetQuery = useDashboardLeadsDataset({
    enabled: activeTab === "activity",
    fchRango: { desde: filters.desde, hasta: filters.hasta },
    panelFiltersKey: leadsFiltersQueryKey(filters)
  });

  const dimensionQuery = useQuery({
    queryKey: ["leads-dimension-options"] as const,
    queryFn: fetchDashboardFilterOptions,
    staleTime: 10 * 60_000,
  });

  const handleRefresh = useCallback(() => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: [...DASHBOARD_LEADS_QUERY_KEY] });
  }, [refetch, queryClient]);

  if (isError) {
    return <ErrorState title="Error de Conexión" message={(error as Error)?.message || "No se pudieron cargar los datos."} onRetry={handleRefresh} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-50 w-full bg-white/60 backdrop-blur-2xl border-b border-slate-200/50 shadow-sm transition-all duration-300">
          <BIHeader 
            filters={filters}
            setFilters={setFilters}
            setDimension={setDimension}
            clearAllFilters={clearAllFilters}
            activeFilterCount={activeFilterCount}
            dimensionOptions={dimensionQuery.data}
            isFetching={isFetching}
            onRefresh={handleRefresh}
            comparativePeriod={period}
            onComparativePeriodChange={setPeriod}
          />
          
          <div className="px-4 sm:px-6 lg:px-8 pb-2">
            <TabsList className="bg-slate-100/50 backdrop-blur-sm border-slate-200/60 p-0.5 rounded-lg shadow-inner flex h-9 w-full md:w-max mx-auto overflow-x-auto no-scrollbar justify-start md:justify-center">
              <TabsTrigger value="executive" className="rounded-md text-[9px] font-black uppercase tracking-tight gap-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-8">
                <LayoutDashboard className="h-3 w-3" />
                Resumen
              </TabsTrigger>
              <TabsTrigger value="trends" className="rounded-md text-[9px] font-black uppercase tracking-tight gap-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-8">
                <TrendingUp className="h-3 w-3" />
                Tendencias
              </TabsTrigger>
              <TabsTrigger value="marketing" className="rounded-md text-[9px] font-black uppercase tracking-tight gap-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-8">
                <Target className="h-3 w-3" />
                Marketing
              </TabsTrigger>
              <TabsTrigger value="operations" className="rounded-md text-[9px] font-black uppercase tracking-tight gap-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-8">
                <Users className="h-3 w-3" />
                Operaciones
              </TabsTrigger>
              <TabsTrigger value="geography" className="rounded-md text-[9px] font-black uppercase tracking-tight gap-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-8">
                <Map className="h-3 w-3" />
                Geografía
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-md text-[9px] font-black uppercase tracking-tight gap-1.5 px-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all h-8">
                <Activity className="h-3 w-3" />
                Actividad
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <main className="w-full px-4 sm:px-6 lg:px-8 pt-8 pb-20">
          <div className="w-full">

              {isLoading && !metrics ? (
                <LoadingOverlay />
              ) : (
                <>
                  <TabsContent value="executive" className="animate-fade-up outline-none focus-visible:ring-0">
                    {!metrics ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                        <KpiSkeleton />
                      </div>
                    ) : (
                      <ExecutiveTab 
                        metrics={metrics}
                        rpcData={rpcData as DashboardExecutiveData}
                        bullets={rpcData?.bullets || []}
                        filterOptions={dimensionQuery.data || {}}
                        selectedDimensions={filters.dimensions}
                        onDimensionChange={setDimension}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="trends" className="animate-fade-up outline-none focus-visible:ring-0">
                    <TrendsTab
                      rpcData={rpcData as DashboardExecutiveData}
                      isLoading={isLoading}
                      filterOptions={dimensionQuery.data || {}}
                      selectedDimensions={filters.dimensions}
                      onDimensionChange={setDimension}
                    />
                  </TabsContent>

                  <TabsContent value="marketing" className="animate-fade-up outline-none focus-visible:ring-0">
                    <MarketingTab 
                      rpcData={rpcData as DashboardExecutiveData} 
                      isLoading={isLoading} 
                      filterOptions={dimensionQuery.data || {}}
                      selectedDimensions={filters.dimensions}
                      onDimensionChange={setDimension}
                    />
                  </TabsContent>

                  <TabsContent value="operations" className="animate-fade-up outline-none focus-visible:ring-0">
                    <OperationsTab 
                      rpcData={rpcData as DashboardExecutiveData} 
                      isLoading={isLoading} 
                      filterOptions={dimensionQuery.data || {}}
                      selectedDimensions={filters.dimensions}
                      onDimensionChange={setDimension}
                    />
                  </TabsContent>

                  <TabsContent value="geography" className="animate-fade-up outline-none focus-visible:ring-0">
                    <GeographyTab 
                      rpcData={rpcData as DashboardExecutiveData} 
                      isLoading={isLoading} 
                      filterOptions={dimensionQuery.data || {}}
                      selectedDimensions={filters.dimensions}
                      onDimensionChange={setDimension}
                    />
                  </TabsContent>

                  <TabsContent value="activity" className="animate-fade-up outline-none focus-visible:ring-0">
                    <ActivityTab 
                      filters={filters} 
                      leads={datasetQuery.data || []} 
                      isLoading={datasetQuery.isLoading} 
                      filterOptions={dimensionQuery.data || {}}
                      onDimensionChange={setDimension}
                    />
                  </TabsContent>
                </>
              )}
          </div>
        </main>
      </Tabs>
    </div>
  );
}

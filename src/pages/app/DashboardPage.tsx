import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Filter, Calendar, ChevronDown, X, LayoutDashboard, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import React from "react";
import { ExecutiveDashboardBody, type ExecutiveDashboardBodyProps } from "@/components/dashboard/ExecutiveDashboardBody";
import { ExecutiveDashboardSkeleton } from "@/components/dashboard/ExecutiveDashboardSkeleton";
import { useDashboardLeadsDataset, DASHBOARD_LEADS_QUERY_KEY } from "@/hooks/use-dashboard-leads-dataset";
import {
  fetchExecutiveDashboardData,
  fetchDashboardFilterOptions,
  leadsFiltersQueryKey,
} from "@/lib/dashboard-executive-rpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHBOARD_DEFAULT_CHART_DAYS,
  LEADS_DASHBOARD_FILTER_COLUMNS,
  applyLeadsDashboardFilters,
  defaultLeadsDashboardFilters,
  formatFilterChipValue,
  getDefaultMonthToDateRange,
  uniqueValuesForColumn,
  type LeadRow,
  type LeadsDashboardFilters,
} from "@/lib/dashboard-leads";

const EXECUTIVE_DASHBOARD_KEY = "executive-dashboard" as const;

function DimensionMultiFilter({
  col,
  label,
  allLeads,
  dimensionOptions,
  selected,
  onChange,
}: {
  col: keyof LeadRow;
  label: string;
  allLeads: LeadRow[];
  dimensionOptions?: Partial<Record<keyof LeadRow, string[]>>;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const options = useMemo(() => {
    const fromRpc = dimensionOptions?.[col];
    if (fromRpc && fromRpc.length > 0) return fromRpc;
    return uniqueValuesForColumn(allLeads, col);
  }, [allLeads, col, dimensionOptions]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => formatFilterChipValue(o).toLowerCase().includes(q));
  }, [options, search]);

  const summary = useMemo(() => 
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? formatFilterChipValue(selected[0])
        : `${selected.length} valores`
  , [selected]);

  const toggle = (token: string, checked: boolean) => {
    const set = new Set(selected);
    if (checked) set.add(token);
    else set.delete(token);
    onChange([...set]);
  };

  const selectAllVisible = () => {
    const merged = new Set([...selected, ...filtered]);
    onChange([...merged]);
  };

  const clearColumn = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[160px] max-w-[220px] text-xs font-normal">
          <span className="truncate text-left">
            <span className="text-muted-foreground mr-1">{label}:</span>
            {summary}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border space-y-2">
          <Input
            placeholder="Buscar…"
            className="h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px]" onClick={selectAllVisible}>
              + visibles
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={clearColumn}>
              Limpiar
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[220px]">
          <div className="p-2 space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-1">Sin coincidencias</p>
            ) : (
              filtered.map((token) => {
                const id = `${String(col)}-${token}`;
                const checked = selected.includes(token);
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/60 cursor-pointer"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => toggle(token, c === true)}
                      className="mt-0.5"
                    />
                    <span className="text-[11px] leading-snug break-all">{formatFilterChipValue(token)}</span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>
        {options.length >= 400 && (
          <p className="text-[9px] text-muted-foreground px-2 py-1 border-t border-border">
            Mostrando hasta 400 valores distintos en esta columna.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

const EMPTY_ARRAY: any[] = [];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [comparativeFetchEnabled, setComparativeFetchEnabled] = useState(true);
  const [comparativeRowsProgress, setComparativeRowsProgress] = useState(0);
  const requestComparativeDataset = useCallback(() => {
    setComparativeFetchEnabled(true);
  }, []);

  const [activity, setActivity] = useState<unknown[]>([]);
  const [filters, setFilters] = useState<LeadsDashboardFilters>(defaultLeadsDashboardFilters);
  const [showFilters, setShowFilters] = useState(false);

  const fchRango = useMemo(
    () => ({ desde: filters.desde, hasta: filters.hasta }),
    [filters.desde, filters.hasta],
  );

  const filterKey = useMemo(() => leadsFiltersQueryKey(filters), [filters]);

  const {
    data: allLeads = [],
    isLoading: leadsLoading,
    isError: leadsError,
    error: leadsErr,
  } = useDashboardLeadsDataset({
    enabled: comparativeFetchEnabled,
    onProgress: setComparativeRowsProgress,
    fchRango,
    panelFiltersKey: filterKey,
  });

  useEffect(() => {
    if (!comparativeFetchEnabled) setComparativeRowsProgress(0);
  }, [comparativeFetchEnabled]);
  const executiveQuery = useQuery({
    queryKey: [EXECUTIVE_DASHBOARD_KEY, filterKey] as const,
    queryFn: () => fetchExecutiveDashboardData(filters),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const dimensionQuery = useQuery({
    queryKey: ["leads-dimension-options"] as const,
    queryFn: fetchDashboardFilterOptions,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const dimensionOptions = useMemo(() => {
    if (dimensionQuery.data && Object.keys(dimensionQuery.data).length > 0) {
      return dimensionQuery.data;
    }
    if (allLeads.length === 0) return undefined;
    
    // Fallback: calculate from client-side data if RPC fails or is still loading
    const map: Partial<Record<keyof LeadRow, string[]>> = {};
    for (const { key } of LEADS_DASHBOARD_FILTER_COLUMNS) {
      map[key] = uniqueValuesForColumn(allLeads, key);
    }
    return map;
  }, [allLeads, dimensionQuery.data]);

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          void queryClient.invalidateQueries({ queryKey: [EXECUTIVE_DASHBOARD_KEY] });
          void queryClient.invalidateQueries({ queryKey: [...DASHBOARD_LEADS_QUERY_KEY] });
          void queryClient.invalidateQueries({ queryKey: ["leads-dimension-options"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [queryClient]);

  useEffect(() => {
    (async () => {
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("id, action, module, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      setActivity(logs || []);
    })();
  }, []);

  const filteredLeads = useMemo(() => applyLeadsDashboardFilters(allLeads, filters), [allLeads, filters]);

  const setDimension = useCallback((col: keyof LeadRow, values: string[]) => {
    setFilters((prev) => {
      const dimensions = { ...prev.dimensions };
      if (values.length === 0) delete dimensions[col];
      else dimensions[col] = values;
      return { ...prev, dimensions };
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.desde || filters.hasta) n += 1;
    if (filters.esVenta !== "all") n += 1;
    for (const vals of Object.values(filters.dimensions)) {
      if (vals?.length) n += 1;
    }
    return n;
  }, [filters]);

  const clearAllFilters = () => setFilters(defaultLeadsDashboardFilters());

  const applyThisMonthRange = useCallback(() => {
    setFilters((prev) => ({ ...prev, ...getDefaultMonthToDateRange() }));
  }, []);

  /** Sin fechas, sin dimensiones, sin "es venta": agregados completos; evolución diaria/semanal acotada a ~15d en análisis fijo. */
  const isDefaultUnfilteredView = useMemo(() => {
    if (filters.desde?.trim() || filters.hasta?.trim()) return false;
    if (filters.esVenta !== "all") return false;
    for (const vals of Object.values(filters.dimensions)) {
      if (vals?.length) return false;
    }
    return true;
  }, [filters]);

  const universeCount = allLeads.length;
  const hasActiveSlice = activeFilterCount > 0;
  const viewCount = executiveQuery.data?.kpis.totalLeads ?? filteredLeads.length;
  const leadsErrorMessage = leadsError
    ? leadsErr instanceof Error
      ? leadsErr.message
      : String(leadsErr)
    : null;

  if (executiveQuery.isError) {
    const errMsg = executiveQuery.error instanceof Error ? executiveQuery.error.message : String(executiveQuery.error);
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
        <p className="text-sm text-destructive font-medium">No se pudieron cargar los datos agregados del panel</p>
        <p className="text-xs text-muted-foreground">{errMsg}</p>
        <Button variant="outline" size="sm" onClick={() => void executiveQuery.refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Reintentar
        </Button>
      </div>
    );
  }

  const isInitialExecLoading = executiveQuery.isLoading && !executiveQuery.data;

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card/50 p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-violet-50 border border-teal-100 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Dashboard ejecutivo</h1>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">
              {allLeads.length > 0 ? (
                <>
                  Universo <strong className="text-foreground">{universeCount.toLocaleString("es")}</strong> leads
                  (RLS, en cliente para comparativa).
                </>
              ) : (
                <span className="text-muted-foreground/90">
                  Dataset en cliente no cargado: solo al usar el análisis comparativo detallado (KPIs y gráficos usan
                  el servidor, rápido).
                </span>
              )}
              {leadsError && (
                <span className="text-amber-700 dark:text-amber-500 ml-1">
                  No se pudo actualizar el dataset completo: {leadsErr instanceof Error ? leadsErr.message : "error"}.
                </span>
              )}
              {hasActiveSlice && (
                <>
                  {" "}
                  Vista con filtros:{" "}
                  <strong className="text-teal-700">{viewCount.toLocaleString("es")}</strong>
                  {executiveQuery.isFetching && " (actualizando…)"}.
                </>
              )}{" "}
              BI interactivo: alterna tipos de gráfico, comparativas y dimensiones.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-9" onClick={clearAllFilters}>
              <X className="h-3.5 w-3.5" />
              Quitar filtros ({activeFilterCount})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-9"
            onClick={() => {
              void executiveQuery.refetch();
              void queryClient.invalidateQueries({ queryKey: [...DASHBOARD_LEADS_QUERY_KEY] });
            }}
            disabled={executiveQuery.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${executiveQuery.isFetching ? "animate-spin" : ""}`} />
            <span className="ml-1 hidden sm:inline">Actualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-9">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </Button>
        </div>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4 p-4 rounded-2xl border border-border bg-muted/40 shadow-sm"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Fecha creación desde</Label>
                  <Input
                    type="date"
                    value={filters.desde || ""}
                    onChange={(e) => setFilters({ ...filters, desde: e.target.value || undefined })}
                    className="h-9 w-[150px] text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">hasta</Label>
                  <Input
                    type="date"
                    value={filters.hasta || ""}
                    onChange={(e) => setFilters({ ...filters, hasta: e.target.value || undefined })}
                    className="h-9 w-[150px] text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 text-xs shrink-0"
                  onClick={applyThisMonthRange}
                >
                  Mes actual
                </Button>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Es venta</Label>
                <Select
                  value={filters.esVenta}
                  onValueChange={(v) => setFilters({ ...filters, esVenta: v as LeadsDashboardFilters["esVenta"] })}
                >
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="yes">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground max-w-3xl leading-snug">
              Sin <strong>desde / hasta</strong>, los KPIs, embudo y rankings usan <strong>todo el histórico</strong>{" "}
              visible (RLS). La evolución diaria y semanal en análisis fijo muestran un resumen de los{" "}
              <strong>últimos {DASHBOARD_DEFAULT_CHART_DAYS} días</strong> (o semanas recientes) hasta que fije fechas
              o otros filtros; entonces se muestra el periodo o el corte elegido. Use <strong>Mes actual</strong> para
              acotar al mes en curso.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-2">
              Dimensiones (varios valores = OR dentro del campo; entre campos = AND)
            </p>
            {dimensionQuery.isLoading && <Skeleton className="h-8 w-48" />}
            <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pr-1">
              {LEADS_DASHBOARD_FILTER_COLUMNS.map(({ key, label }) => (
                <DimensionMultiFilter
                  key={String(key)}
                  col={key}
                  label={label}
                  allLeads={allLeads}
                  dimensionOptions={dimensionOptions}
                  selected={filters.dimensions[key] ?? EMPTY_ARRAY}
                  onChange={(next) => setDimension(key, next)}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {isInitialExecLoading ? (
        <ExecutiveDashboardSkeleton />
      ) : executiveQuery.data ? (
        <ExecutiveDashboardBody
          leads={filteredLeads}
          rpcData={executiveQuery.data}
          kpiTotalLeadsFromRpc={executiveQuery.data.kpis.totalLeads}
          isLeadsLoading={comparativeFetchEnabled && leadsLoading}
          comparativeDatasetIdle={!comparativeFetchEnabled}
          onRequestComparativeDataset={requestComparativeDataset}
          comparativeRowsLoadedProgress={comparativeRowsProgress}
          comparativeDatasetErrorMessage={leadsErrorMessage}
          isDefaultUnfilteredView={isDefaultUnfilteredView}
          filterDesde={filters.desde}
          filterHasta={filters.hasta}
          onCrossFilter={(payload) => {
            setFilters((prev) => ({
              ...prev,
              dimensions: { ...prev.dimensions, [payload.column]: [payload.token] },
            }));
          }}
          onFilterByDate={(isoDay) => {
            setFilters((prev) => ({ ...prev, desde: isoDay, hasta: isoDay }));
          }}
          onFilterByWeekRange={(desde, hasta) => {
            setFilters((prev) => ({ ...prev, desde, hasta }));
          }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 p-12 text-center">
          <p className="text-muted-foreground text-sm">No hay datos agregados disponibles aún.</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border">
          <h2 className="font-display font-semibold text-foreground">Actividad reciente</h2>
        </div>
        <div className="divide-y divide-border">
          {activity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No hay actividad reciente registrada</div>
          ) : (
            activity.map((item: { id: string; action: string; module?: string; created_at: string }, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.module || "Sistema"}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("es")}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

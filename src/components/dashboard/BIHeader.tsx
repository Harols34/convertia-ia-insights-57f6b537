import React from "react";
import { LayoutDashboard, RefreshCw, X, Filter, BarChart3, TrendingUp, Users, Target, Map, Activity, Calendar, UserCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "./DateRangePicker";
import { ComparativePicker } from "./ComparativePicker";
import { DimensionFilter } from "./DimensionFilter";
import { LeadsDashboardFilters, LEADS_DASHBOARD_FILTER_COLUMNS, LeadRow } from "@/lib/dashboard-leads";
import { ComparativePeriod } from "@/lib/comparative-utils";
import { cn } from "@/lib/utils";

export type BIHeaderProps = {
  filters: LeadsDashboardFilters;
  setFilters: (f: LeadsDashboardFilters) => void;
  setDimension: (col: keyof LeadRow, vals: string[]) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  dimensionOptions?: Partial<Record<keyof LeadRow, string[]>>;
  isFetching?: boolean;
  onRefresh: () => void;
  comparativePeriod: ComparativePeriod;
  onComparativePeriodChange: (p: ComparativePeriod) => void;
};

export function BIHeader({
  filters,
  setFilters,
  setDimension,
  clearAllFilters,
  activeFilterCount,
  dimensionOptions,
  isFetching,
  onRefresh,
  comparativePeriod,
  onComparativePeriodChange
}: BIHeaderProps) {
  
  // Filtros prioritarios solicitados
  const priorityFilters: (keyof LeadRow)[] = ["cliente", "campana_mkt", "ciudad", "agente_prim_gestion"];

  const [scrolled, setScrolled] = React.useState(false);
  
  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={cn(
      "w-full transition-all duration-300",
      scrolled ? "py-1.5" : "py-3"
    )}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-center gap-3 transition-all duration-300">
          
          {/* Unified Control Bar */}
          <div className={cn(
            "flex flex-wrap items-center gap-2 transition-all duration-300 rounded-xl",
            scrolled ? "p-0" : "bg-slate-50/80 p-1 border border-slate-200/40 shadow-sm"
          )}>
            
            {/* 1. Time Controls */}
            <div className="flex items-center gap-1.5 px-1.5">
              {!scrolled && <Calendar className="h-3.5 w-3.5 text-slate-400" />}
              <DateRangePicker 
                desde={filters.desde} 
                hasta={filters.hasta} 
                onChange={(desde, hasta) => setFilters({ ...filters, desde, hasta })} 
              />
              <div className="h-4 w-px bg-slate-300/50 mx-1" />
              <ComparativePicker 
                value={comparativePeriod} 
                onValueChange={onComparativePeriodChange} 
              />
            </div>

            <div className="h-6 w-px bg-slate-300 hidden xl:block" />

            {/* 2. Dimension Filters */}
            <div className="flex items-center gap-1.5 px-1">
              {priorityFilters.map((key) => {
                const col = LEADS_DASHBOARD_FILTER_COLUMNS.find(c => c.key === key);
                return (
                  <DimensionFilter
                    key={String(key)}
                    label={col?.label || String(key)}
                    options={dimensionOptions?.[key] || []}
                    selected={filters.dimensions[key] || []}
                    onChange={(vals) => setDimension(key, vals)}
                  />
                );
              })}
            </div>

            <div className="h-6 w-px bg-slate-300 hidden xl:block" />

            {/* 3. Global Actions */}
            <div className="flex items-center gap-1.5 px-1.5 ml-auto lg:ml-0">
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "px-2.5 text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all",
                    scrolled ? "h-7" : "h-8"
                  )}
                  onClick={clearAllFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  {!scrolled && <span>Limpiar ({activeFilterCount})</span>}
                </Button>
              )}
              
              <Button
                variant="default"
                size="sm"
                className={cn(
                  "px-4 text-[9px] font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 rounded-lg transition-all",
                  scrolled ? "h-7 px-2.5" : "h-8"
                )}
                onClick={onRefresh}
                disabled={isFetching}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", !scrolled && "mr-2", isFetching && "animate-spin")} />
                {!scrolled && (isFetching ? "Actualizando..." : "Refrescar Datos")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

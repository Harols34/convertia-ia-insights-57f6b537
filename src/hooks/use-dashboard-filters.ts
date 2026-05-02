import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  LeadsDashboardFilters, 
  defaultLeadsDashboardFilters, 
  LeadRow, 
  getDefaultMonthToDateRange 
} from "@/lib/dashboard-leads";

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo((): LeadsDashboardFilters => {
    const d = defaultLeadsDashboardFilters();
    const desde = searchParams.get("desde");
    const hasta = searchParams.get("hasta");
    const esVenta = searchParams.get("esVenta");

    const dimensions: Partial<Record<keyof LeadRow, string[]>> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith("dim_")) {
        const col = key.replace("dim_", "") as keyof LeadRow;
        dimensions[col] = value.split(",");
      }
    });

    return {
      desde: desde || d.desde,
      hasta: hasta || d.hasta,
      esVenta: (esVenta as any) || d.esVenta,
      dimensions: Object.keys(dimensions).length ? dimensions : d.dimensions,
    };
  }, [searchParams]);

  const updateParams = useCallback((newFilters: Partial<LeadsDashboardFilters>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      
      if (newFilters.desde !== undefined) {
        if (newFilters.desde) next.set("desde", newFilters.desde);
        else next.delete("desde");
      }
      
      if (newFilters.hasta !== undefined) {
        if (newFilters.hasta) next.set("hasta", newFilters.hasta);
        else next.delete("hasta");
      }
      
      if (newFilters.esVenta !== undefined) {
        if (newFilters.esVenta && newFilters.esVenta !== "all") next.set("esVenta", newFilters.esVenta);
        else next.delete("esVenta");
      }

      if (newFilters.dimensions !== undefined) {
        // Clear existing dim_ params
        Array.from(next.keys()).forEach(key => {
          if (key.startsWith("dim_")) next.delete(key);
        });
        // Set new ones
        Object.entries(newFilters.dimensions).forEach(([col, vals]) => {
          if (vals && vals.length > 0) {
            next.set(`dim_${col}`, vals.join(","));
          }
        });
      }

      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setFilters = useCallback((f: LeadsDashboardFilters | ((prev: LeadsDashboardFilters) => LeadsDashboardFilters)) => {
    if (typeof f === "function") {
      updateParams(f(filters));
    } else {
      updateParams(f);
    }
  }, [filters, updateParams]);

  const setDimension = useCallback((col: keyof LeadRow, values: string[]) => {
    const dims = { ...filters.dimensions };
    if (values.length === 0) delete dims[col];
    else dims[col] = values;
    updateParams({ dimensions: dims });
  }, [filters.dimensions, updateParams]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.desde || filters.hasta) n += 1;
    if (filters.esVenta !== "all") n += 1;
    for (const vals of Object.values(filters.dimensions)) {
      if (vals?.length) n += 1;
    }
    return n;
  }, [filters]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const applyThisMonthRange = useCallback(() => {
    updateParams(getDefaultMonthToDateRange());
  }, [updateParams]);

  const isDefaultUnfilteredView = useMemo(() => {
    if (filters.desde?.trim() || filters.hasta?.trim()) return false;
    if (filters.esVenta !== "all") return false;
    for (const vals of Object.values(filters.dimensions)) {
      if (vals?.length) return false;
    }
    return true;
  }, [filters]);

  return {
    filters,
    setFilters,
    setDimension,
    activeFilterCount,
    clearAllFilters,
    applyThisMonthRange,
    isDefaultUnfilteredView,
  };
}

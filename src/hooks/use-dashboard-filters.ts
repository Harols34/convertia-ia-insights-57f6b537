import { useState, useCallback, useMemo } from "react";
import { LeadsDashboardFilters, defaultLeadsDashboardFilters, LeadRow, getDefaultMonthToDateRange } from "@/lib/dashboard-leads";

export function useDashboardFilters() {
  const [filters, setFilters] = useState<LeadsDashboardFilters>(defaultLeadsDashboardFilters);

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

  const clearAllFilters = useCallback(() => setFilters(defaultLeadsDashboardFilters()), []);

  const applyThisMonthRange = useCallback(() => {
    setFilters((prev) => ({ ...prev, ...getDefaultMonthToDateRange() }));
  }, []);

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

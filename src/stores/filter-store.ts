/**
 * Filter Store — Zustand
 * Global + widget-level cross-filter state for all dashboards.
 * Replaces BoardCrossFilterContext for the V2 analytics module.
 */
import { create } from "zustand";

export interface FilterSelection {
  field: string;
  values: string[];
  /** 'in' = multi OR, 'between' = date range, 'is_true'/'is_false' = boolean */
  op: "in" | "between" | "is_true" | "is_false";
}

interface FilterStoreState {
  /** Global filters applied to all widgets in the active dashboard */
  globalFilters: FilterSelection[];
  /** Filters set by clicking on a chart element (cross-filter) */
  crossFilters: Record<string, string[]>; // field -> selected values
  /** Total count of active filter selections */
  activeFilterCount: number;

  // Actions
  setGlobalFilter: (field: string, values: string[], op?: FilterSelection["op"]) => void;
  removeGlobalFilter: (field: string) => void;
  clearAllGlobalFilters: () => void;
  toggleCrossFilter: (field: string, value: string) => void;
  setCrossFilter: (field: string, values: string[]) => void;
  clearCrossFilter: (field: string) => void;
  clearAllCrossFilters: () => void;
  clearEverything: () => void;
  /** Get combined filters (global + cross) as AggFilter format */
  getCombinedFilters: () => { field: string; op: string; values: string[] }[];
}

function countFilters(global: FilterSelection[], cross: Record<string, string[]>): number {
  let n = 0;
  for (const f of global) n += f.values.length;
  for (const v of Object.values(cross)) n += v.length;
  return n;
}

export const useFilterStore = create<FilterStoreState>((set, get) => ({
  globalFilters: [],
  crossFilters: {},
  activeFilterCount: 0,

  setGlobalFilter: (field, values, op = "in") => {
    set((s) => {
      const filters = s.globalFilters.filter((f) => f.field !== field);
      if (values.length > 0) filters.push({ field, values, op });
      return { globalFilters: filters, activeFilterCount: countFilters(filters, s.crossFilters) };
    });
  },

  removeGlobalFilter: (field) => {
    set((s) => {
      const filters = s.globalFilters.filter((f) => f.field !== field);
      return { globalFilters: filters, activeFilterCount: countFilters(filters, s.crossFilters) };
    });
  },

  clearAllGlobalFilters: () => {
    set((s) => ({ globalFilters: [], activeFilterCount: countFilters([], s.crossFilters) }));
  },

  toggleCrossFilter: (field, value) => {
    set((s) => {
      const cross = { ...s.crossFilters };
      const current = cross[field] ?? [];
      const has = current.includes(value);
      const next = has ? current.filter((v) => v !== value) : [...current, value];
      if (next.length === 0) {
        delete cross[field];
      } else {
        cross[field] = next;
      }
      return { crossFilters: cross, activeFilterCount: countFilters(s.globalFilters, cross) };
    });
  },

  setCrossFilter: (field, values) => {
    set((s) => {
      const cross = { ...s.crossFilters };
      if (values.length === 0) {
        delete cross[field];
      } else {
        cross[field] = values;
      }
      return { crossFilters: cross, activeFilterCount: countFilters(s.globalFilters, cross) };
    });
  },

  clearCrossFilter: (field) => {
    set((s) => {
      const cross = { ...s.crossFilters };
      delete cross[field];
      return { crossFilters: cross, activeFilterCount: countFilters(s.globalFilters, cross) };
    });
  },

  clearAllCrossFilters: () => {
    set((s) => ({ crossFilters: {}, activeFilterCount: countFilters(s.globalFilters, {}) }));
  },

  clearEverything: () => set({ globalFilters: [], crossFilters: {}, activeFilterCount: 0 }),

  getCombinedFilters: () => {
    const { globalFilters, crossFilters } = get();
    const result: { field: string; op: string; values: string[] }[] = [];

    for (const f of globalFilters) {
      result.push({ field: f.field, op: f.op, values: f.values });
    }

    for (const [field, values] of Object.entries(crossFilters)) {
      if (values.length > 0) {
        // Merge with existing global filter for same field
        const existing = result.find((r) => r.field === field);
        if (existing) {
          // Cross-filter narrows down: intersect
          const intersection = existing.values.filter((v) => values.includes(v));
          existing.values = intersection.length > 0 ? intersection : values;
        } else {
          result.push({ field, op: "in", values });
        }
      }
    }

    return result;
  },
}));

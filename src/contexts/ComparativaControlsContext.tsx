import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ComparisonMode } from "@/lib/dashboard-leads-analytics";

/** Solo lo que debe ser común a todos los bloques de comparativa en el dashboard. */
type ComparativaControlsContextValue = {
  compareMode: ComparisonMode;
  setCompareMode: (v: ComparisonMode) => void;
  compareDays: 7 | 14 | 21 | 28;
  setCompareDays: (v: 7 | 14 | 21 | 28) => void;
};

const ComparativaControlsContext = createContext<ComparativaControlsContextValue | null>(null);

export function ComparativaControlsProvider({ children }: { children: ReactNode }) {
  const [compareMode, setCompareMode] = useState<ComparisonMode>("prev_calendar_day");
  const [compareDays, setCompareDays] = useState<7 | 14 | 21 | 28>(14);

  const value = useMemo(
    () => ({
      compareMode,
      setCompareMode,
      compareDays,
      setCompareDays,
    }),
    [compareMode, compareDays],
  );

  return (
    <ComparativaControlsContext.Provider value={value}>{children}</ComparativaControlsContext.Provider>
  );
}

export function useComparativaControls(): ComparativaControlsContextValue {
  const ctx = useContext(ComparativaControlsContext);
  if (!ctx) {
    throw new Error("useComparativaControls debe usarse dentro de ComparativaControlsProvider");
  }
  return ctx;
}

import { useState, useCallback } from "react";
import { ComparativePeriod, getComparativeRange } from "@/lib/comparative-utils";

export function useComparative() {
  const [period, setPeriod] = useState<ComparativePeriod>("periodo_previo_equivalente");

  const getPreviousRange = useCallback((desde: string, hasta: string) => {
    return getComparativeRange(desde, hasta, period);
  }, [period]);

  return {
    period,
    setPeriod,
    getPreviousRange
  };
}

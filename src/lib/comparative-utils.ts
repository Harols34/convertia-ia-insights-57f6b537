import { 
  subDays, 
  subWeeks, 
  subMonths, 
  subYears, 
  format, 
  parseISO, 
  startOfDay, 
  endOfDay 
} from "date-fns";

export type ComparativePeriod = 
  | "ayer" 
  | "semana_anterior" 
  | "mes_anterior" 
  | "año_anterior" 
  | "periodo_previo_equivalente";

export function getComparativeRange(desde: string, hasta: string, period: ComparativePeriod) {
  const d = parseISO(desde);
  const h = parseISO(hasta);
  
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) {
    return { desde, hasta };
  }

  const diffDays = Math.round((h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  switch (period) {
    case "ayer":
      return {
        desde: format(subDays(d, 1), "yyyy-MM-dd"),
        hasta: format(subDays(h, 1), "yyyy-MM-dd"),
      };
    case "semana_anterior":
      return {
        desde: format(subWeeks(d, 1), "yyyy-MM-dd"),
        hasta: format(subWeeks(h, 1), "yyyy-MM-dd"),
      };
    case "mes_anterior":
      return {
        desde: format(subMonths(d, 1), "yyyy-MM-dd"),
        hasta: format(subMonths(h, 1), "yyyy-MM-dd"),
      };
    case "año_anterior":
      return {
        desde: format(subYears(d, 1), "yyyy-MM-dd"),
        hasta: format(subYears(h, 1), "yyyy-MM-dd"),
      };
    case "periodo_previo_equivalente":
    default:
      return {
        desde: format(subDays(d, diffDays), "yyyy-MM-dd"),
        hasta: format(subDays(h, diffDays), "yyyy-MM-dd"),
      };
  }
}

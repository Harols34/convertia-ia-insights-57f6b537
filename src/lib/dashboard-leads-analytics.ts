import {
  subDays,
  format,
  parseISO,
  startOfISOWeek,
  endOfISOWeek,
  eachDayOfInterval,
  isWithinInterval,
  getISODay,
  subMonths,
  endOfMonth,
  setDate,
  getDate,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  formatFilterChipValue,
  rowMatchesDimensionToken,
  filterTokenFromChartLabel,
  type LeadRow,
} from "@/lib/dashboard-leads";

export type NamedCount = { name: string; value: number };

export type DailyPoint = {
  date: string;
  leads: number;
  ventas: number;
  conGestion: number;
  conNegocio: number;
};

function parseLeadDate(row: LeadRow): Date | null {
  const s = row.fch_creacion;
  if (!s) return null;
  try {
    const d = parseISO(s.slice(0, 10));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function countByKey(leads: LeadRow[], key: keyof LeadRow): NamedCount[] {
  const map: Record<string, number> = {};
  for (const row of leads) {
    const v = row[key];
    const label = v == null || v === "" ? "(vacío)" : String(v);
    map[label] = (map[label] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Serie diaria (últimos `maxDays` con al menos un lead). */
export function buildDailySeries(leads: LeadRow[], maxDays = 90): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    const key = format(d, "yyyy-MM-dd");
    if (!map.has(key)) {
      map.set(key, { date: key, leads: 0, ventas: 0, conGestion: 0, conNegocio: 0 });
    }
    const p = map.get(key)!;
    p.leads += 1;
    if (row.es_venta) p.ventas += 1;
    if (row.result_prim_gestion && row.result_prim_gestion !== "") p.conGestion += 1;
    if (row.result_negocio && row.result_negocio !== "") p.conNegocio += 1;
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.slice(-maxDays).map(([, v]) => v);
}

export type WeeklyPoint = { weekStart: string; label: string; leads: number; ventas: number };

export function buildWeeklySeries(leads: LeadRow[], maxWeeks = 24): WeeklyPoint[] {
  const map = new Map<string, WeeklyPoint>();
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    const ws = startOfISOWeek(d);
    const key = format(ws, "yyyy-MM-dd");
    if (!map.has(key)) {
      map.set(key, {
        weekStart: key,
        label: format(ws, "d MMM", { locale: es }),
        leads: 0,
        ventas: 0,
      });
    }
    const p = map.get(key)!;
    p.leads += 1;
    if (row.es_venta) p.ventas += 1;
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return sorted.slice(-maxWeeks).map(([, v]) => v);
}

export type PeriodDelta = {
  current: number;
  previous: number;
  deltaPct: number;
  label: string;
};

export function compareRanges(
  leads: LeadRow[],
  curStart: Date,
  curEnd: Date,
  prevStart: Date,
  prevEnd: Date,
): { total: PeriodDelta; ventas: PeriodDelta; tasaVenta: PeriodDelta } {
  const inCur = (d: Date) => isWithinInterval(d, { start: curStart, end: curEnd });
  const inPrev = (d: Date) => isWithinInterval(d, { start: prevStart, end: prevEnd });

  let cTotal = 0,
    pTotal = 0,
    cVentas = 0,
    pVentas = 0;
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    if (inCur(d)) {
      cTotal += 1;
      if (row.es_venta) cVentas += 1;
    }
    if (inPrev(d)) {
      pTotal += 1;
      if (row.es_venta) pVentas += 1;
    }
  }

  const pct = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100);

  return {
    total: {
      current: cTotal,
      previous: pTotal,
      deltaPct: pct(cTotal, pTotal),
      label: "Leads",
    },
    ventas: {
      current: cVentas,
      previous: pVentas,
      deltaPct: pct(cVentas, pVentas),
      label: "Ventas",
    },
    tasaVenta: {
      current: cTotal ? (cVentas / cTotal) * 100 : 0,
      previous: pTotal ? (pVentas / pTotal) * 100 : 0,
      deltaPct:
        pTotal && cTotal
          ? (cVentas / cTotal) * 100 - (pVentas / pTotal) * 100
          : cTotal && cVentas
            ? 100
            : 0,
      label: "Tasa venta %",
    },
  };
}

/** Últimos 7 días calendario vs 7 días anteriores. */
export function compareLast7VsPrevious7(leads: LeadRow[]) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const curStart = subDays(end, 6);
  curStart.setHours(0, 0, 0, 0);
  const prevEnd = subDays(curStart, 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = subDays(prevEnd, 6);
  prevStart.setHours(0, 0, 0, 0);
  return compareRanges(leads, curStart, end, prevStart, prevEnd);
}

/** Semana ISO actual vs anterior. */
export function compareThisWeekVsLastWeek(leads: LeadRow[]) {
  const today = new Date();
  const curStart = startOfISOWeek(today, { weekStartsOn: 1 });
  const curEnd = endOfISOWeek(today, { weekStartsOn: 1 });
  const prevEnd = subDays(curStart, 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = startOfISOWeek(prevEnd, { weekStartsOn: 1 });
  return compareRanges(leads, curStart, curEnd, prevStart, prevEnd);
}

export type DailyStats = { leads: number; ventas: number };

/** Mapa fecha → conteos del día (creación del lead). */
export function buildDailyStatsMap(leads: LeadRow[]): Map<string, DailyStats> {
  const map = new Map<string, DailyStats>();
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    const key = format(d, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, { leads: 0, ventas: 0 });
    const p = map.get(key)!;
    p.leads += 1;
    if (row.es_venta) p.ventas += 1;
  }
  return map;
}

export type ComparisonMetric = "leads" | "ventas" | "efectividad";

export type ComparisonMode =
  | "prev_block"
  | "prev_calendar_day"
  | "same_weekday_prev_week"
  | "avg_weekday_historical"
  | "same_dom_prev_month";

export type ComparisonPoint = { label: string; actual: number; anterior: number };

/** Métrica genérica para comparativas (incluye cortes por resultado, agente, etc.). */
export type ComparativeSeriesSpec =
  | { kind: "leads" }
  | { kind: "ventas" }
  | { kind: "efectividad" }
  | { kind: "match_column"; column: keyof LeadRow; token: string };

type DayAgg = { leads: number; ventas: number; match: number };

/** Agregados por día: totales y, si aplica, filas que coinciden con `match_column`. */
export function buildDayAggMap(leads: LeadRow[], spec: ComparativeSeriesSpec): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>();
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    const key = format(d, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, { leads: 0, ventas: 0, match: 0 });
    const a = map.get(key)!;
    a.leads += 1;
    if (row.es_venta) a.ventas += 1;
    if (spec.kind === "match_column" && rowMatchesDimensionToken(row, spec.column, spec.token)) a.match += 1;
  }
  return map;
}

export function dayValueFromAgg(agg: DayAgg | undefined, spec: ComparativeSeriesSpec): number {
  if (!agg) return 0;
  if (spec.kind === "leads") return agg.leads;
  if (spec.kind === "ventas") return agg.ventas;
  if (spec.kind === "efectividad") return agg.leads > 0 ? (agg.ventas / agg.leads) * 100 : 0;
  return agg.match;
}

export function comparativeSpecTitle(spec: ComparativeSeriesSpec, dimensionLabel?: string): string {
  if (spec.kind === "leads") return "Leads captados";
  if (spec.kind === "ventas") return "Ventas (día)";
  if (spec.kind === "efectividad") return "Efectividad % (ventas/leads del día)";
  return `${dimensionLabel ?? String(spec.column)}: ${formatFilterChipValue(spec.token)}`;
}

/** Dimensiones habituales para comparar en el tiempo (conteo diario/semanal del valor elegido). */
export const COMPARATIVE_DIMENSION_SUBJECTS: { id: string; label: string; column: keyof LeadRow }[] = [
  { id: "res_prim", label: "Resultado 1ª gestión", column: "result_prim_gestion" },
  { id: "res_ult", label: "Resultado últ. gestión", column: "result_ultim_gestion" },
  { id: "res_neg", label: "Resultado negocio", column: "result_negocio" },
  { id: "ag_prim", label: "Agente 1ª gestión", column: "agente_prim_gestion" },
  { id: "ag_ult", label: "Agente últ. gestión", column: "agente_ultim_gestion" },
  { id: "ag_neg", label: "Agente negocio", column: "agente_negocio" },
];

/** Cortes adicionales en Comparativa: top valores por columna con la misma métrica y modos globales. */
export const COMPARATIVE_BREAKDOWN_GROUPS: { id: string; label: string; column: keyof LeadRow }[] = [
  { id: "ciudad", label: "Ciudad", column: "ciudad" },
  { id: "result_prim_gestion", label: "1ª gestión", column: "result_prim_gestion" },
  { id: "result_ultim_gestion", label: "Últ. gestión", column: "result_ultim_gestion" },
  { id: "result_negocio", label: "Negocio", column: "result_negocio" },
  { id: "tipo_llamada", label: "Tipo llamada", column: "tipo_llamada" },
  { id: "campana_mkt", label: "Campaña MKT", column: "campana_mkt" },
  { id: "categoria_mkt", label: "Canal MKT", column: "categoria_mkt" },
  { id: "campana_inconcert", label: "Campaña Inconcert", column: "campana_inconcert" },
  { id: "prim_resultado_marcadora", label: "Marcador", column: "prim_resultado_marcadora" },
  { id: "cliente", label: "Cliente", column: "cliente" },
  { id: "bpo", label: "BPO", column: "bpo" },
  { id: "keyword", label: "Keyword", column: "keyword" },
];

/** Tokens de dimensión con más volumen (para mini-widgets de comparativa). */
export function topDimensionTokensByVolume(leads: LeadRow[], column: keyof LeadRow, n: number): string[] {
  const ranked = countByKey(leads, column);
  return ranked.slice(0, n).map((r) => filterTokenFromChartLabel(r.name));
}

function weekdayAveragesForSpec(aggMap: Map<string, DayAgg>, spec: ComparativeSeriesSpec): number[] {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const [k, agg] of aggMap) {
    const d = parseISO(k);
    const iso = getISODay(d);
    const idx = iso === 7 ? 6 : iso - 1;
    buckets[idx]!.push(dayValueFromAgg(agg, spec));
  }
  return buckets.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0));
}

function metricFromStats(metric: ComparisonMetric, st: DailyStats | undefined): number {
  if (!st) return 0;
  if (metric === "leads") return st.leads;
  if (metric === "ventas") return st.ventas;
  return st.leads > 0 ? (st.ventas / st.leads) * 100 : 0;
}

/** Mismo número de día en el mes calendario anterior (p. ej. 24 mar → 24 feb). */
export function sameDayInPreviousCalendarMonth(day: Date): Date {
  const dom = getDate(day);
  const prevMonth = subMonths(day, 1);
  const last = endOfMonth(prevMonth);
  const safeDom = Math.min(dom, getDate(last));
  return setDate(prevMonth, safeDom);
}

function weekdayMetricAverages(map: Map<string, DailyStats>, metric: ComparisonMetric): number[] {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const [k, st] of map) {
    const d = parseISO(k);
    const iso = getISODay(d);
    const idx = iso === 7 ? 6 : iso - 1;
    buckets[idx]!.push(metricFromStats(metric, st));
  }
  return buckets.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0));
}

export const COMPARISON_MODE_META: Record<
  ComparisonMode,
  { label: string; comparisonLegend: string; subtitle: string }
> = {
  prev_block: {
    label: "Bloque previo (N días)",
    comparisonLegend: "Periodo anterior (alineado)",
    subtitle: "Mismo lapso calendario inmediatamente anterior",
  },
  prev_calendar_day: {
    label: "Día calendario anterior",
    comparisonLegend: "Día anterior",
    subtitle: "Cada día vs el día calendario previo (ayer respecto a ese punto)",
  },
  same_weekday_prev_week: {
    label: "Mismo día de la semana (−7 días)",
    comparisonLegend: "Hace 7 días (mismo weekday)",
    subtitle: "Lunes vs lunes anterior, martes vs martes, etc.",
  },
  avg_weekday_historical: {
    label: "Promedio histórico por weekday",
    comparisonLegend: "Promedio global por día de semana",
    subtitle: "Cada fecha vs el promedio de todos los {lun, mar…} en el universo filtrado",
  },
  same_dom_prev_month: {
    label: "Mismo día del mes anterior",
    comparisonLegend: "Mismo número de día, mes previo",
    subtitle: "Ej. 24 mar vs 24 feb (ajustado si el mes es más corto)",
  },
};

export const COMPARISON_METRIC_META: Record<ComparisonMetric, { label: string; short: string }> = {
  leads: { label: "Leads", short: "Leads" },
  ventas: { label: "Ventas", short: "Ventas" },
  efectividad: { label: "Efectividad (% conversión día)", short: "Efectividad %" },
};

/**
 * Serie comparativa en ventana de los últimos `n` días (hasta hoy).
 * `actual` = métrica en cada día; `anterior` según el modo elegido.
 */
export function buildComparisonSeries(
  leads: LeadRow[],
  n: number,
  metric: ComparisonMetric,
  mode: ComparisonMode,
): {
  points: ComparisonPoint[];
  meta: (typeof COMPARISON_MODE_META)[ComparisonMode];
  /** yyyy-MM-dd alineado a cada punto (filtrado cruzado por día). */
  dateKeys: string[];
} {
  const map = buildDailyStatsMap(leads);
  const meta = COMPARISON_MODE_META[mode];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const curStart = subDays(end, n - 1);
  curStart.setHours(0, 0, 0, 0);
  const daysCur = eachDayOfInterval({ start: curStart, end });

  const prevEnd = subDays(curStart, 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = subDays(prevEnd, n - 1);
  prevStart.setHours(0, 0, 0, 0);
  const daysPrev = eachDayOfInterval({ start: prevStart, end: prevEnd });

  const avgByWeekday = mode === "avg_weekday_historical" ? weekdayMetricAverages(map, metric) : null;

  const points: ComparisonPoint[] = daysCur.map((day, i) => {
    const key = format(day, "yyyy-MM-dd");
    const actual = metricFromStats(metric, map.get(key));

    let anterior = 0;
    if (mode === "prev_block") {
      const pday = daysPrev[i]!;
      anterior = metricFromStats(metric, map.get(format(pday, "yyyy-MM-dd")));
    } else if (mode === "prev_calendar_day") {
      anterior = metricFromStats(metric, map.get(format(subDays(day, 1), "yyyy-MM-dd")));
    } else if (mode === "same_weekday_prev_week") {
      anterior = metricFromStats(metric, map.get(format(subDays(day, 7), "yyyy-MM-dd")));
    } else if (mode === "avg_weekday_historical" && avgByWeekday) {
      const iso = getISODay(day);
      const idx = iso === 7 ? 6 : iso - 1;
      anterior = avgByWeekday[idx] ?? 0;
    } else if (mode === "same_dom_prev_month") {
      const ref = sameDayInPreviousCalendarMonth(day);
      anterior = metricFromStats(metric, map.get(format(ref, "yyyy-MM-dd")));
    }

    return {
      label: format(day, "EEE d", { locale: es }),
      actual,
      anterior,
    };
  });

  const dateKeys = daysCur.map((day) => format(day, "yyyy-MM-dd"));

  return { points, meta, dateKeys };
}

/**
 * Igual que `buildComparisonSeries` pero con cualquier `ComparativeSeriesSpec`
 * (leads, ventas, efectividad, conteo por resultado/agente, etc.).
 */
export function buildComparisonSeriesSpec(
  leads: LeadRow[],
  n: number,
  mode: ComparisonMode,
  spec: ComparativeSeriesSpec,
): {
  points: ComparisonPoint[];
  meta: (typeof COMPARISON_MODE_META)[ComparisonMode];
  dateKeys: string[];
} {
  const aggMap = buildDayAggMap(leads, spec);
  const meta = COMPARISON_MODE_META[mode];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const curStart = subDays(end, n - 1);
  curStart.setHours(0, 0, 0, 0);
  const daysCur = eachDayOfInterval({ start: curStart, end });

  const prevEnd = subDays(curStart, 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = subDays(prevEnd, n - 1);
  prevStart.setHours(0, 0, 0, 0);
  const daysPrev = eachDayOfInterval({ start: prevStart, end: prevEnd });

  const avgByWeekday = mode === "avg_weekday_historical" ? weekdayAveragesForSpec(aggMap, spec) : null;

  const points: ComparisonPoint[] = daysCur.map((day, i) => {
    const key = format(day, "yyyy-MM-dd");
    const actual = dayValueFromAgg(aggMap.get(key), spec);

    let anterior = 0;
    if (mode === "prev_block") {
      const pday = daysPrev[i]!;
      anterior = dayValueFromAgg(aggMap.get(format(pday, "yyyy-MM-dd")), spec);
    } else if (mode === "prev_calendar_day") {
      anterior = dayValueFromAgg(aggMap.get(format(subDays(day, 1), "yyyy-MM-dd")), spec);
    } else if (mode === "same_weekday_prev_week") {
      anterior = dayValueFromAgg(aggMap.get(format(subDays(day, 7), "yyyy-MM-dd")), spec);
    } else if (mode === "avg_weekday_historical" && avgByWeekday) {
      const iso = getISODay(day);
      const idx = iso === 7 ? 6 : iso - 1;
      anterior = avgByWeekday[idx] ?? 0;
    } else if (mode === "same_dom_prev_month") {
      const ref = sameDayInPreviousCalendarMonth(day);
      anterior = dayValueFromAgg(aggMap.get(format(ref, "yyyy-MM-dd")), spec);
    }

    return {
      label: format(day, "EEE d", { locale: es }),
      actual,
      anterior,
    };
  });

  const dateKeys = daysCur.map((day) => format(day, "yyyy-MM-dd"));

  return { points, meta, dateKeys };
}

/** Serie diaria larga (valores según spec) para tendencia. */
export function buildFullDailyTrendForSpec(
  leads: LeadRow[],
  maxDays: number,
  spec: ComparativeSeriesSpec,
): { date: string; value: number }[] {
  const m = buildDayAggMap(leads, spec);
  const sorted = [...m.keys()].sort((a, b) => a.localeCompare(b));
  const slice = sorted.slice(-maxDays);
  return slice.map((date) => ({ date, value: dayValueFromAgg(m.get(date), spec) }));
}

export function comparisonLineAlignedToDailySpec(
  leads: LeadRow[],
  trend: { date: string }[],
  spec: ComparativeSeriesSpec,
  mode: Exclude<DailyComparisonOverlayMode, "off">,
): number[] {
  const aggMap = buildDayAggMap(leads, spec);
  const avgByWeekday = mode === "avg_weekday_historical" ? weekdayAveragesForSpec(aggMap, spec) : null;

  return trend.map((pt) => {
    const day = parseISO(pt.date);
    if (mode === "prev_calendar_day") {
      return dayValueFromAgg(aggMap.get(format(subDays(day, 1), "yyyy-MM-dd")), spec);
    }
    if (mode === "same_weekday_prev_week") {
      return dayValueFromAgg(aggMap.get(format(subDays(day, 7), "yyyy-MM-dd")), spec);
    }
    if (mode === "same_dom_prev_month") {
      return dayValueFromAgg(aggMap.get(format(sameDayInPreviousCalendarMonth(day), "yyyy-MM-dd")), spec);
    }
    if (mode === "avg_weekday_historical" && avgByWeekday) {
      const iso = getISODay(day);
      const idx = iso === 7 ? 6 : iso - 1;
      return avgByWeekday[idx] ?? 0;
    }
    return 0;
  });
}

export type WeeklyScalarPoint = { weekStart: string; label: string; value: number };

export function buildWeeklySeriesForSpec(
  leads: LeadRow[],
  maxWeeks: number,
  spec: ComparativeSeriesSpec,
): WeeklyScalarPoint[] {
  const map = new Map<string, DayAgg>();
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    const wk = format(startOfISOWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    if (!map.has(wk)) map.set(wk, { leads: 0, ventas: 0, match: 0 });
    const b = map.get(wk)!;
    b.leads += 1;
    if (row.es_venta) b.ventas += 1;
    if (spec.kind === "match_column" && rowMatchesDimensionToken(row, spec.column, spec.token)) b.match += 1;
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-maxWeeks);
  return sorted.map(([weekStart, agg]) => ({
    weekStart,
    label: format(parseISO(weekStart), "d MMM", { locale: es }),
    value: dayValueFromAgg(agg, spec),
  }));
}

export function weeklyPreviousPeriodValues(rows: { value: number }[]): number[] {
  return rows.map((_, i) => (i > 0 ? rows[i - 1]!.value : 0));
}

/** Compat: solo leads, bloque previo. */
export function dateVsDateDaily(
  leads: LeadRow[],
  n = 14,
): { idx: number; label: string; actual: number; anterior: number }[] {
  const { points } = buildComparisonSeries(leads, n, "leads", "prev_block");
  return points.map((p, i) => ({ idx: i + 1, label: p.label, actual: p.actual, anterior: p.anterior }));
}

export type DailyComparisonOverlayMode =
  | "off"
  | "prev_calendar_day"
  | "same_weekday_prev_week"
  | "avg_weekday_historical"
  | "same_dom_prev_month";

/**
 * Línea de comparación alineada a cada punto de `buildDailySeries` (mismas fechas).
 */
export function comparisonLineAlignedToDaily(
  leads: LeadRow[],
  daily: DailyPoint[],
  metric: ComparisonMetric,
  mode: Exclude<DailyComparisonOverlayMode, "off">,
): number[] {
  const map = buildDailyStatsMap(leads);
  const avgByWeekday = mode === "avg_weekday_historical" ? weekdayMetricAverages(map, metric) : null;

  return daily.map((pt) => {
    const day = parseISO(pt.date);
    if (mode === "prev_calendar_day") {
      return metricFromStats(metric, map.get(format(subDays(day, 1), "yyyy-MM-dd")));
    }
    if (mode === "same_weekday_prev_week") {
      return metricFromStats(metric, map.get(format(subDays(day, 7), "yyyy-MM-dd")));
    }
    if (mode === "same_dom_prev_month") {
      return metricFromStats(metric, map.get(format(sameDayInPreviousCalendarMonth(day), "yyyy-MM-dd")));
    }
    if (mode === "avg_weekday_historical" && avgByWeekday) {
      const iso = getISODay(day);
      const idx = iso === 7 ? 6 : iso - 1;
      return avgByWeekday[idx] ?? 0;
    }
    return 0;
  });
}

/** Para gráfico semanal: valores de la semana ISO anterior (mismo índice en serie ordenada). */
export function weeklyPreviousWeekLine(weekly: WeeklyPoint[], field: "leads" | "ventas"): number[] {
  return weekly.map((_, i) => (i > 0 ? weekly[i - 1]![field] : 0));
}

export function funnelStages(leads: LeadRow[]): { name: string; value: number; rateFromTop: number }[] {
  const total = leads.length;
  if (!total) return [];
  const g1 = leads.filter((l) => l.result_prim_gestion && l.result_prim_gestion !== "").length;
  const g2 = leads.filter((l) => l.result_negocio && l.result_negocio !== "").length;
  const v = leads.filter((l) => l.es_venta).length;
  const stages = [
    { name: "Leads captados", value: total },
    { name: "Con 1ª gestión", value: g1 },
    { name: "Con resultado negocio", value: g2 },
    { name: "Ventas cerradas", value: v },
  ];
  return stages.map((s) => ({
    ...s,
    rateFromTop: total ? (s.value / total) * 100 : 0,
  }));
}

export function leadsByWeekday(leads: LeadRow[]): { day: string; count: number }[] {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const row of leads) {
    const d = parseLeadDate(row);
    if (!d) continue;
    const iso = getISODay(d);
    const idx = iso === 7 ? 6 : iso - 1;
    counts[idx] += 1;
  }
  return labels.map((day, i) => ({ day, count: counts[i] }));
}

const DIMENSION_META: { key: keyof LeadRow; label: string }[] = [
  { key: "cliente", label: "Cliente" },
  { key: "campana_mkt", label: "Campaña MKT" },
  { key: "campana_inconcert", label: "Campaña Inconcert" },
  { key: "categoria_mkt", label: "Categoría MKT" },
  { key: "ciudad", label: "Ciudad" },
  { key: "tipo_llamada", label: "Tipo llamada" },
  { key: "agente_prim_gestion", label: "Agente 1ª gestión" },
  { key: "agente_ultim_gestion", label: "Agente últ. gestión" },
  { key: "agente_negocio", label: "Agente negocio" },
  { key: "bpo", label: "BPO" },
  { key: "result_prim_gestion", label: "Resultado 1ª gestión" },
  { key: "result_ultim_gestion", label: "Resultado últ. gestión" },
  { key: "result_negocio", label: "Resultado negocio" },
  { key: "prim_resultado_marcadora", label: "Resultado marcador" },
  { key: "keyword", label: "Keyword" },
];

export type DiscoveredDimension = {
  key: keyof LeadRow;
  label: string;
  cardinality: number;
  top: NamedCount[];
};

/** Dimensiones con cardinalidad razonable para visualizar (2–40 valores distintos). */
export function discoverDimensions(leads: LeadRow[], minCard = 2, maxCard = 40, topN = 10): DiscoveredDimension[] {
  const out: DiscoveredDimension[] = [];
  for (const { key, label } of DIMENSION_META) {
    const counts = countByKey(leads, key);
    const card = counts.length;
    if (card < minCard || card > maxCard) continue;
    out.push({
      key,
      label,
      cardinality: card,
      top: counts.slice(0, topN),
    });
  }
  return out.sort((a, b) => b.top[0]!.value - a.top[0]!.value);
}

export type AgentEffRow = { name: string; value: number; ventas: number; tasa: number };

export function agentEffectivenessRows(leads: LeadRow[]): AgentEffRow[] {
  const map = new Map<string, { n: number; v: number }>();
  for (const row of leads) {
    const a = row.agente_prim_gestion?.trim();
    if (!a) continue;
    if (!map.has(a)) map.set(a, { n: 0, v: 0 });
    const o = map.get(a)!;
    o.n += 1;
    if (row.es_venta) o.v += 1;
  }
  return [...map.entries()]
    .map(([name, { n, v }]) => ({ name, value: n, ventas: v, tasa: n ? Math.round((v / n) * 1000) / 10 : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);
}

export function insightBullets(leads: LeadRow[], cmp7: ReturnType<typeof compareLast7VsPrevious7>): string[] {
  const bullets: string[] = [];
  if (!leads.length) return bullets;
  const tasa = (leads.filter((l) => l.es_venta).length / leads.length) * 100;
  bullets.push(`Tasa de conversión global: ${tasa.toFixed(1)}% sobre el universo filtrado.`);
  if (cmp7.total.deltaPct > 5) bullets.push(`Los últimos 7 días suman ${cmp7.total.deltaPct.toFixed(0)}% más leads que la semana previa.`);
  else if (cmp7.total.deltaPct < -5)
    bullets.push(`Caída de ${Math.abs(cmp7.total.deltaPct).toFixed(0)}% en leads en la última semana vs la anterior.`);
  const topCamp = countByKey(leads, "campana_mkt")[0];
  if (topCamp) bullets.push(`Campaña MKT líder: "${topCamp.name}" (${topCamp.value} leads).`);
  const topCity = countByKey(leads, "ciudad").filter((c) => c.name !== "(vacío)")[0];
  if (topCity) bullets.push(`Ciudad con más volumen: ${topCity.name} (${topCity.value}).`);
  return bullets.slice(0, 5);
}

export function sparklineFromDaily(daily: DailyPoint[], field: keyof Pick<DailyPoint, "leads" | "ventas">, max = 14): number[] {
  const slice = daily.slice(-max);
  return slice.map((d) => d[field]);
}

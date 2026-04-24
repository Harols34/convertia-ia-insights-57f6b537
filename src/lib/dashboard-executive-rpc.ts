import { endOfISOWeek, format, getISODay, parseISO, startOfISOWeek, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { LEADS_FILTER_EMPTY_TOKEN, type LeadRow, type LeadsDashboardFilters } from "@/lib/dashboard-leads";

type JsonObject = Record<string, Json | undefined>;

export type KpiSummary = {
  totalLeads: number;
  totalVentas: number;
  convPct: number;
  conGestion: number;
  conNegocio: number;
};

export type DeltaSummary = {
  current: number;
  previous: number;
  deltaPct: number;
  label: string;
};

export type DashboardExecutiveData = {
  kpis: KpiSummary;
  cmp7: { total: DeltaSummary; ventas: DeltaSummary; tasaVenta: DeltaSummary };
  cmpWeek: { total: DeltaSummary };
  daily: { date: string; leads: number; ventas: number }[];
  weekly: { weekStart: string; label: string; leads: number; ventas: number }[];
  funnel: { name: string; value: number }[];
  weekday: { day: string; count: number }[];
  porCampana: { name: string; value: number }[];
  porCiudad: { name: string; value: number }[];
  agents: { name: string; value: number; ventas: number }[];
  discovered: { key: keyof LeadRow; label: string; top: { name: string; value: number }[] }[];
  bullets: string[];
};

const DIMENSION_META: { key: keyof LeadRow; label: string }[] = [
  { key: "campana_mkt", label: "Campaña MKT" },
  { key: "ciudad", label: "Ciudad" },
  { key: "categoria_mkt", label: "Categoría MKT" },
  { key: "tipo_llamada", label: "Tipo llamada" },
  { key: "agente_prim_gestion", label: "Agente 1ª gestión" },
  { key: "agente_ultim_gestion", label: "Agente últ. gestión" },
  { key: "agente_negocio", label: "Agente negocio" },
  { key: "bpo", label: "BPO" },
  { key: "cliente", label: "Cliente" },
  { key: "result_prim_gestion", label: "Resultado 1ª gestión" },
  { key: "result_ultim_gestion", label: "Resultado últ. gestión" },
  { key: "result_negocio", label: "Resultado negocio" },
  { key: "prim_resultado_marcadora", label: "Resultado marcador" },
];

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toDelta(current: number, previous: number, label = ""): DeltaSummary {
  return {
    current,
    previous,
    deltaPct: previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100,
    label,
  };
}

function buildRpcFilters(filters: LeadsDashboardFilters): JsonObject | null {
  const out: JsonObject = {};
  if (filters.esVenta === "yes") out.es_venta = true;
  else if (filters.esVenta === "no") out.es_venta = false;

  for (const [key, values] of Object.entries(filters.dimensions) as [keyof LeadRow, string[]][]) {
    if (values?.length) out[key] = values;
  }

  return Object.keys(out).length ? out : null;
}

/** Clave estable para React Query; debe coincidir con lo que aplica el RPC vía `buildRpcFilters`. */
export function leadsFiltersQueryKey(filters: LeadsDashboardFilters): string {
  const { esVenta, desde, hasta, dimensions } = filters;
  const dimKeys = Object.keys(dimensions).sort() as (keyof LeadRow)[];
  const dimPart = dimKeys
    .map((k) => {
      const vals = dimensions[k] ?? [];
      return `${String(k)}=${[...vals].sort().join("\u0001")}`;
    })
    .join("\u0002");
  return `v1|es:${esVenta}|d:${desde ?? ""}|h:${hasta ?? ""}|${dimPart}`;
}

/**
 * Acepta el JSON de `accessible_leads_group_metrics` (dimension, leads, ventas)
 * y el de `accessible_leads_agent_metrics` (name, value, ventas).
 */
function normalizeGroupRows(rows: unknown): { name: string; value: number; ventas: number }[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const nameRaw = item.dimension ?? item.name;
      const hasLeads = item.leads !== undefined && item.leads !== null;
      const value = toNumber(hasLeads ? item.leads : item.value);
      return {
        name: nameRaw != null && String(nameRaw) !== "" ? String(nameRaw) : "(vacío)",
        value,
        ventas: toNumber(item.ventas),
      };
    })
    .filter((row) => row.value > 0);
}

function normalizeTimeseries(rows: unknown) {
  if (!Array.isArray(rows)) return [] as { bucket: string; value: number }[];
  return rows
    .map((row) => row as Record<string, unknown>)
    .filter((row) => row.bucket)
    .map((row) => ({ bucket: String(row.bucket).slice(0, 10), value: toNumber(row.value) }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function mergeDailySeries(
  leadsRows: { bucket: string; value: number }[],
  ventasRows: { bucket: string; value: number }[],
): { date: string; leads: number; ventas: number }[] {
  const map = new Map<string, { date: string; leads: number; ventas: number }>();
  for (const row of leadsRows) map.set(row.bucket, { date: row.bucket, leads: row.value, ventas: 0 });
  for (const row of ventasRows) {
    const existing = map.get(row.bucket) ?? { date: row.bucket, leads: 0, ventas: 0 };
    existing.ventas = row.value;
    map.set(row.bucket, existing);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeWeeklySeries(
  leadsRows: { bucket: string; value: number }[],
  ventasRows: { bucket: string; value: number }[],
): { weekStart: string; label: string; leads: number; ventas: number }[] {
  const merged = mergeDailySeries(leadsRows, ventasRows);
  return merged.map((row) => ({
    weekStart: row.date,
    label: format(parseISO(row.date), "d MMM"),
    leads: row.leads,
    ventas: row.ventas,
  }));
}

function normalizeWeekday(rows: unknown): { day: string; count: number }[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as Record<string, unknown>;
    return { day: String(item.day ?? "—"), count: toNumber(item.count) };
  });
}

function buildFunnel(data: unknown): { name: string; value: number }[] {
  const item = (data ?? {}) as Record<string, unknown>;
  return [
    { name: "Leads", value: toNumber(item.total) },
    { name: "1ª gestión", value: toNumber(item.con_prim_gestion) },
    { name: "Últ. gestión", value: toNumber(item.con_ultim_gestion) },
    { name: "Negocio", value: toNumber(item.con_negocio) },
    { name: "Venta", value: toNumber(item.ventas) },
  ].filter((row) => row.value > 0);
}

function buildBullets(kpis: KpiSummary, cmp7: { total: DeltaSummary; ventas: DeltaSummary }, topCamp: string, topCity: string) {
  const bullets: string[] = [];
  bullets.push(
    cmp7.total.deltaPct >= 0
      ? `El volumen creció ${Math.abs(cmp7.total.deltaPct).toFixed(1)}% frente a los 7 días previos.`
      : `El volumen cayó ${Math.abs(cmp7.total.deltaPct).toFixed(1)}% frente a los 7 días previos.`,
  );
  bullets.push(
    cmp7.ventas.deltaPct >= 0
      ? `Las ventas subieron ${Math.abs(cmp7.ventas.deltaPct).toFixed(1)}% en la última semana.`
      : `Las ventas bajaron ${Math.abs(cmp7.ventas.deltaPct).toFixed(1)}% en la última semana.`,
  );
  if (topCamp) bullets.push(`La campaña con mayor volumen actual es ${topCamp}.`);
  if (topCity) bullets.push(`La ciudad más activa en el filtro actual es ${topCity}.`);
  bullets.push(`La conversión agregada se ubica en ${kpis.convPct.toFixed(1)}% con ${kpis.totalVentas.toLocaleString("es")} ventas.`);
  return bullets.slice(0, 4);
}

export async function fetchExecutiveDashboardData(filters: LeadsDashboardFilters): Promise<DashboardExecutiveData> {
  const rpcFilters = buildRpcFilters(filters);
  const desde = filters.desde ?? null;
  const hasta = filters.hasta ?? null;

  const now = new Date();
  const end = format(now, "yyyy-MM-dd");
  const start7 = format(subDays(now, 6), "yyyy-MM-dd");
  const prevEnd = format(subDays(now, 7), "yyyy-MM-dd");
  const prevStart = format(subDays(now, 13), "yyyy-MM-dd");
  const currentIsoWeekStart = format(startOfISOWeek(now), "yyyy-MM-dd");
  const previousIsoWeekEnd = format(subDays(parseISO(currentIsoWeekStart), 1), "yyyy-MM-dd");
  const previousIsoWeekStart = format(startOfISOWeek(parseISO(previousIsoWeekEnd)), "yyyy-MM-dd");
  const currentIsoWeekEnd = format(endOfISOWeek(parseISO(currentIsoWeekStart)), "yyyy-MM-dd");

  const [
    kpiRes,
    dailyLeadsRes,
    dailyVentasRes,
    weeklyLeadsRes,
    weeklyVentasRes,
    funnelRes,
    weekdayRes,
    campRes,
    cityRes,
    agentRes,
    cmp7CurRes,
    cmp7PrevRes,
    cmp7VentasCurRes,
    cmp7VentasPrevRes,
    cmpWeekCurRes,
    cmpWeekPrevRes,
    discoveredResponses,
  ] = await Promise.all([
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_timeseries", { _metric: "leads", _granularity: "day", _limit: 120, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_timeseries", { _metric: "ventas", _granularity: "day", _limit: 120, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_timeseries", { _metric: "leads", _granularity: "week", _limit: 20, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_timeseries", { _metric: "ventas", _granularity: "week", _limit: 20, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_funnel", { _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_weekday_metrics", { _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "campana_mkt", _limit: 12, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "ciudad", _limit: 16, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_agent_metrics", { _field: "agente_prim_gestion", _limit: 12, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: start7, _fecha_hasta: end, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: prevStart, _fecha_hasta: prevEnd, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: start7, _fecha_hasta: end, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: prevStart, _fecha_hasta: prevEnd, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: currentIsoWeekStart, _fecha_hasta: currentIsoWeekEnd, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: previousIsoWeekStart, _fecha_hasta: previousIsoWeekEnd, _filters: rpcFilters }),
    Promise.all(
      DIMENSION_META.map((meta) =>
        supabase.rpc("accessible_leads_group_metrics", {
          _dimension: meta.key,
          _limit: 10,
          _fecha_desde: desde,
          _fecha_hasta: hasta,
          _filters: rpcFilters,
        }),
      ),
    ),
  ]);

  const maybeErrors = [
    kpiRes.error,
    dailyLeadsRes.error,
    dailyVentasRes.error,
    weeklyLeadsRes.error,
    weeklyVentasRes.error,
    funnelRes.error,
    weekdayRes.error,
    campRes.error,
    cityRes.error,
    agentRes.error,
    cmp7CurRes.error,
    cmp7PrevRes.error,
    cmp7VentasCurRes.error,
    cmp7VentasPrevRes.error,
    cmpWeekCurRes.error,
    cmpWeekPrevRes.error,
    ...discoveredResponses.map((res) => res.error),
  ].filter(Boolean);

  if (maybeErrors.length > 0) throw maybeErrors[0];

  const kpiData = (kpiRes.data ?? {}) as Record<string, unknown>;
  const kpis: KpiSummary = {
    totalLeads: toNumber(kpiData.total_leads),
    totalVentas: toNumber(kpiData.total_ventas),
    convPct: toNumber(kpiData.conv_pct),
    conGestion: toNumber(kpiData.con_gestion),
    conNegocio: toNumber(kpiData.con_negocio),
  };

  const daily = mergeDailySeries(normalizeTimeseries(dailyLeadsRes.data), normalizeTimeseries(dailyVentasRes.data));
  const weekly = mergeWeeklySeries(normalizeTimeseries(weeklyLeadsRes.data), normalizeTimeseries(weeklyVentasRes.data));
  const porCampana = normalizeGroupRows(campRes.data).map((row) => ({ name: row.name, value: row.value }));
  const porCiudad = normalizeGroupRows(cityRes.data).map((row) => ({ name: row.name, value: row.value }));
  const agents = normalizeGroupRows(agentRes.data);
  const discovered = discoveredResponses
    .map((res, idx) => ({ meta: DIMENSION_META[idx]!, rows: normalizeGroupRows(res.data) }))
    .filter(({ rows }) => rows.length >= 2 && rows.length <= 10)
    .map(({ meta, rows }) => ({ key: meta.key, label: meta.label, top: rows.map((row) => ({ name: row.name, value: row.value })) }));

  const cmp7Cur = (cmp7CurRes.data ?? {}) as Record<string, unknown>;
  const cmp7Prev = (cmp7PrevRes.data ?? {}) as Record<string, unknown>;
  const cmpWeekCur = (cmpWeekCurRes.data ?? {}) as Record<string, unknown>;
  const cmpWeekPrev = (cmpWeekPrevRes.data ?? {}) as Record<string, unknown>;

  const curConv = toNumber(cmp7Cur.total_leads) > 0 ? (toNumber(cmp7Cur.total_ventas) / toNumber(cmp7Cur.total_leads)) * 100 : 0;
  const prevConv = toNumber(cmp7Prev.total_leads) > 0 ? (toNumber(cmp7Prev.total_ventas) / toNumber(cmp7Prev.total_leads)) * 100 : 0;
  const cmp7 = {
    total: toDelta(toNumber(cmp7Cur.total_leads), toNumber(cmp7Prev.total_leads)),
    ventas: toDelta(toNumber(cmp7Cur.total_ventas), toNumber(cmp7Prev.total_ventas)),
    tasaVenta: toDelta(curConv, prevConv),
  };
  const cmpWeek = {
    total: toDelta(toNumber(cmpWeekCur.total_leads), toNumber(cmpWeekPrev.total_leads)),
  };

  return {
    kpis,
    cmp7,
    cmpWeek,
    daily,
    weekly,
    funnel: buildFunnel(funnelRes.data),
    weekday: normalizeWeekday(weekdayRes.data),
    porCampana,
    porCiudad,
    agents,
    discovered,
    bullets: buildBullets(kpis, cmp7, porCampana[0]?.name ?? "", porCiudad[0]?.name ?? ""),
  };
}

export async function fetchDashboardFilterOptions(): Promise<Partial<Record<keyof LeadRow, string[]>>> {
  const { data, error } = await supabase.rpc("accessible_leads_dimensions");
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  const map: Partial<Record<keyof LeadRow, string[]>> = {
    cliente: (raw.clientes as string[] | undefined) ?? [],
    campana_mkt: (raw.campanas_mkt as string[] | undefined) ?? [],
    campana_inconcert: (raw.campanas_inconcert as string[] | undefined) ?? [],
    categoria_mkt: (raw.categorias_mkt as string[] | undefined) ?? [],
    ciudad: (raw.ciudades as string[] | undefined) ?? [],
    tipo_llamada: (raw.tipos_llamada as string[] | undefined) ?? [],
    agente_prim_gestion: (raw.agentes_prim_gestion as string[] | undefined) ?? [],
    agente_ultim_gestion: (raw.agentes_ultim_gestion as string[] | undefined) ?? [],
    agente_negocio: (raw.agentes_negocio as string[] | undefined) ?? [],
    bpo: (raw.bpos as string[] | undefined) ?? [],
    result_prim_gestion: (raw.resultados_prim_gestion as string[] | undefined) ?? [],
    result_ultim_gestion: (raw.resultados_ultim_gestion as string[] | undefined) ?? [],
    result_negocio: (raw.resultados_negocio as string[] | undefined) ?? [],
    prim_resultado_marcadora: (raw.prim_resultado_marcadora as string[] | undefined) ?? [],
  };
  for (const key of Object.keys(map) as (keyof LeadRow)[]) {
    if (!map[key]?.includes(LEADS_FILTER_EMPTY_TOKEN)) continue;
  }
  return map;
}

/**
 * Calcula una serie "overlay" (línea de comparación) alineada a la tendencia diaria del RPC.
 * Permite que los gráficos de Comparativa muestren la línea de "día anterior", "−7 días", etc.
 * sin necesidad de descargar el universo de leads en cliente.
 */
export type RpcOverlayMode =
  | "prev_calendar_day"
  | "same_weekday_prev_week"
  | "same_dom_prev_month"
  | "avg_weekday_historical";

export function comparisonLineFromRpcDaily(
  daily: { date: string; leads: number; ventas: number }[],
  trend: { date: string; value: number }[],
  metric: "leads" | "ventas" | "efectividad",
  mode: RpcOverlayMode,
): number[] {
  const map = new Map<string, { leads: number; ventas: number }>();
  for (const row of daily) {
    map.set(row.date.slice(0, 10), { leads: row.leads, ventas: row.ventas });
  }
  const valueOf = (key: string): number => {
    const r = map.get(key);
    if (!r) return 0;
    if (metric === "leads") return r.leads;
    if (metric === "ventas") return r.ventas;
    return r.leads > 0 ? (r.ventas / r.leads) * 100 : 0;
  };

  // Promedios por día de semana (lun=0..dom=6) para modo histórico.
  let avgByWeekday: number[] | null = null;
  if (mode === "avg_weekday_historical") {
    const sums = new Array<number>(7).fill(0);
    const counts = new Array<number>(7).fill(0);
    for (const row of daily) {
      const d = parseISO(row.date.slice(0, 10));
      if (Number.isNaN(d.getTime())) continue;
      const iso = getISODay(d);
      const idx = iso === 7 ? 6 : iso - 1;
      sums[idx]! += metric === "leads" ? row.leads : metric === "ventas" ? row.ventas : (row.leads > 0 ? (row.ventas / row.leads) * 100 : 0);
      counts[idx]! += 1;
    }
    avgByWeekday = sums.map((s, i) => (counts[i]! > 0 ? s / counts[i]! : 0));
  }

  return trend.map((pt) => {
    const day = parseISO(pt.date);
    if (Number.isNaN(day.getTime())) return 0;
    if (mode === "prev_calendar_day") return valueOf(format(subDays(day, 1), "yyyy-MM-dd"));
    if (mode === "same_weekday_prev_week") return valueOf(format(subDays(day, 7), "yyyy-MM-dd"));
    if (mode === "same_dom_prev_month") {
      const prev = new Date(day.getFullYear(), day.getMonth() - 1, day.getDate());
      return valueOf(format(prev, "yyyy-MM-dd"));
    }
    if (mode === "avg_weekday_historical" && avgByWeekday) {
      const iso = getISODay(day);
      const idx = iso === 7 ? 6 : iso - 1;
      return avgByWeekday[idx] ?? 0;
    }
    return 0;
  });
}
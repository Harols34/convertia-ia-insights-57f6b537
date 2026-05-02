import { endOfISOWeek, format, getISODay, parseISO, startOfISOWeek, subDays, subYears } from "date-fns";
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

export type StrategicScorecard = {
  leads: number;
  ventas: number;
  efectividad: number;
  contactabilidad: number;
  gestionados: number;
  no_gestionados: number;
  abandonos: number;
  avg_ttf_min: number;
};

export type DimensionRow = {
  name: string;
  leads: number;
  ventas: number;
  contactados: number;
  conv_pct: number;
  contactabilidad_pct: number;
};

export type DashboardExecutiveData = {
  kpis: KpiSummary;
  strategic: {
    actual: StrategicScorecard;
    anterior: { leads: number; ventas: number };
  };
  cmp7: { total: DeltaSummary; ventas: DeltaSummary; tasaVenta: DeltaSummary };
  cmpWeek: { total: DeltaSummary };
  daily: { date: string; leads: number; ventas: number; contactados: number; gestionados: number }[];
  hourly: { hora: string; leads: number; ventas: number; contactados: number }[];
  weekly: { weekStart: string; label: string; leads: number; ventas: number }[];
  funnel: { name: string; value: number }[];
  weekday: { day: string; count: number }[];
  
  // Dimensional analytics
  porCampanaMkt: DimensionRow[];
  porCampanaInconcert: DimensionRow[];
  porCliente: DimensionRow[];
  porCiudad: DimensionRow[];
  porAgente: DimensionRow[];
  porTipoLlamada: DimensionRow[];
  
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

/**
 * TODO: La definición de 'es_venta' puede variar por campaña (venta fijo, venta movil, etc.).
 * Actualmente el RPC centraliza este flag; si se requieren métricas de facturación
 * más finas, se debe extender la lógica del COUNT(*) FILTER en el servidor.
 */
export function buildRpcFilters(filters: LeadsDashboardFilters): JsonObject | null {
  const out: JsonObject = {};
  if (filters.esVenta === "yes") out.es_venta = true;
  else if (filters.esVenta === "no") out.es_venta = false;

  for (const [key, values] of Object.entries(filters.dimensions) as [keyof LeadRow, string[]][]) {
    if (values?.length) out[key] = values;
  }

  return out;
}

export function buildRpcFiltersFromDimensions(dimensions: Partial<Record<keyof LeadRow, string[]>>): JsonObject | null {
  const out: JsonObject = {};
  for (const [key, values] of Object.entries(dimensions) as [keyof LeadRow, string[]][]) {
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
function normalizeGroupRows(rows: unknown): DimensionRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const nameRaw = item.dimension ?? item.name;
      const leads = toNumber(item.leads ?? item.value);
      return {
        name: nameRaw != null && String(nameRaw) !== "" ? String(nameRaw) : "(vacío)",
        leads,
        ventas: toNumber(item.ventas),
        contactados: toNumber(item.contactados),
        conv_pct: toNumber(item.conv_pct),
        contactabilidad_pct: toNumber(item.contactabilidad_pct),
      };
    })
    .filter((row) => row.leads > 0);
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
  
  // Tendencia de Volumen
  const volText = cmp7.total.deltaPct >= 0
    ? `Crecimiento: El volumen de leads subió un ${Math.abs(cmp7.total.deltaPct).toFixed(1)}% esta semana.`
    : `Alerta: Caída del ${Math.abs(cmp7.total.deltaPct).toFixed(1)}% en la entrada de leads frente a la semana pasada.`;
  bullets.push(volText);

  // Conversión
  if (kpis.convPct > 10) {
    bullets.push(`Rendimiento Alto: La tasa de conversión del ${kpis.convPct.toFixed(1)}% supera el objetivo base.`);
  } else if (kpis.convPct > 0) {
    bullets.push(`Conversión Actual: Se mantiene en ${kpis.convPct.toFixed(1)}%. Hay oportunidad de optimizar el cierre.`);
  }

  // Dimensiones Top
  if (topCamp && topCamp !== LEADS_FILTER_EMPTY_TOKEN) {
    bullets.push(`Foco MKT: La campaña "${topCamp}" es el principal motor de registros actualmente.`);
  }
  if (topCity && topCity !== LEADS_FILTER_EMPTY_TOKEN) {
    bullets.push(`Región Clave: ${topCity} concentra la mayor actividad territorial del periodo.`);
  }

  // Gestión
  const gestionPct = kpis.totalLeads > 0 ? (kpis.conGestion / kpis.totalLeads) * 100 : 0;
  if (gestionPct < 80 && kpis.totalLeads > 10) {
    bullets.push(`Atención: Solo el ${gestionPct.toFixed(1)}% de los leads han sido contactados. Revisar capacidad operativa.`);
  }

  return bullets.slice(0, 5);
}
export async function fetchExecutiveDashboardData(filters: LeadsDashboardFilters, comparativePeriod: string = "prev_period"): Promise<DashboardExecutiveData> {
  const rpcFilters = buildRpcFilters(filters);
  const desde = filters.desde ?? format(subDays(new Date(), 30), "yyyy-MM-dd");
  const hasta = filters.hasta ?? format(new Date(), "yyyy-MM-dd");

  const now = new Date();
  const end = hasta || format(now, "yyyy-MM-dd");
  const start = desde || format(subDays(parseISO(end), 29), "yyyy-MM-dd");
  
  const dateStart = parseISO(start);
  const dateEnd = parseISO(end);
  const diffDays = Math.ceil((dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  let prevStart: string;
  let prevEnd: string;

  if (comparativePeriod === "prev_year") {
    prevStart = format(subYears(dateStart, 1), "yyyy-MM-dd");
    prevEnd = format(subYears(dateEnd, 1), "yyyy-MM-dd");
  } else {
    // Default: Periodo anterior inmediato
    prevEnd = format(subDays(dateStart, 1), "yyyy-MM-dd");
    prevStart = format(subDays(parseISO(prevEnd), diffDays - 1), "yyyy-MM-dd");
  }
  
  const currentIsoWeekStart = format(startOfISOWeek(dateEnd), "yyyy-MM-dd");
  const previousIsoWeekEnd = format(subDays(parseISO(currentIsoWeekStart), 1), "yyyy-MM-dd");
  const previousIsoWeekStart = format(startOfISOWeek(parseISO(previousIsoWeekEnd)), "yyyy-MM-dd");
  const currentIsoWeekEnd = format(endOfISOWeek(parseISO(currentIsoWeekStart)), "yyyy-MM-dd");

  const [
    kpiRes,
    strategicRes,
    dailyRes,
    hourlyRes,
    weeklyLeadsRes,
    weeklyVentasRes,
    funnelRes,
    weekdayRes,
    campMktRes,
    campIncRes,
    cityRes,
    agentRes,
    clientRes,
    callTypeRes,
    cmp7CurRes,
    cmp7PrevRes,
    cmpWeekCurRes,
    cmpWeekPrevRes,
    dailyPrevRes,
    discoveredResponses,
  ] = await Promise.all([
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("get_strategic_bi_scorecard", { 
      _tenant_id: (await supabase.auth.getSession()).data.session?.user.id,
      _fecha_desde: desde, 
      _fecha_hasta: hasta, 
      _filters: rpcFilters 
    }),
    supabase.from('mv_leads_daily')
      .select('dia, leads, ventas, contactados, gestionados, total_ttf_min')
      .gte('dia', desde)
      .lte('dia', hasta)
      .order('dia', { ascending: true }),
    supabase.from('mv_leads_hourly')
      .select('hora, leads, ventas, contactados')
      .gte('hora', `${desde} 00:00:00`)
      .lte('hora', `${hasta} 23:59:59`)
      .order('hora', { ascending: true }),
    supabase.rpc("accessible_leads_timeseries", { _metric: "leads", _granularity: "week", _limit: 20, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_timeseries", { _metric: "ventas", _granularity: "week", _limit: 20, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_funnel", { _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_weekday_metrics", { _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "campana_mkt", _limit: 15, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "campana_inconcert", _limit: 15, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "ciudad", _limit: 15, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "agente_prim_gestion", _limit: 15, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "cliente", _limit: 15, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_group_metrics", { _dimension: "tipo_llamada", _limit: 15, _fecha_desde: desde, _fecha_hasta: hasta, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: start, _fecha_hasta: end, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: prevStart, _fecha_hasta: prevEnd, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: currentIsoWeekStart, _fecha_hasta: currentIsoWeekEnd, _filters: rpcFilters }),
    supabase.rpc("accessible_leads_kpis", { _fecha_desde: previousIsoWeekStart, _fecha_hasta: previousIsoWeekEnd, _filters: rpcFilters }),
    supabase.from('mv_leads_daily')
      .select('dia, leads, ventas')
      .gte('dia', prevStart)
      .lte('dia', prevEnd)
      .order('dia', { ascending: true }),
    Promise.all(
      DIMENSION_META.map((meta) =>
          supabase.rpc("accessible_leads_group_metrics", {
            _dimension: meta.key,
            _limit: 10,
            _fecha_desde: desde,
            _fecha_hasta: hasta,
            _filters: rpcFilters,
          })
      )
    ),
  ]);

  // Aggregate daily data by date to avoid multiple points per day
  let totalLeadsCalc = 0;
  let totalVentasCalc = 0;
  let totalContactadosCalc = 0;
  let totalGestionadosCalc = 0;
  let ttfSum = 0;
  let ttfCount = 0;

  const dailyMap = new Map<string, any>();
  (dailyRes?.data ?? []).forEach(d => {
    const date = String(d.dia).slice(0, 10);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, leads: 0, ventas: 0, contactados: 0, gestionados: 0 });
    }
    const entry = dailyMap.get(date);
    const l = toNumber(d.leads);
    const v = toNumber(d.ventas);
    const c = toNumber(d.contactados);
    const g = toNumber(d.gestionados);
    const ttf = toNumber(d.total_ttf_min);

    entry.leads += l;
    entry.ventas += v;
    entry.contactados += c;
    entry.gestionados += g;

    totalLeadsCalc += l;
    totalVentasCalc += v;
    totalContactadosCalc += c;
    totalGestionadosCalc += g;

    if (ttf > 0) {
      ttfSum += ttf;
      ttfCount += g;
    }
  });
  // Merge comparison daily data
  const prevDailyArray = (dailyPrevRes?.data ?? []).map(d => ({
    date: String(d.dia).slice(0, 10),
    leads: toNumber(d.leads),
    ventas: toNumber(d.ventas)
  })).sort((a, b) => a.date.localeCompare(b.date));

  const currentDailyArray = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
  // Align by index (Day 1 current vs Day 1 prev)
  currentDailyArray.forEach((day, idx) => {
    if (prevDailyArray[idx]) {
      day.prev_leads = prevDailyArray[idx].leads;
      day.prev_ventas = prevDailyArray[idx].ventas;
    } else {
      day.prev_leads = 0;
      day.prev_ventas = 0;
    }
  });

  const daily = currentDailyArray;

  // Aggregate hourly data by hour
  const hourlyMap = new Map<string, any>();
  (hourlyRes?.data ?? []).forEach(d => {
    const hora = d.hora;
    if (!hourlyMap.has(hora)) {
      hourlyMap.set(hora, { hora, leads: 0, ventas: 0, contactados: 0 });
    }
    const entry = hourlyMap.get(hora);
    entry.leads += toNumber(d.leads);
    entry.ventas += toNumber(d.ventas);
    entry.contactados += toNumber(d.contactados);
  });
  const hourly = Array.from(hourlyMap.values()).sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

  const kpiData = (kpiRes.data ?? {}) as Record<string, unknown>;
  const kpis: KpiSummary = {
    totalLeads: toNumber(kpiData.total_leads),
    totalVentas: toNumber(kpiData.total_ventas),
    convPct: toNumber(kpiData.conv_pct),
    conGestion: toNumber(kpiData.con_gestion),
    conNegocio: toNumber(kpiData.con_negocio),
  };

  const strategic = (strategicRes.data ?? { 
    actual: { leads: 0, ventas: 0, efectividad: 0, contactabilidad: 0, gestionados: 0, no_gestionados: 0, abandonos: 0, avg_ttf_min: 0 },
    anterior: { leads: 0, ventas: 0 }
  }) as DashboardExecutiveData['strategic'];

  // Fallback: If strategic is zero but kpis have data, use kpis
  if (strategic.actual.leads === 0 && (kpis.totalLeads > 0 || totalLeadsCalc > 0)) {
    strategic.actual.leads = kpis.totalLeads || totalLeadsCalc;
    strategic.actual.ventas = kpis.totalVentas || totalVentasCalc;
    strategic.actual.efectividad = kpis.convPct || (strategic.actual.leads > 0 ? (strategic.actual.ventas / strategic.actual.leads) * 100 : 0);
    strategic.actual.gestionados = kpis.conGestion || totalGestionadosCalc;
  }

  // Independent fallbacks for contactability and TTF
  const l_base = toNumber(strategic.actual.leads);
  const g_base = toNumber(strategic.actual.gestionados);
  
  if ((!strategic.actual.contactabilidad || strategic.actual.contactabilidad === 0) && l_base > 0) {
    // If view fails, use totalContactadosCalc if present, or fallback to gestionados/leads (User request)
    const baseContactos = totalContactadosCalc || g_base || totalGestionadosCalc || kpis.conGestion;
    strategic.actual.contactabilidad = (baseContactos / l_base) * 100;
  }

  // Robust fallback for TTF: Sampling individual leads if the aggregate is 0
  if (strategic.actual.avg_ttf_min === 0 && strategic.actual.gestionados > 0) {
    if (ttfCount > 0 && ttfSum > 0) {
      strategic.actual.avg_ttf_min = ttfSum / ttfCount;
    } else {
      // Manual sampling as last resort (User suggested logic)
      const { data: sample } = await supabase
        .from('leads')
        .select('fch_creacion, fch_prim_gestion')
        .not('fch_prim_gestion', 'is', null)
        .gte('fch_creacion', desde)
        .lte('fch_creacion', hasta)
        .limit(500);
      
      if (sample && sample.length > 0) {
        let sum = 0;
        let count = 0;
        sample.forEach(s => {
          const start = new Date(s.fch_creacion).getTime();
          const end = new Date(s.fch_prim_gestion).getTime();
          if (!isNaN(start) && !isNaN(end) && end > start) {
            sum += (end - start) / 60000;
            count++;
          }
        });
        if (count > 0) strategic.actual.avg_ttf_min = sum / count;
      }
    }
  }

  const weekly = mergeWeeklySeries(normalizeTimeseries(weeklyLeadsRes.data), normalizeTimeseries(weeklyVentasRes.data));
  
  const porCampanaMkt = normalizeGroupRows(campMktRes.data);
  const porCampanaInconcert = normalizeGroupRows(campIncRes.data);
  const porCiudad = normalizeGroupRows(cityRes.data);
  const porAgente = normalizeGroupRows(agentRes.data);
  const porCliente = normalizeGroupRows(clientRes.data);
  const porTipoLlamada = normalizeGroupRows(callTypeRes.data);

  const discovered = discoveredResponses
    .map((res, idx) => ({ meta: DIMENSION_META[idx]!, rows: normalizeGroupRows(res.data) }))
    .filter(({ rows }) => rows.length >= 2 && rows.length <= 10)
    .map(({ meta, rows }) => ({ key: meta.key, label: meta.label, top: rows.map((row) => ({ name: row.name, value: row.leads })) }));

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
    strategic,
    cmp7,
    cmpWeek,
    daily,
    hourly,
    weekly,
    funnel: buildFunnel(funnelRes.data),
    weekday: normalizeWeekday(weekdayRes.data),
    porCampanaMkt,
    porCampanaInconcert,
    porCliente,
    porCiudad,
    porAgente,
    porTipoLlamada,
    discovered,
    bullets: buildBullets(kpis, cmp7, porCampanaMkt[0]?.name ?? "", porCiudad[0]?.name ?? ""),
  };
}

function cleanRpcValue(v: unknown): string {
  if (v == null) return LEADS_FILTER_EMPTY_TOKEN;
  if (typeof v === "string") {
    let s = v.trim();
    // Manejo de arrays de Postgres: {"Valor",""} o {"","Valor"}
    if (s.startsWith("{") && s.endsWith("}")) {
      const parts = s
        .slice(1, -1)
        .split(",")
        .map((p) => p.trim().replace(/^"|"$/g, ""));
      const first = parts.find((p) => p !== "");
      return first ?? LEADS_FILTER_EMPTY_TOKEN;
    }
    return s === "" ? LEADS_FILTER_EMPTY_TOKEN : s;
  }
  if (Array.isArray(v)) return cleanRpcValue(v[0]);
  if (typeof v === "object") {
    const values = Object.values(v);
    if (values.length > 0) return cleanRpcValue(values[0]);
    return LEADS_FILTER_EMPTY_TOKEN;
  }
  const str = String(v);
  return str === "" ? LEADS_FILTER_EMPTY_TOKEN : str;
}

export async function fetchDashboardFilterOptions(): Promise<Partial<Record<keyof LeadRow, string[]>>> {
  const { data, error } = await supabase.rpc("accessible_leads_dimensions");
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  const map: Partial<Record<keyof LeadRow, string[]>> = {
    cliente: ((raw.clientes as any[]) ?? []).map(cleanRpcValue),
    campana_mkt: ((raw.campanas_mkt as any[]) ?? []).map(cleanRpcValue),
    campana_inconcert: ((raw.campanas_inconcert as any[]) ?? []).map(cleanRpcValue),
    categoria_mkt: ((raw.categorias_mkt as any[]) ?? []).map(cleanRpcValue),
    ciudad: ((raw.ciudades as any[]) ?? []).map(cleanRpcValue),
    tipo_llamada: ((raw.tipos_llamada as any[]) ?? []).map(cleanRpcValue),
    agente_prim_gestion: ((raw.agentes_prim_gestion as any[]) ?? []).map(cleanRpcValue),
    agente_ultim_gestion: ((raw.agentes_ultim_gestion as any[]) ?? []).map(cleanRpcValue),
    agente_negocio: ((raw.agentes_negocio as any[]) ?? []).map(cleanRpcValue),
    bpo: ((raw.bpos as any[]) ?? []).map(cleanRpcValue),
    result_prim_gestion: ((raw.resultados_prim_gestion as any[]) ?? []).map(cleanRpcValue),
    result_ultim_gestion: ((raw.resultados_ultim_gestion as any[]) ?? []).map(cleanRpcValue),
    result_negocio: ((raw.resultados_negocio as any[]) ?? []).map(cleanRpcValue),
    prim_resultado_marcadora: ((raw.prim_resultado_marcadora as any[]) ?? []).map(cleanRpcValue),
  };
  for (const key of Object.keys(map) as (keyof LeadRow)[]) {
    map[key] = [...new Set(map[key])].filter((v) => v != null);
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

/**
 * Obtiene la serie temporal diaria filtrada por una dimensión específica (o varias).
 * Útil para el Explorador Comparativo sin descargar todo el dataset.
 */
export async function fetchExplorerTimeseries(
  metric: "leads" | "ventas",
  desde: string | null,
  hasta: string | null,
  filters: JsonObject | null
): Promise<{ date: string; value: number }[]> {
  const { data, error } = await supabase.rpc("accessible_leads_timeseries", {
    _metric: metric,
    _granularity: "day",
    _limit: 120,
    _fecha_desde: desde,
    _fecha_hasta: hasta,
    _filters: filters,
  });

  if (error) throw error;
  return normalizeTimeseries(data).map((r) => ({ date: r.bucket, value: r.value }));
}
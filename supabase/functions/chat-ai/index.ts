import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Filters {
  agente?: string;
  campana_mkt?: string;
  campana_inconcert?: string;
  tipo_llamada?: string;
  ciudad?: string;
  categoria_mkt?: string;
  bpo?: string;
  result_negocio?: string;
  es_venta?: boolean;
  fecha_desde?: string;
  fecha_hasta?: string;
}

const FILTER_DESC = `Filtros JSON para la tabla leads (tenant ya aplicado). Campos: agente_negocio, agente_prim_gestion, agente_ultim_gestion, campana_mkt, campana_inconcert, tipo_llamada, ciudad, categoria_mkt, result_negocio, result_prim_gestion, result_ultim_gestion, prim_resultado_marcadora, bpo, cliente, es_venta (boolean true=solo ventas). Ejemplo: {"campana_mkt":"WOM_CL_ENTRANTES","tipo_llamada":"Entrante","es_venta":true}`;
const DATE_DESC = `Campo fecha para rango: fch_creacion(default), fch_negocio, fch_prim_gestion, fch_ultim_gestion, fch_prim_resultado_marcadora`;
const DIM_DESC = `Dimensiones: agente_negocio, agente_prim_gestion, agente_ultim_gestion, campana_mkt, campana_inconcert, tipo_llamada, ciudad, categoria_mkt, result_negocio, result_prim_gestion, result_ultim_gestion, prim_resultado_marcadora, bpo, hora, hora_negocio, fecha, fecha_negocio, dia_semana, tramo_horario, cliente`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_kpis",
      description:
        "Totales y tasas en un rango: total_leads, ventas (es_venta), conversión/efectividad %, tiempos agregados. Fechas relativas (ayer, última semana, este mes) → convierte a fecha_desde/fecha_hasta YYYY-MM-DD en America/Santiago.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "YYYY-MM-DD" },
          fecha_hasta: { type: "string", description: "YYYY-MM-DD" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agg_1d",
      description: `Agregación 1D: leads, ventas y conversión por dimensión (${DIM_DESC}). "Por ciudad/campaña/agente" = usa dimension, no filters, salvo que el usuario pida un valor concreto.`,
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "Dimensión GROUP BY" },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          limit: { type: "integer", description: "Max filas, default 50" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
        required: ["dimension"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agg_2d",
      description: `Cruce 2D. ${DIM_DESC}`,
      parameters: {
        type: "object",
        properties: {
          dim1: { type: "string" },
          dim2: { type: "string" },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          top_n: { type: "integer", description: "Default 10" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
        required: ["dim1", "dim2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "time_metrics",
      description: "Métricas de tiempo: respuesta, ciclo, percentiles.",
      parameters: {
        type: "object",
        properties: {
          group_by: { type: "string", description: "Dimensión agrupar. Omitir=global" },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "funnel",
      description: "Embudo de conversión (leads → contactados → negocio → ventas). Útil para 'efectividad', 'tasa de cierre', 'pipeline'.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ranking",
      description: `Rankings TOP/BOTTOM de cualquier dimensión. Sinónimos: "top", "mejores", "peores", "ranking", "los que más/menos", "líderes". Métricas: "leads"|"ventas"|"conv_pct"|"contactabilidad". order: "desc" para mejores, "asc" para peores. Dimensiones: ${DIM_DESC}`,
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "Dimensión a rankear" },
          metric: { type: "string", enum: ["leads", "ventas", "conv_pct", "contactabilidad"], description: "Métrica de orden" },
          order: { type: "string", enum: ["desc", "asc"], description: "desc=top, asc=bottom" },
          top_n: { type: "integer", description: "Cantidad (ej. 5, 10). Default 10" },
          min_leads: { type: "integer", description: "Excluir grupos con menos de N leads (default 1)" },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
        required: ["dimension", "metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_entities",
      description: `Compara 2+ valores específicos de una misma dimensión lado a lado (ej. "agente A vs agente B", "campaña X vs campaña Y", "Bogotá vs Medellín"). Devuelve métricas comparables.`,
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "Dimensión común (ej. agente_negocio, campana_mkt, ciudad, cliente)" },
          values: { type: "array", items: { type: "string" }, description: "Lista de valores exactos a comparar" },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
        required: ["dimension", "values"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_periods",
      description: `Compara dos rangos de fechas (ej. mes vs mes anterior, esta semana vs anterior). Útil para "compara abril vs marzo", "vs mes anterior".`,
      parameters: {
        type: "object",
        properties: {
          actual_desde: { type: "string", description: "YYYY-MM-DD inicio actual" },
          actual_hasta: { type: "string", description: "YYYY-MM-DD fin actual" },
          previo_desde: { type: "string", description: "YYYY-MM-DD inicio previo" },
          previo_hasta: { type: "string", description: "YYYY-MM-DD fin previo" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
        required: ["actual_desde", "actual_hasta", "previo_desde", "previo_hasta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contactability",
      description: `Métricas de contactabilidad/efectividad por dimensión: % de leads contactados (con fch_prim_gestion), % con gestión final (fch_ultim_gestion), % con negocio, % conversión a venta, intensidad (gestiones/lead). Sinónimos: "contactabilidad", "efectividad de contacto", "tasa de respuesta", "intensidad", "ocupación".`,
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: `Dimensión opcional para desglose (${DIM_DESC}). Omitir = global.` },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          date_field: { type: "string", description: DATE_DESC },
          filters: { type: "object", description: FILTER_DESC },
          limit: { type: "integer", description: "Default 30" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dimension_values",
      description: "Lista los valores únicos de una dimensión y cuenta de leads (útil para '¿cuántos agentes hay?', '¿qué campañas tengo?', '¿qué clientes están?'). NO requiere fecha.",
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: DIM_DESC },
          filters: { type: "object", description: FILTER_DESC },
        },
        required: ["dimension"],
      },
    },
  },
];

interface TemporalOverrides {
  fecha_desde?: string;
  fecha_hasta?: string;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractAvailableCreationDates(leads: any[]): string[] {
  const s = new Set<string>();
  for (const lead of leads) {
    const raw = typeof lead?.fch_creacion === "string" ? lead.fch_creacion.slice(0, 10) : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) s.add(raw);
  }
  return Array.from(s).sort();
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clampIsoDate(iso: string, minDate?: string | null, maxDate?: string | null): string {
  let out = iso;
  if (minDate && out < minDate) out = minDate;
  if (maxDate && out > maxDate) out = maxDate;
  return out;
}

function lastDayOfMonthIso(year: number, month1Based: number): string {
  return new Date(Date.UTC(year, month1Based, 0)).toISOString().slice(0, 10);
}

function getDateField(lead: any, field: string | null): Date | null {
  const f = field && ["fch_creacion","fch_negocio","fch_prim_gestion","fch_ultim_gestion","fch_prim_resultado_marcadora"].includes(field) ? field : "fch_creacion";
  const v = lead[f];
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function applyFiltersToLeads(leads: any[], args: any, af: Filters, forcedFilters: Record<string, string>): any[] {
  let filtered = leads;
  const fd = args.fecha_desde || af.fecha_desde || null;
  const fh = args.fecha_hasta || af.fecha_hasta || null;
  const df = args.date_field || null;

  // Date range
  if (fd) {
    const desde = new Date(fd + "T00:00:00");
    filtered = filtered.filter(l => { const d = getDateField(l, df); return d && d >= desde; });
  }
  if (fh) {
    const hasta = new Date(fh + "T23:59:59");
    filtered = filtered.filter(l => { const d = getDateField(l, df); return d && d <= hasta; });
  }

  // Merge all filter sources
  const allFilters: Record<string, unknown> = { ...forcedFilters };
  if (af.campana_mkt) allFilters.campana_mkt = af.campana_mkt;
  if (af.agente) allFilters.agente_negocio = af.agente;
  if (af.tipo_llamada) allFilters.tipo_llamada = af.tipo_llamada;
  if (af.ciudad) allFilters.ciudad = af.ciudad;
  if (af.categoria_mkt) allFilters.categoria_mkt = af.categoria_mkt;
  if (af.campana_inconcert) allFilters.campana_inconcert = af.campana_inconcert;
  if (af.bpo) allFilters.bpo = af.bpo;
  if (af.result_negocio) allFilters.result_negocio = af.result_negocio;
  if (af.es_venta === true) allFilters.es_venta = true;
  if (args.filters && typeof args.filters === "object") {
    for (const [k, v] of Object.entries(args.filters)) {
      if (v !== undefined && v !== null && v !== "") allFilters[k] = v;
    }
  }

  // Apply each filter
  for (const [k, v] of Object.entries(allFilters)) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "es_venta") {
      filtered = filtered.filter(l => l.es_venta === true);
    } else {
      filtered = filtered.filter(l => l[k] != null && String(l[k]) === String(v));
    }
  }

  return filtered;
}

// In-memory analytics functions
function getTramoHorario(hour: number): string {
  if (hour >= 8 && hour < 12) return "Mañana(08-12)";
  if (hour >= 12 && hour < 15) return "Mediodía(12-15)";
  if (hour >= 15 && hour < 19) return "Tarde(15-19)";
  if (hour >= 19 && hour < 23) return "Noche(19-23)";
  return "Madrugada(00-08)";
}

const DAYS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

function getDimensionValue(lead: any, dimension: string, dateField: string | null): string | null {
  const df = dateField || "fch_creacion";
  switch (dimension) {
    case "hora": {
      const d = lead[df]; if (!d) return null;
      return String(new Date(d).getHours());
    }
    case "hora_negocio": {
      const d = lead.fch_negocio; if (!d) return null;
      return String(new Date(d).getHours());
    }
    case "fecha": {
      const d = lead[df]; if (!d) return null;
      return new Date(d).toISOString().slice(0,10);
    }
    case "fecha_negocio": {
      const d = lead.fch_negocio; if (!d) return null;
      return new Date(d).toISOString().slice(0,10);
    }
    case "dia_semana": {
      const d = lead[df]; if (!d) return null;
      return DAYS_ES[new Date(d).getDay()];
    }
    case "tramo_horario": {
      const d = lead[df]; if (!d) return null;
      return getTramoHorario(new Date(d).getHours());
    }
    case "bpo":
      return lead.bpo || "Sin BPO";
    case "cliente":
      return lead.cliente || "Sin cliente";
    default: {
      const v = lead[dimension];
      return v != null && v !== "" ? String(v) : null;
    }
  }
}

function agg1d(leads: any[], dimension: string, dateField: string | null, limit: number): any[] {
  const groups = new Map<string, {leads: number; ventas: number}>();
  for (const l of leads) {
    const key = getDimensionValue(l, dimension, dateField);
    if (key === null) continue;
    const g = groups.get(key) || {leads:0, ventas:0};
    g.leads++;
    if (l.es_venta) g.ventas++;
    groups.set(key, g);
  }
  const arr = Array.from(groups.entries()).map(([dim, g]) => ({
    dimension: dim,
    leads: g.leads,
    ventas: g.ventas,
    conv_pct: g.leads ? Math.round(g.ventas/g.leads*1000)/10 : 0,
  }));
  // Sort
  if (["hora","hora_negocio","fecha","fecha_negocio"].includes(dimension)) {
    arr.sort((a,b) => (a.dimension < b.dimension ? -1 : 1));
  } else if (dimension === "dia_semana") {
    arr.sort((a,b) => DAYS_ES.indexOf(a.dimension) - DAYS_ES.indexOf(b.dimension));
  } else {
    arr.sort((a,b) => b.leads - a.leads);
  }
  return arr.slice(0, limit);
}

function agg2d(leads: any[], dim1: string, dim2: string, dateField: string | null, topN: number): any[] {
  const groups = new Map<string, {leads: number; ventas: number}>();
  for (const l of leads) {
    const k1 = getDimensionValue(l, dim1, dateField);
    const k2 = getDimensionValue(l, dim2, dateField);
    if (k1 === null || k2 === null) continue;
    const key = `${k1}|||${k2}`;
    const g = groups.get(key) || {leads:0, ventas:0};
    g.leads++;
    if (l.es_venta) g.ventas++;
    groups.set(key, g);
  }
  const arr = Array.from(groups.entries()).map(([key, g]) => {
    const [d1, d2] = key.split("|||");
    return { dim1: d1, dim2: d2, leads: g.leads, ventas: g.ventas, conv_pct: g.leads ? Math.round(g.ventas/g.leads*1000)/10 : 0 };
  });
  arr.sort((a,b) => b.leads - a.leads);
  return arr.slice(0, topN * topN);
}

function timeMetrics(leads: any[], groupBy: string | null, dateField: string | null): any {
  const compute = (subset: any[]) => {
    const n = subset.length;
    const respTimes: number[] = [];
    const cicloTimes: number[] = [];
    const cicloVentaTimes: number[] = [];
    for (const l of subset) {
      if (l.fch_prim_gestion && l.fch_creacion) {
        const d = (new Date(l.fch_prim_gestion).getTime() - new Date(l.fch_creacion).getTime()) / 60000;
        if (d >= 0 && d <= 43200) respTimes.push(d);
      }
      if (l.fch_negocio && l.fch_creacion) {
        const d = (new Date(l.fch_negocio).getTime() - new Date(l.fch_creacion).getTime()) / 60000;
        if (d >= 0 && d <= 43200) { cicloTimes.push(d); if (l.es_venta) cicloVentaTimes.push(d); }
      }
    }
    const avg = (a: number[]) => a.length ? Math.round(a.reduce((s,v)=>s+v,0)/a.length*10)/10 : null;
    const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x,y)=>x-y); const m = Math.floor(s.length/2); return Math.round((s.length%2 ? s[m] : (s[m-1]+s[m])/2)*10)/10; };
    const conGestion = subset.filter(l => l.fch_prim_gestion).length;
    return { n, con_gestion: conGestion, tasa_contacto_pct: n ? Math.round(conGestion/n*1000)/10 : 0, avg_resp_min: avg(respTimes), med_resp_min: med(respTimes), avg_ciclo_min: avg(cicloTimes), avg_ciclo_ventas_min: avg(cicloVentaTimes) };
  };

  if (!groupBy) return compute(leads);

  const groups = new Map<string, any[]>();
  for (const l of leads) {
    const key = getDimensionValue(l, groupBy, dateField);
    if (key === null) continue;
    const arr = groups.get(key) || [];
    arr.push(l);
    groups.set(key, arr);
  }
  const result = Array.from(groups.entries()).map(([dim, subset]) => {
    const m = compute(subset);
    return { dimension: dim, ...m };
  });
  result.sort((a: any,b: any) => (b.n || b.leads || 0) - (a.n || a.leads || 0));
  return result.slice(0, 30);
}

function funnelCalc(leads: any[]): any {
  const total = leads.length;
  const conPrimGestion = leads.filter(l => l.fch_prim_gestion).length;
  const conUltimGestion = leads.filter(l => l.fch_ultim_gestion).length;
  const conNegocio = leads.filter(l => l.fch_negocio).length;
  const ventas = leads.filter(l => l.es_venta).length;
  return {
    total, con_prim_gestion: conPrimGestion, con_ultim_gestion: conUltimGestion, con_negocio: conNegocio, ventas,
    tasa_contacto: total ? Math.round(conPrimGestion/total*1000)/10 : 0,
    tasa_negocio: total ? Math.round(conNegocio/total*1000)/10 : 0,
    tasa_conversion: total ? Math.round(ventas/total*1000)/10 : 0,
  };
}

function rankingCalc(leads: any[], dimension: string, dateField: string | null, metric: string, order: string, topN: number, minLeads: number): any[] {
  const groups = new Map<string, { leads: number; ventas: number; contactados: number }>();
  for (const l of leads) {
    const key = getDimensionValue(l, dimension, dateField);
    if (key === null) continue;
    const g = groups.get(key) || { leads: 0, ventas: 0, contactados: 0 };
    g.leads++;
    if (l.es_venta) g.ventas++;
    if (l.fch_prim_gestion) g.contactados++;
    groups.set(key, g);
  }
  const arr = Array.from(groups.entries())
    .filter(([_, g]) => g.leads >= Math.max(1, minLeads))
    .map(([dim, g]) => ({
      dimension: dim,
      leads: g.leads,
      ventas: g.ventas,
      conv_pct: g.leads ? Math.round((g.ventas / g.leads) * 1000) / 10 : 0,
      contactabilidad_pct: g.leads ? Math.round((g.contactados / g.leads) * 1000) / 10 : 0,
    }));
  const metricKey = metric === "contactabilidad" ? "contactabilidad_pct" : metric === "conv_pct" ? "conv_pct" : metric;
  arr.sort((a: any, b: any) => order === "asc" ? (a[metricKey] - b[metricKey]) : (b[metricKey] - a[metricKey]));
  return arr.slice(0, Math.max(1, topN));
}

function compareEntitiesCalc(leads: any[], dimension: string, values: string[], dateField: string | null): any[] {
  return values.map(v => {
    const subset = leads.filter(l => {
      const dv = getDimensionValue(l, dimension, dateField);
      return dv != null && String(dv).toLowerCase() === String(v).toLowerCase();
    });
    const n = subset.length;
    const ventas = subset.filter(l => l.es_venta).length;
    const contactados = subset.filter(l => l.fch_prim_gestion).length;
    const conNegocio = subset.filter(l => l.fch_negocio).length;
    return {
      valor: v,
      leads: n,
      ventas,
      con_gestion: contactados,
      con_negocio: conNegocio,
      contactabilidad_pct: n ? Math.round(contactados / n * 1000) / 10 : 0,
      conv_pct: n ? Math.round(ventas / n * 1000) / 10 : 0,
      tasa_negocio_pct: n ? Math.round(conNegocio / n * 1000) / 10 : 0,
    };
  });
}

function comparePeriodsCalc(allLeads: any[], dateField: string | null, ranges: { actual_desde: string; actual_hasta: string; previo_desde: string; previo_hasta: string }, baseFilters: Record<string, unknown>): any {
  const filt = (desde: string, hasta: string) => {
    const d1 = new Date(desde + "T00:00:00");
    const d2 = new Date(hasta + "T23:59:59");
    return allLeads.filter(l => {
      const dt = getDateField(l, dateField);
      if (!dt || dt < d1 || dt > d2) return false;
      for (const [k, v] of Object.entries(baseFilters)) {
        if (v == null || v === "") continue;
        if (k === "es_venta") { if (!l.es_venta) return false; continue; }
        if (l[k] == null || String(l[k]) !== String(v)) return false;
      }
      return true;
    });
  };
  const summary = (s: any[]) => {
    const v = s.filter(l => l.es_venta).length;
    return {
      leads: s.length, ventas: v, con_gestion: s.filter(l => l.fch_prim_gestion).length,
      conv_pct: s.length ? Math.round(v / s.length * 1000) / 10 : 0,
    };
  };
  const A = summary(filt(ranges.actual_desde, ranges.actual_hasta));
  const P = summary(filt(ranges.previo_desde, ranges.previo_hasta));
  const delta = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : Math.round((cur - prev) / prev * 1000) / 10;
  return {
    rango_actual: { desde: ranges.actual_desde, hasta: ranges.actual_hasta, ...A },
    rango_previo: { desde: ranges.previo_desde, hasta: ranges.previo_hasta, ...P },
    variacion_pct: { leads: delta(A.leads, P.leads), ventas: delta(A.ventas, P.ventas), conv_pct: delta(A.conv_pct, P.conv_pct) },
  };
}

function contactabilityCalc(leads: any[], dimension: string | null, dateField: string | null, limit: number): any {
  const compute = (s: any[]) => {
    const n = s.length;
    const c = s.filter(l => l.fch_prim_gestion).length;
    const u = s.filter(l => l.fch_ultim_gestion).length;
    const ng = s.filter(l => l.fch_negocio).length;
    const v = s.filter(l => l.es_venta).length;
    const marc = s.filter(l => ["CONNECTED", "FINISHED"].includes(l.prim_resultado_marcadora)).length;
    return {
      leads: n, contactados: c, con_ultim_gestion: u, con_negocio: ng, ventas: v,
      contactabilidad_pct: n ? Math.round(c / n * 1000) / 10 : 0,
      contactabilidad_marcadora_pct: n ? Math.round(marc / n * 1000) / 10 : 0,
      tasa_cierre_pct: n ? Math.round(ng / n * 1000) / 10 : 0,
      conv_pct: n ? Math.round(v / n * 1000) / 10 : 0,
    };
  };
  if (!dimension) return compute(leads);
  const groups = new Map<string, any[]>();
  for (const l of leads) {
    const k = getDimensionValue(l, dimension, dateField);
    if (k === null) continue;
    const arr = groups.get(k) || [];
    arr.push(l);
    groups.set(k, arr);
  }
  const out = Array.from(groups.entries()).map(([dim, s]) => ({ dimension: dim, ...compute(s) }));
  out.sort((a: any, b: any) => b.leads - a.leads);
  return out.slice(0, Math.max(1, limit));
}

function listDimensionValuesCalc(leads: any[], dimension: string): any[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const k = getDimensionValue(l, dimension, null);
    if (k === null) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([valor, leads]) => ({ valor, leads }))
    .sort((a, b) => b.leads - a.leads);
}

function buildToolFilters(args: any, af: Filters, forcedFilters: Record<string, string>): Record<string, unknown> {
  const allFilters: Record<string, unknown> = { ...forcedFilters };
  if (af.campana_mkt) allFilters.campana_mkt = af.campana_mkt;
  if (af.agente) allFilters.agente_negocio = af.agente;
  if (af.tipo_llamada) allFilters.tipo_llamada = af.tipo_llamada;
  if (af.ciudad) allFilters.ciudad = af.ciudad;
  if (af.categoria_mkt) allFilters.categoria_mkt = af.categoria_mkt;
  if (af.campana_inconcert) allFilters.campana_inconcert = af.campana_inconcert;
  if (af.bpo) allFilters.bpo = af.bpo;
  if (af.result_negocio) allFilters.result_negocio = af.result_negocio;
  if (af.es_venta === true) allFilters.es_venta = true;
  if (args?.filters && typeof args.filters === "object") {
    for (const [k, v] of Object.entries(args.filters)) {
      if (v !== undefined && v !== null && v !== "") allFilters[k] = v;
    }
  }
  return allFilters;
}

async function executeToolViaRpc(
  admin: any,
  name: string,
  args: any,
  af: Filters,
  forcedFilters: Record<string, string>,
  temporalOverrides?: TemporalOverrides | null,
): Promise<string> {
  const effectiveArgs = { ...(args || {}) };
  if (temporalOverrides?.fecha_desde && !effectiveArgs.fecha_desde) effectiveArgs.fecha_desde = temporalOverrides.fecha_desde;
  if (temporalOverrides?.fecha_hasta && !effectiveArgs.fecha_hasta) effectiveArgs.fecha_hasta = temporalOverrides.fecha_hasta;

  const filters = buildToolFilters(effectiveArgs, af, forcedFilters);
  const common = {
    _fecha_desde: effectiveArgs.fecha_desde ?? null,
    _fecha_hasta: effectiveArgs.fecha_hasta ?? null,
    _date_field: effectiveArgs.date_field || null,
    _filters: Object.keys(filters).length ? filters : null,
  };

  try {
    let data: any = null;
    let error: any = null;
    switch (name) {
      case "get_kpis": ({ data, error } = await admin.rpc("accessible_leads_kpis", common)); break;
      case "agg_1d": ({ data, error } = await admin.rpc("accessible_leads_group_metrics", { ...common, _dimension: effectiveArgs.dimension, _limit: effectiveArgs.limit || 50 })); break;
      case "ranking": ({ data, error } = await admin.rpc("accessible_leads_group_metrics", { ...common, _dimension: effectiveArgs.dimension, _limit: Math.max(effectiveArgs.top_n || 10, 50) })); break;
      case "contactability": ({ data, error } = await admin.rpc("accessible_leads_group_metrics", { ...common, _dimension: effectiveArgs.dimension || "campana_mkt", _limit: effectiveArgs.limit || 30 })); break;
      case "list_dimension_values": ({ data, error } = await admin.rpc("accessible_leads_group_metrics", { ...common, _dimension: effectiveArgs.dimension, _limit: 500 })); break;
      case "agg_2d": ({ data, error } = await admin.rpc("accessible_leads_agg_2d", { ...common, _dim1: effectiveArgs.dim1, _dim2: effectiveArgs.dim2, _top_n: effectiveArgs.top_n || 10 })); break;
      default:
        return `ERROR_SISTEMA: herramienta ${name} aún no fue optimizada para alto volumen. NO inventes datos.`;
    }

    if (error) {
      console.error(`RPC ${name}:`, error);
      return `ERROR_SISTEMA: ${name} falló: ${error.message}. NO inventes datos.`;
    }

    if (name === "ranking" && Array.isArray(data)) {
      const metricKey = effectiveArgs.metric === "contactabilidad" ? "contactabilidad_pct" : effectiveArgs.metric || "leads";
      const minLeads = Math.max(1, effectiveArgs.min_leads || 1);
      data = data
        .filter((row: any) => Number(row?.leads || 0) >= minLeads)
        .sort((a: any, b: any) => (effectiveArgs.order === "asc" ? Number(a?.[metricKey] || 0) - Number(b?.[metricKey] || 0) : Number(b?.[metricKey] || 0) - Number(a?.[metricKey] || 0)))
        .slice(0, Math.max(1, effectiveArgs.top_n || 10));
    }

    if (name === "contactability" && !effectiveArgs.dimension && data && !Array.isArray(data)) {
      data = data;
    }

    if (name === "list_dimension_values" && Array.isArray(data)) {
      data = data.map((row: any) => ({ valor: row.dimension, leads: row.leads }));
    }

    if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
      return `RESULTADO_BD: ${name} retornó 0 filas. No hay datos para estos filtros. NO inventes datos.`;
    }

    const rowCount = Array.isArray(data) ? data.length : 1;
    const totalLeads = Array.isArray(data)
      ? data.reduce((s: number, r: any) => s + Number(r?.leads || 0), 0)
      : Number(data.total_leads || data.total || data.n || 0);
    return `RESULTADO_BD_REAL(${name}, filas=${rowCount}, total_leads=${totalLeads}):\n${JSON.stringify(data)}\nFIN_RESULTADO. Usa EXACTAMENTE estos números.`;
  } catch (e) {
    console.error(`CRASH ${name}:`, e);
    return `ERROR_SISTEMA: ${name} crasheó: ${(e as Error).message}. NO inventes datos.`;
  }
}

/** Execute tool against in-memory leads */
function executeToolInMemory(
  allLeads: any[],
  name: string,
  args: any,
  af: Filters,
  forcedFilters: Record<string, string>,
  temporalOverrides?: TemporalOverrides | null,
): string {
  const effectiveArgs = { ...(args || {}) };
  if (temporalOverrides?.fecha_desde && !effectiveArgs.fecha_desde) effectiveArgs.fecha_desde = temporalOverrides.fecha_desde;
  if (temporalOverrides?.fecha_hasta && !effectiveArgs.fecha_hasta) effectiveArgs.fecha_hasta = temporalOverrides.fecha_hasta;

  // list_dimension_values y compare_periods no aplican filtros de fecha estándar
  const skipDateFilter = name === "list_dimension_values" || name === "compare_periods";
  const filtered = skipDateFilter
    ? applyFiltersToLeads(allLeads, { filters: effectiveArgs.filters }, af, forcedFilters)
    : applyFiltersToLeads(allLeads, effectiveArgs, af, forcedFilters);
  const df = effectiveArgs.date_field || null;

  console.log(`[EXEC-MEM] ${name} total=${allLeads.length} filtered=${filtered.length} filters=${JSON.stringify({ ...forcedFilters, ...effectiveArgs.filters })} overrides=${JSON.stringify(temporalOverrides || {})}`);

  try {
    if (filtered.length === 0 && name !== "compare_periods") {
      return `RESULTADO_BD: ${name} retornó 0 filas. No hay datos para estos filtros. NO inventes datos.`;
    }

    let data: any;
    switch (name) {
      case "get_kpis": data = computeKpis(filtered); break;
      case "agg_1d": data = agg1d(filtered, effectiveArgs.dimension, df, effectiveArgs.limit || 50); break;
      case "agg_2d": data = agg2d(filtered, effectiveArgs.dim1, effectiveArgs.dim2, df, effectiveArgs.top_n || 10); break;
      case "time_metrics": data = timeMetrics(filtered, effectiveArgs.group_by || null, df); break;
      case "funnel": data = funnelCalc(filtered); break;
      case "ranking":
        data = rankingCalc(filtered, effectiveArgs.dimension, df, effectiveArgs.metric || "leads", effectiveArgs.order || "desc", effectiveArgs.top_n || 10, effectiveArgs.min_leads || 1);
        break;
      case "compare_entities":
        data = compareEntitiesCalc(filtered, effectiveArgs.dimension, Array.isArray(effectiveArgs.values) ? effectiveArgs.values : [], df);
        break;
      case "compare_periods": {
        const baseFilters: Record<string, unknown> = { ...forcedFilters };
        if (effectiveArgs.filters && typeof effectiveArgs.filters === "object") Object.assign(baseFilters, effectiveArgs.filters);
        data = comparePeriodsCalc(allLeads, df, {
          actual_desde: effectiveArgs.actual_desde,
          actual_hasta: effectiveArgs.actual_hasta,
          previo_desde: effectiveArgs.previo_desde,
          previo_hasta: effectiveArgs.previo_hasta,
        }, baseFilters);
        break;
      }
      case "contactability":
        data = contactabilityCalc(filtered, effectiveArgs.dimension || null, df, effectiveArgs.limit || 30);
        break;
      case "list_dimension_values":
        data = listDimensionValuesCalc(filtered, effectiveArgs.dimension);
        break;
      default: return `ERROR: herramienta "${name}" no existe`;
    }

    if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
      return `RESULTADO_BD: ${name} retornó 0 filas. No hay datos para estos filtros. NO inventes datos.`;
    }

    const json = JSON.stringify(data, null, 0);
    const rowCount = Array.isArray(data) ? data.length : 1;
    const totalLeads = Array.isArray(data)
      ? data.reduce((s: number, r: any) => s + (r.leads || 0), 0)
      : data.total_leads || data.total || data.n || 0;

    return `RESULTADO_BD_REAL(${name}, filas=${rowCount}, total_leads=${totalLeads}):\n${json}\nFIN_RESULTADO. Usa EXACTAMENTE estos números.`;
  } catch (e) {
    console.error(`CRASH ${name}:`, e);
    return `ERROR_SISTEMA: ${name} crasheó: ${(e as Error).message}. NO inventes datos.`;
  }
}

// Build dimensions summary from in-memory leads
function buildDimensionsFromLeads(leads: any[]): any {
  const unique = (key: string) => {
    const vals = new Set<string>();
    for (const l of leads) { const v = l[key]; if (v != null && v !== "") vals.add(String(v)); }
    return Array.from(vals).sort();
  };
  const dates = leads.map(l => l.fch_creacion).filter(Boolean).map((d: string) => d.slice(0,10)).sort();
  return {
    agentes_negocio: unique("agente_negocio"),
    agentes_prim_gestion: unique("agente_prim_gestion"),
    agentes_ultim_gestion: unique("agente_ultim_gestion"),
    campanas_mkt: unique("campana_mkt"),
    campanas_inconcert: unique("campana_inconcert"),
    tipos_llamada: unique("tipo_llamada"),
    ciudades: unique("ciudad"),
    resultados_negocio: unique("result_negocio"),
    resultados_prim_gestion: unique("result_prim_gestion"),
    resultados_ultim_gestion: unique("result_ultim_gestion"),
    categorias_mkt: unique("categoria_mkt"),
    prim_resultado_marcadora: unique("prim_resultado_marcadora"),
    clientes: unique("cliente"),
    rango_fechas: { desde: dates[0] || null, hasta: dates[dates.length-1] || null },
    campos_fecha: ["fch_creacion","fch_negocio","fch_prim_gestion","fch_ultim_gestion","fch_prim_resultado_marcadora"],
  };
}

const MONTHS_ES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function resolveDateHintsFromMessage(userMsg: string, dates: string[]): string[] {
  if (!dates.length) return [];

  const out: string[] = [];
  const matches = userMsg.toLowerCase().matchAll(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/g);

  for (const match of matches) {
    const day = Number(match[1]);
    const month = MONTHS_ES[match[2]];
    const explicitYear = match[3];
    let iso: string | null = null;

    if (explicitYear) {
      iso = `${explicitYear}-${month}-${pad2(day)}`;
    } else {
      const suffix = `${month}-${pad2(day)}`;
      const candidates = dates.filter((d) => d.slice(5) === suffix).sort();
      if (candidates.length > 0) {
        iso = candidates[candidates.length - 1];
      } else {
        const latest = dates.sort()[dates.length - 1];
        if (latest) iso = `${latest.slice(0, 4)}-${suffix}`;
      }
    }

    if (iso) out.push(`"${match[0]}" = ${iso}`);
  }

  return out;
}

function inferTemporalOverridesFromMessage(
  userMsg: string,
  dates: string[],
  todayStr: string,
  dataMin?: string | null,
  dataMax?: string | null,
): TemporalOverrides | null {
  if (!userMsg || !dates.length) return null;

  const msg = normalizeText(scrubTimezoneFalsePositives(userMsg));
  const earliest = dataMin || dates[0] || null;
  const latest = dataMax || dates[dates.length - 1] || null;
  const out: TemporalOverrides = {};

  if (/\bhasta ayer\b/.test(msg)) {
    out.fecha_hasta = clampIsoDate(shiftIsoDate(todayStr, -1), earliest, latest);
  } else if (/\b(?:hasta ahora|hasta el momento|al momento|hasta hoy)\b/.test(msg)) {
    out.fecha_hasta = clampIsoDate(todayStr, earliest, latest);
  } else if (/\bayer\b/.test(msg)) {
    const y = clampIsoDate(shiftIsoDate(todayStr, -1), earliest, latest);
    out.fecha_desde = y;
    out.fecha_hasta = y;
  } else if (/\bhoy\b/.test(msg)) {
    const h = clampIsoDate(todayStr, earliest, latest);
    out.fecha_desde = h;
    out.fecha_hasta = h;
  }

  const monthMatches = Array.from(msg.matchAll(/\b(?:mes\s+de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/g));
  if (monthMatches.length > 0) {
    const match = monthMatches[monthMatches.length - 1];
    const month = Number(MONTHS_ES[match[1]]);
    const monthStr = pad2(month);
    const explicitYear = match[2];
    const candidate = explicitYear
      ? `${explicitYear}-${monthStr}-01`
      : dates.filter((d) => d.slice(5, 7) === monthStr).sort().pop() || latest;

    if (candidate) {
      const year = Number(candidate.slice(0, 4));
      out.fecha_desde = clampIsoDate(`${year}-${monthStr}-01`, earliest, latest);
      const monthEnd = clampIsoDate(lastDayOfMonthIso(year, month), earliest, latest);
      if (!out.fecha_hasta || out.fecha_hasta > monthEnd) out.fecha_hasta = monthEnd;
      if (out.fecha_hasta && out.fecha_hasta < out.fecha_desde) out.fecha_hasta = out.fecha_desde;
    }
  }

  return out.fecha_desde || out.fecha_hasta ? out : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER EXTRACTION from user message
// ═══════════════════════════════════════════════════════════════════════════

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractKeywordScopedValue(userMsg: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = userMsg.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const cleaned = raw.replace(/^["'“”]+|["'“”]+$/g, "").trim();
    if (cleaned.length >= 2) return cleaned;
  }
  return null;
}

function campaignKeywordPattern(flags = "i"): RegExp {
  return new RegExp(String.raw`\bcam(?:p|ap)a(?:ñ|n)a\s+([a-z0-9áéíóúñü._\-\s]+?)(?=\s+(?:del?|desde|hasta|por|en|para|y|con|solo|unicamente|únicamente)\b|[?.!,;]|$)`, flags);
}

function collectLooseEntityCandidates(userMsg: string): string[] {
  const scrubbed = scrubTimezoneFalsePositives(userMsg);
  const normalized = scrubbed
    .replace(/["'“”‘’]/g, " ")
    .replace(/[?.!,;:(){}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const candidates = new Set<string>();
  const patterns = [
    /\b(?:solo|solamente|unicamente|únicamente)\s+de\s+([a-z0-9áéíóúñü._\-\s]+?)(?=\s+(?:del?|desde|hasta|por|en|para|y|con)\b|$)/gi,
    /\bde\s+([a-z0-9áéíóúñü._\-]{3,})\b/gi,
    /\bpara\s+([a-z0-9áéíóúñü._\-]{3,})\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      const cleaned = raw
        .replace(/^(?:la|el|los|las)\s+/i, "")
        .replace(/\s+(?:mes|dia|días|dias)$/i, "")
        .trim();
      if (!cleaned) continue;
      const token = normalizeText(cleaned);
      if (!token || token.length < 3) continue;
      if (MONTHS_ES[token]) continue;
      if (["abril", "marzo", "enero", "febrero", "mayo", "junio", "julio", "agosto", "septiembre", "setiembre", "octubre", "noviembre", "diciembre", "ayer", "hoy", "manana", "mañana", "mes", "dia", "dias", "día", "días", "momento", "ahora", "total", "totales", "lead", "leads", "venta", "ventas", "efectividad", "conversion", "conversión"].includes(token)) continue;
      candidates.add(cleaned);
    }
  }

  return Array.from(candidates);
}

function resolveEntityFromLooseCandidates(userMsg: string, dims: any): Record<string, string> {
  if (!dims) return {};

  const candidates = collectLooseEntityCandidates(userMsg);
  if (!candidates.length) return {};

  for (const candidate of candidates) {
    const clientMatch = Array.isArray(dims.clientes) ? findBestDimensionMatch(candidate, dims.clientes as string[]) : null;
    if (clientMatch) return { cliente: clientMatch };

    const mktMatch = Array.isArray(dims.campanas_mkt) ? findBestDimensionMatch(candidate, dims.campanas_mkt as string[]) : null;
    if (mktMatch) return { campana_mkt: mktMatch };

    const inconcertMatch = Array.isArray(dims.campanas_inconcert) ? findBestDimensionMatch(candidate, dims.campanas_inconcert as string[]) : null;
    if (inconcertMatch) return { campana_inconcert: inconcertMatch };
  }

  return {};
}

function detectUnavailableLooseEntityRequest(userMsg: string, dims: any): string | null {
  if (!dims) return null;
  const candidates = collectLooseEntityCandidates(userMsg);
  if (!candidates.length) return null;

  const campaignValues = [
    ...(Array.isArray(dims.campanas_mkt) ? (dims.campanas_mkt as string[]) : []),
    ...(Array.isArray(dims.campanas_inconcert) ? (dims.campanas_inconcert as string[]) : []),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(dims.clientes) && findBestDimensionMatch(candidate, dims.clientes as string[])) continue;
    if (findBestDimensionMatch(candidate, campaignValues)) continue;
    return `No hay datos para \"${candidate}\" en campañas o clientes accesibles.`;
  }

  return null;
}

function findBestDimensionMatch(term: string, values: string[]): string | null {
  const needle = normalizeText(term);
  if (!needle) return null;
  for (const value of values) {
    if (normalizeText(value) === needle) return value;
  }
  for (const value of values) {
    const candidate = normalizeText(value);
    if (candidate.includes(needle) || needle.includes(candidate)) return value;
  }
  return null;
}

function scrubTimezoneFalsePositives(text: string): string {
  return text
    .replace(/\bAmerica\/Santiago\b/gi, " ")
    .replace(/\bPacific\/Easter\b/gi, " ")
    .replace(/\bAmerica\/[A-Za-z_]+\/[A-Za-z_]+\b/g, " ");
}

function messageMentionsCityName(scrubbedUserMsg: string, city: string): boolean {
  const c = city.trim();
  if (!c || c.length < 2) return false;
  const ml = scrubbedUserMsg.toLowerCase();
  const cl = c.toLowerCase();
  if (/\s/.test(c)) return ml.includes(cl);
  const re = new RegExp(`(^|[^a-z0-9áéíóúñü])${escapeRegExp(cl)}([^a-z0-9áéíóúñü]|$)`, "i");
  return re.test(ml);
}

const GENERIC_AGENT_TOKENS = new Set([
  "agente", "agentes", "ciudad", "ciudades", "campana", "campaña", "campañas", "campanas",
  "preferencias", "confirmadas", "dashboard", "tablero", "tableros", "periodo", "metrica",
  "métrica", "paneles", "panel", "desde", "hasta", "marzo", "enero", "febrero", "abril",
  "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  "total", "leads", "ventas", "analisis", "análisis", "rendimiento", "comparacion", "comparación",
  "elegido", "recomendado", "incluir", "adicional", "principal", "principales", "deseas",
  "gustaria", "gustaría", "solo", "totales", "comparar",
]);

function extractFiltersFromMessage(userMsg: string, dims: any): Record<string, string> {
  if (!userMsg || !dims) return {};
  const scrubbed = scrubTimezoneFalsePositives(userMsg);
  const msg = scrubbed.toLowerCase();
  const found: Record<string, string> = {};

  // Ciudades
  if (dims.ciudades && Array.isArray(dims.ciudades)) {
    for (const c of dims.ciudades) {
      if (c && c.length > 2 && messageMentionsCityName(scrubbed, c)) { found.ciudad = c; break; }
    }
  }
  // Campañas mkt
  if (dims.campanas_mkt && Array.isArray(dims.campanas_mkt)) {
    for (const c of dims.campanas_mkt) { if (c && msg.includes(c.toLowerCase())) { found.campana_mkt = c; break; } }
  }
  if (dims.campanas_inconcert && Array.isArray(dims.campanas_inconcert)) {
    for (const c of dims.campanas_inconcert) { if (c && msg.includes(c.toLowerCase())) { found.campana_inconcert = c; break; } }
  }
  if (dims.tipos_llamada && Array.isArray(dims.tipos_llamada)) {
    for (const t of dims.tipos_llamada) { if (t && msg.includes(t.toLowerCase())) { found.tipo_llamada = t; break; } }
  }
  if (dims.categorias_mkt && Array.isArray(dims.categorias_mkt)) {
    for (const c of dims.categorias_mkt) { if (c && c.length > 3 && msg.includes(c.toLowerCase())) { found.categoria_mkt = c; break; } }
  }
  // Clientes
  if (dims.clientes && Array.isArray(dims.clientes)) {
    for (const c of dims.clientes) { if (c && c.length > 2 && msg.includes(c.toLowerCase())) { found.cliente = c; break; } }
  }
  if (!found.cliente && Array.isArray(dims.clientes)) {
    const clientTerm = extractKeywordScopedValue(scrubbed, [
      /\b(?:cliente|cuenta)\s+([a-z0-9áéíóúñü._\-\s]+?)(?=\s+(?:del?|desde|hasta|por|en|para|y|con)\b|[?.!,;]|$)/i,
    ]);
    if (clientTerm) {
      const match = findBestDimensionMatch(clientTerm, dims.clientes as string[]);
      if (match) found.cliente = match;
    }
  }
  if ((!found.campana_mkt && !found.campana_inconcert) && (Array.isArray(dims.campanas_mkt) || Array.isArray(dims.campanas_inconcert))) {
    const campaignTerm = extractKeywordScopedValue(scrubbed, [
      campaignKeywordPattern(),
    ]);
    if (campaignTerm) {
      const mktMatch = Array.isArray(dims.campanas_mkt) ? findBestDimensionMatch(campaignTerm, dims.campanas_mkt as string[]) : null;
      const inconcertMatch = Array.isArray(dims.campanas_inconcert) ? findBestDimensionMatch(campaignTerm, dims.campanas_inconcert as string[]) : null;
      if (mktMatch) found.campana_mkt = mktMatch;
      else if (inconcertMatch) found.campana_inconcert = inconcertMatch;
    }
  }

  if (!found.cliente && !found.campana_mkt && !found.campana_inconcert) {
    Object.assign(found, resolveEntityFromLooseCandidates(scrubbed, dims));
  }
  // Agentes
  for (const [dimKey, filterKey] of [
    ["agentes_negocio", "agente_negocio"],
    ["agentes_prim_gestion", "agente_prim_gestion"],
    ["agentes_ultim_gestion", "agente_ultim_gestion"],
  ] as const) {
    if (dims[dimKey] && Array.isArray(dims[dimKey])) {
      for (const a of dims[dimKey]) { if (a && msg.includes(a.toLowerCase())) { found[filterKey] = a; break; } }
    }
  }
  // Resultados
  if (dims.resultados_negocio && Array.isArray(dims.resultados_negocio)) {
    for (const r of dims.resultados_negocio) { if (r && r.length > 3 && msg.includes(r.toLowerCase())) { found.result_negocio = r; break; } }
  }
  if (dims.resultados_prim_gestion && Array.isArray(dims.resultados_prim_gestion)) {
    for (const r of dims.resultados_prim_gestion) { if (r && r.length > 3 && msg.includes(r.toLowerCase())) { found.result_prim_gestion = r; break; } }
  }
  if (dims.resultados_ultim_gestion && Array.isArray(dims.resultados_ultim_gestion)) {
    for (const r of dims.resultados_ultim_gestion) { if (r && r.length > 3 && msg.includes(r.toLowerCase())) { found.result_ultim_gestion = r; break; } }
  }
  if (dims.prim_resultado_marcadora && Array.isArray(dims.prim_resultado_marcadora)) {
    for (const r of dims.prim_resultado_marcadora) { if (r && msg.includes(r.toLowerCase())) { found.prim_resultado_marcadora = r; break; } }
  }

  // Portabilidad alias
  if (!found.campana_mkt && /portabilidad/.test(msg) && Array.isArray(dims.campanas_mkt)) {
    const hit = dims.campanas_mkt.find((c: string) => /portabilidad/i.test(c));
    if (hit) found.campana_mkt = hit;
  }
  // Canales
  if (!found.tipo_llamada && /\bwhatsapp\b/.test(msg) && Array.isArray(dims.tipos_llamada)) {
    const w = dims.tipos_llamada.find((t: string) => /whatsapp/i.test(t));
    if (w) found.tipo_llamada = w;
  }
  if (!found.tipo_llamada && /\bc2c\b/.test(msg) && Array.isArray(dims.tipos_llamada)) {
    const w = dims.tipos_llamada.find((t: string) => String(t).toLowerCase().includes("c2c"));
    if (w) found.tipo_llamada = w;
  }
  if (!found.tipo_llamada && /\bentrante\b/.test(msg) && Array.isArray(dims.tipos_llamada)) {
    const w = dims.tipos_llamada.find((t: string) => /entrante/i.test(t));
    if (w) found.tipo_llamada = w;
  }
  if (!found.tipo_llamada && (/formulario/.test(msg) || /\bform\b/.test(msg)) && Array.isArray(dims.tipos_llamada)) {
    const w = dims.tipos_llamada.find((t: string) => /^form$/i.test(String(t).trim()));
    if (w) found.tipo_llamada = w;
  }

  // Agente partial match
  if (!found.agente_negocio && !found.agente_prim_gestion && !found.agente_ultim_gestion) {
    const tokens = scrubbed.toLowerCase().split(/[^a-z0-9áéíóúñü]+/).filter((t: string) => t.length >= 4 && !GENERIC_AGENT_TOKENS.has(t));
    const agentPairs = [["agentes_negocio","agente_negocio"],["agentes_prim_gestion","agente_prim_gestion"],["agentes_ultim_gestion","agente_ultim_gestion"]] as const;
    outer: for (const [dimKey, fk] of agentPairs) {
      const arr = dims[dimKey];
      if (!Array.isArray(arr)) continue;
      for (const a of arr) {
        if (!a || typeof a !== "string") continue;
        const al = a.toLowerCase();
        for (const tok of tokens) { if (al.includes(tok)) { found[fk] = a; break outer; } }
      }
    }
  }

  return found;
}

function detectUnavailableEntityRequest(userMsg: string, dims: any, matchedFilters: Record<string, string>): string | null {
  if (!userMsg || !dims) return null;
  const scrubbed = scrubTimezoneFalsePositives(userMsg);

  if (!matchedFilters.cliente && Array.isArray(dims.clientes)) {
    const clientTerm = extractKeywordScopedValue(scrubbed, [
      /\b(?:cliente|cuenta)\s+([a-z0-9áéíóúñü._\-\s]+?)(?=\s+(?:del?|desde|hasta|por|en|para|y|con)\b|[?.!,;]|$)/i,
    ]);
    if (clientTerm && !findBestDimensionMatch(clientTerm, dims.clientes as string[])) {
      return `No hay datos para el cliente "${clientTerm}" en las cuentas accesibles.`;
    }
  }

  if (!matchedFilters.campana_mkt && !matchedFilters.campana_inconcert) {
    const campaignTerm = extractKeywordScopedValue(scrubbed, [
      campaignKeywordPattern(),
    ]);
    const campaignValues = [
      ...(Array.isArray(dims.campanas_mkt) ? (dims.campanas_mkt as string[]) : []),
      ...(Array.isArray(dims.campanas_inconcert) ? (dims.campanas_inconcert as string[]) : []),
    ];
    if (campaignTerm && !findBestDimensionMatch(campaignTerm, campaignValues)) {
      return `No hay datos para la campaña "${campaignTerm}" en las cuentas accesibles.`;
    }
  }

  if (!matchedFilters.cliente && !matchedFilters.campana_mkt && !matchedFilters.campana_inconcert) {
    const looseReason = detectUnavailableLooseEntityRequest(scrubbed, dims);
    if (looseReason) return looseReason;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════
const ANTI_HALLUCINATION = `
REGLA ABSOLUTA: Cada número DEBE venir de RESULTADO_BD_REAL.
- Si RESULTADO dice "total_leads=M" → usa M directamente. NUNCA sumes filas manualmente.
- Si retorna ERROR o 0 filas → responde "No hay datos para [criterio]" — NUNCA inventes.
- PROHIBIDO escribir operaciones aritméticas como "199+446+397+...=". Usa get_kpis para totales.
- Si una pregunta requiere datos que no existen en el modelo (ej. "promesas de pago", "mora", "monto recuperado"), explica honestamente que el dato no está disponible y sugiere el equivalente más cercano (ej. "ventas (es_venta)" como proxy de cierre).`;

const GLOSARIO_SINONIMOS = `
═══ GLOSARIO Y SINÓNIMOS (mapeo a campos reales) ═══
• "lead" / "registro" / "contacto" → fila en leads
• "venta" / "cierre" / "conversión" / "negocio cerrado" → es_venta=true
• "efectividad" / "tasa de conversión" / "% conversión" / "% cierre" → ventas/leads ×100 (use funnel o get_kpis.conv_pct)
• "contactabilidad" / "% contactados" / "tasa de contacto" / "tasa de respuesta" → contactados (fch_prim_gestion no nulo)/total ×100 (use contactability)
• "contactabilidad marcadora" / "% conectados" → CONNECTED+FINISHED en prim_resultado_marcadora
• "intensidad" / "ocupación" / "carga" → leads por agente (use agg_1d o ranking sobre agente_negocio/agente_prim_gestion)
• "productividad" → ventas por agente (use ranking dimension=agente_negocio metric=ventas)
• "rendimiento" / "performance" → combinación leads+conversión (use ranking metric=conv_pct)
• "agente top" / "mejores agentes" / "los que más venden" / "líderes" → ranking order=desc metric=ventas|conv_pct
• "peores agentes" / "los que menos convierten" → ranking order=asc
• "top N" / "los mejores N" / "ranking de N" → ranking top_n=N
• "comparar A vs B" / "A frente a B" → compare_entities
• "vs mes anterior" / "vs período anterior" → compare_periods
• "embudo" / "pipeline" / "funnel" → funnel
• "canal" → tipo_llamada (Entrante, WhatsApp, Form, C2C, etc.)
• "región" → ciudad (no hay campo región propio)
• "cuenta" / "cliente" → cliente (campo en leads)
• "campaña" → preferir campana_mkt; si no encaja, campana_inconcert
• "BPO" / "operador" / "proveedor" → bpo
• Métricas que NO existen en este modelo: promesas de pago, mora, monto recuperado, días de atraso, SMS individual, email individual. NO los inventes.

═══ INSTRUCCIONES DE TOOL CALLING ═══
• "¿cuántos agentes hay?" → list_dimension_values dimension=agente_negocio
• "¿qué campañas tengo?" → list_dimension_values dimension=campana_mkt
• "efectividad por agente" → ranking dimension=agente_negocio metric=conv_pct order=desc
• "contactabilidad por campaña" → contactability dimension=campana_mkt
• "top 5 agentes por ventas" → ranking dimension=agente_negocio metric=ventas top_n=5 order=desc
• "compara agentes A y B" → compare_entities dimension=agente_negocio values=["A","B"]
• "abril vs marzo" → compare_periods con fechas exactas
• Cruces 2D (ej. "campaña × ciudad") → agg_2d
• Métricas globales sin desglose → get_kpis o funnel`;

const FORMATO_RESPUESTA = `
═══ FORMATO DE RESPUESTA TEXTUAL ═══
1) Comienza con la respuesta directa en 1-2 frases (ej. "El mejor agente es **Juan Pérez** con **47 ventas** y **23,5 %** de conversión.").
2) Si hay 3+ filas devueltas por la herramienta, MUESTRA tabla markdown completa con encabezados claros y todas las filas (no resumas), e incluye fila TOTAL al final cuando aplique:
| # | Agente | Leads | Ventas | Conv % |
|---:|---|---:|---:|---:|
| 1 | Juan | 200 | 47 | 23,5 % |
| | **TOTAL** | **1.234** | **289** | **23,4 %** |
3) Formato numérico: usa puntos como separador de miles (1.234), coma decimal (23,5 %), porcentajes con 1 decimal y símbolo %.
4) Si la herramienta devolvió 1-2 filas, basta narrarlo sin tabla.
5) Cierra con 1-2 insights/recomendaciones cortos solo si aportan valor.
6) Máximo 700 palabras.`;

function buildAnalyticsSys(dims: any, kpis: any, af: Filters, todayStr: string, tenantNames: string[]): string {
  return `Eres asistente BI senior de Converti-IA Analytics.
Hoy es ${todayStr} (America/Santiago). El usuario tiene acceso a datos de: ${tenantNames.join(", ") || "todas las cuentas"}.
RANGO REAL DISPONIBLE: ${kpis?.fecha_min || "sin datos"} → ${kpis?.fecha_max || "sin datos"}.

DIMENSIONES (referencia de columnas/valores válidos): ${JSON.stringify(dims, null, 0)}
FILTROS UI ACTIVOS: ${JSON.stringify(af)}

MODELO TEMPORAL: fch_creacion=llegada del lead | fch_prim_gestion=1er contacto | fch_ultim_gestion=última gestión | fch_negocio=cierre/ganado

═══ REGLA CRÍTICA: SIEMPRE USAR HERRAMIENTAS ═══
Para CUALQUIER pregunta con cifras, conteos, métricas, rankings o comparativos: DEBES llamar al menos UNA herramienta. Prohibido inventar o reutilizar números de mensajes previos en la conversación. Cada pregunta = nueva consulta a herramientas.

═══ REGLA #1 — FILTROS ═══
Cuando el usuario mencione un valor concreto (ciudad, campaña, agente, tipo llamada, resultado, cliente, BPO), DEBES pasarlo en el parámetro "filters" de la herramienta.

═══ REGLAS DE EJECUCIÓN ═══
- Para TOTALES usa get_kpis con filtros, NUNCA sumes filas manualmente.
- Sin rango de fechas explícito: NO envíes fecha_desde/fecha_hasta (todo el histórico).
- "hoy" → fecha_desde=fecha_hasta=${todayStr}.
- "hasta el momento" / "hasta ahora" / "al momento" → sin fecha_hasta (usa todo el histórico).
- Fecha sin año (ej. "15 de marzo") → año más reciente que exista en la data para ese día/mes.
- NUNCA pidas CSV, Excel, archivo o fuente de datos: ya estás conectado.
- Mantén contexto de FILTROS en seguimientos ("¿y por ciudad?"), pero NUNCA reutilices CIFRAS previas.

${GLOSARIO_SINONIMOS}
${ANTI_HALLUCINATION}
${FORMATO_RESPUESTA}`;
}

function buildDashSys(dims: any, kpis: any, af: Filters, todayStr: string, tenantNames: string[]): string {
  return `Eres el asistente analítico de DashDinamics (Converti-IA): generas insights y dashboards desde leads consolidados de ${tenantNames.length} cuenta(s): ${tenantNames.join(", ") || "todas"}.
Hoy es ${todayStr} (America/Santiago).
RANGO REAL DISPONIBLE: ${kpis?.fecha_min || "sin datos"} → ${kpis?.fecha_max || "sin datos"}.

DIMENSIONES (valores reales consolidados): ${JSON.stringify(dims, null, 0)}
FILTROS UI: ${JSON.stringify(af)}

═══ ZONA HORARIA ═══
Interpreta fechas en America/Santiago. "ayer", "hoy", "última semana", "este mes", "marzo", etc. → fecha_desde / fecha_hasta YYYY-MM-DD.

${GLOSARIO_SINONIMOS}

═══ REGLA #1 — FILTROS ═══
Todo valor concreto (ciudad, campaña, agente, cliente, BPO) va en "filters" SOLO si el usuario lo pide explícitamente.
Sin rango de fechas explícito: asume TODO el rango disponible (no limites a 7 días).
- "hasta el momento" / "hasta ahora" → fecha_hasta=${kpis?.fecha_max || todayStr}.
- Fecha sin año → año más reciente disponible para ese día/mes.
- NUNCA pidas archivos ni aclaraciones sobre la fuente.

═══ EJECUCIÓN OBLIGATORIA ═══
NUNCA devuelvas formularios ni clarifying_questions. SIEMPRE llama herramientas y devuelve response_mode="dashboard" con datos reales.

═══ ELECCIÓN DE VISUALIZACIÓN ═══
- Tendencia temporal → line (con fechas en eje X)
- Comparación entre categorías (≤ 12) → bar
- Distribución / participación → pie / donut
- Ranking → bar horizontal ordenado
- Cruce 2D → heatmap o tabla
- KPI individual → kpi card (en kpis[])
- Embudo → funnel
Usa "rationale" en cada chart para explicar por qué elegiste ese tipo.

═══ FORMATO dashboard ═══
assistant_message: insights en markdown (mismo formato narrativo del chatbot, máx 300 palabras).
dashboard: title, subtitle, time_range, kpis[], charts[], tables[], insights[], recommended_next_steps[].
Cada chart: { id, title, type, rationale, config (ECharts compatible) }.
Tablas: headers string[]; rows string[][]. Incluye fila TOTAL si aplica.
Paleta: Leads #3498db, Ventas #2ecc71, Conversión #e74c3c, Contactabilidad #9b59b6.
${ANTI_HALLUCINATION}

CONSISTENCIA CRÍTICA: los números del dashboard DEBEN coincidir exactamente con lo que respondería el chatbot para la misma pregunta. Usa los mismos tools.

RESPONDE SOLO JSON válido:
{"response_mode":"dashboard","assistant_message":"...","decision_goal":"...","dashboard":{...}}`;
}

function buildBotWithToolsSys(botPrompt: string, dims: any, kpis: any, todayStr: string, tenantNames: string[]): string {
  return `${botPrompt.trim()}

═══ CONTEXTO DE DATOS ═══
Tienes acceso a herramientas analíticas sobre la tabla de leads consolidada de ${tenantNames.length} cuenta(s): ${tenantNames.join(", ") || "todas"}.
Hoy es ${todayStr} (America/Santiago).
RANGO REAL DISPONIBLE: ${kpis?.fecha_min || "sin datos"} → ${kpis?.fecha_max || "sin datos"}.
DIMENSIONES (solo referencia de columnas/valores existentes): ${JSON.stringify(dims, null, 0)}

═══ REGLA CRÍTICA: SIEMPRE USAR HERRAMIENTAS ═══
Para CUALQUIER pregunta que involucre números, conteos, totales, porcentajes, métricas, comparativos, rankings, fechas, agentes, campañas, ciudades, ventas, leads o gestión: DEBES llamar al menos UNA herramienta antes de responder.
PROHIBIDO inventar o estimar cifras. PROHIBIDO usar números de mensajes anteriores en esta conversación: cada pregunta requiere consulta fresca a herramientas.
Incluso si la respuesta parece obvia ("¿cuántos leads hay?"), llama get_kpis sin filtros y usa total_leads del RESULTADO_BD.

Herramientas disponibles: get_kpis, agg_1d, agg_2d, time_metrics, funnel, ranking, compare_entities, compare_periods, contactability, list_dimension_values.
Sin rango explícito: NO envíes fecha_desde/fecha_hasta (usa TODO el rango disponible).
"hoy" → fecha_desde=fecha_hasta=${todayStr}.
"hasta el momento" / "hasta ahora" → sin filtros de fecha (todo el histórico).
Fecha sin año → año más reciente que exista en los datos.
NUNCA pidas CSV, Excel, archivo, base de datos o fuente de datos.
Mantén el contexto conversacional para FILTROS (preguntas de seguimiento "¿y por ciudad?"), pero NUNCA reutilices CIFRAS previas: vuelve a consultar.

${GLOSARIO_SINONIMOS}
${ANTI_HALLUCINATION}
${FORMATO_RESPUESTA}
Responde en español.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DASH: tools → JSON forzado
// ═══════════════════════════════════════════════════════════════════════════
async function runDash(
  key: string,
  sys: string,
  msgs: any[],
  admin: any,
  af: Filters,
  ff: Record<string, string> = {},
  temporalOverrides?: TemporalOverrides | null,
) {
  const all = [{ role: "system", content: sys }, ...msgs];
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: all,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const msg = (await r.json()).choices?.[0]?.message;
    if (!msg) throw new Error("No message");
    all.push(msg);
    if (!msg.tool_calls?.length) break;
    const res = await Promise.all(
      msg.tool_calls.map(async (tc: any) => {
        const a = JSON.parse(tc.function.arguments || "{}");
        console.log(`[D] ${tc.function.name}(${JSON.stringify(a)})`);
        const r = await executeToolViaRpc(admin, tc.function.name, a, af, ff, temporalOverrides);
        console.log(`[D] → ${r.substring(0, 150)}`);
        return { role: "tool", tool_call_id: tc.id, content: r };
      }),
    );
    all.push(...res);
  }
  const fr = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        ...all,
        { role: "user", content: 'JSON único: response_mode "dashboard" obligatorio. RESULTADO_BD_REAL en kpis/charts/tables. tablas: rows array de arrays. Sin clarifying_questions.' },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });
  if (!fr.ok) throw new Error(`OpenAI final ${fr.status}`);
  return (await fr.json()).choices?.[0]?.message;
}

// Text-only bot (no tools)
async function runTextBot(
  key: string,
  sys: string,
  msgs: { role: string; content: string }[],
  model: string,
): Promise<ReadableStream> {
  const all = [{ role: "system", content: sys }, ...msgs];
  const fr = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "gpt-4o-mini", messages: all, stream: true, temperature: 0.45, max_tokens: 2048 }),
  });
  if (!fr.ok) throw new Error(`OpenAI ${fr.status}: ${await fr.text()}`);
  if (!fr.body) throw new Error("Sin cuerpo");
  return fr.body;
}

// Bot with analytics tools
async function runBotWithTools(
  key: string,
  sys: string,
  msgs: any[],
  admin: any,
  af: Filters,
  ff: Record<string, string>,
  model: string,
  temporalOverrides?: TemporalOverrides | null,
): Promise<ReadableStream | string> {
  const all = [{ role: "system", content: sys }, ...msgs];
  for (let i = 0; i < 5; i++) {
    // Force a tool call on the very first turn so the model never answers from cached/prior numbers
    const toolChoice = i === 0 ? "required" : "auto";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "gpt-4o-mini", messages: all, tools: TOOLS, tool_choice: toolChoice, temperature: 0.2, max_tokens: 2048 }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const msg = (await r.json()).choices?.[0]?.message;
    if (!msg) throw new Error("No msg");
    all.push(msg);
    if (!msg.tool_calls?.length) {
      if (msg.content) return msg.content;
      break;
    }
    const res = await Promise.all(
      msg.tool_calls.map(async (tc: any) => {
        const a = JSON.parse(tc.function.arguments || "{}");
        console.log(`[B] ${tc.function.name}(${JSON.stringify(a)})`);
        const r = await executeToolViaRpc(admin, tc.function.name, a, af, ff, temporalOverrides);
        console.log(`[B] → ${r.substring(0, 150)}`);
        return { role: "tool", tool_call_id: tc.id, content: r };
      }),
    );
    all.push(...res);
  }
  // Final streaming
  all.push({ role: "system", content: "Responde CONCISO. Para totales usa total_leads del RESULTADO_BD. NUNCA sumes manualmente. Máximo 500 palabras." });
  const fr = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "gpt-4o-mini", messages: all, stream: true, temperature: 0.1, max_tokens: 1024 }),
  });
  if (!fr.ok) throw new Error(`Stream ${fr.status}`);
  return fr.body!;
}

// Analytics mode (streaming)
async function runAnalytics(
  key: string,
  sys: string,
  msgs: any[],
  admin: any,
  af: Filters,
  ff: Record<string, string> = {},
  temporalOverrides?: TemporalOverrides | null,
): Promise<ReadableStream | string> {
  const all = [{ role: "system", content: sys }, ...msgs];
  for (let i = 0; i < 5; i++) {
    const toolChoice = i === 0 ? "required" : "auto";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: all, tools: TOOLS, tool_choice: toolChoice, temperature: 0.1, max_tokens: 2048 }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const msg = (await r.json()).choices?.[0]?.message;
    if (!msg) throw new Error("No msg");
    all.push(msg);
    if (!msg.tool_calls?.length) {
      if (msg.content) return msg.content;
      break;
    }
    const res = await Promise.all(
      msg.tool_calls.map(async (tc: any) => {
        const a = JSON.parse(tc.function.arguments || "{}");
        console.log(`[A] ${tc.function.name}(${JSON.stringify(a)})`);
        const r = await executeToolViaRpc(admin, tc.function.name, a, af, ff, temporalOverrides);
        console.log(`[A] → ${r.substring(0, 150)}`);
        return { role: "tool", tool_call_id: tc.id, content: r };
      }),
    );
    all.push(...res);
  }
  all.push({ role: "system", content: "Responde CONCISO. Usa total_leads del RESULTADO_BD. Máximo 500 palabras." });
  const fr = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: all, stream: true, temperature: 0.1, max_tokens: 1024 }),
  });
  if (!fr.ok) throw new Error(`Stream ${fr.status}`);
  return fr.body!;
}

// ═══════════════════════════════════════════════════════════════════════════
// JSON NORMALIZER
// ═══════════════════════════════════════════════════════════════════════════

function coerceStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? ""));
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).map((x) => String(x ?? ""));
  return [];
}

function sanitizeChartConfig(config: unknown): unknown {
  if (!config || typeof config !== "object" || Array.isArray(config)) return config;
  const c = config as Record<string, unknown>;
  const raw = c.series;
  if (!Array.isArray(raw)) return config;
  const cleaned = raw.filter((s) => s !== null && typeof s === "object" && !Array.isArray(s));
  if (cleaned.length === raw.length) return config;
  return { ...c, series: cleaned };
}

function normalizeTableRows(headers: string[], rows: unknown): string[][] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (Array.isArray(row)) return row.map((c) => (c != null ? String(c) : "—"));
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      if (headers.length > 0) return headers.map((h) => { const v = o[h] ?? o[String(h).toLowerCase()]; return v != null ? String(v) : "—"; });
      return Object.values(o).map((v) => (v != null ? String(v) : "—"));
    }
    return [row != null ? String(row) : "—"];
  });
}

function sanitizeDashboard(d: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!d || typeof d !== "object") return { title: "Dashboard", subtitle: "", time_range: "", kpis: [], charts: [], tables: [], insights: [], recommended_next_steps: [] };
  const charts = Array.isArray(d.charts) ? d.charts.map((ch: any) => ({ ...ch, config: ch?.config != null ? sanitizeChartConfig(ch.config) : ch?.config })) : [];
  const tables = Array.isArray(d.tables) ? d.tables.map((t: any) => {
    const headers = Array.isArray(t?.headers) ? t.headers.map((h: unknown) => String(h ?? "")) : [];
    let rows = t?.rows;
    if (Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])) {
      const sample = rows[0] as Record<string, unknown>;
      const derived = headers.length > 0 ? headers : Object.keys(sample);
      return { ...t, headers: derived, rows: normalizeTableRows(derived, rows) };
    }
    return { ...t, headers, rows: normalizeTableRows(headers, rows) };
  }) : [];
  return { ...d, kpis: Array.isArray(d.kpis) ? d.kpis : [], charts, tables, insights: Array.isArray(d.insights) ? d.insights : [], recommended_next_steps: coerceStringArray(d.recommended_next_steps) };
}

function coerceClarificationToDashboard(raw: any): any {
  return { response_mode: "dashboard", assistant_message: raw.assistant_message || "Reformula tu pregunta.", decision_goal: null, dashboard: null };
}

function normalizeDashResponse(raw: any): any {
  if (raw.response_mode) {
    if (raw.response_mode === "clarification") return coerceClarificationToDashboard(raw);
    if (raw.response_mode === "dashboard" && raw.dashboard) return { ...raw, dashboard: sanitizeDashboard(raw.dashboard) };
    return raw;
  }
  if (raw.dashboard?.response_mode) {
    const inner = raw.dashboard; const mode = inner.response_mode; delete inner.response_mode;
    return { response_mode: mode, assistant_message: inner.assistant_message || "", decision_goal: inner.decision_goal || null, dashboard: sanitizeDashboard(inner) };
  }
  const keys = Object.keys(raw);
  if (keys.length === 1 && typeof raw[keys[0]] === "object") {
    const inner = raw[keys[0]];
    if (inner.charts || inner.tables || inner.kpis || inner.data) {
      return { response_mode: "dashboard", assistant_message: inner.assistant_message || "", decision_goal: inner.decision_goal || null, dashboard: sanitizeDashboard({ title: inner.title || keys[0], subtitle: inner.subtitle || "", time_range: inner.time_range || "", kpis: inner.kpis || [], charts: inner.charts || [], insights: inner.insights || [], tables: inner.tables || [], recommended_next_steps: inner.recommended_next_steps || [] }) };
    }
  }
  if (raw.charts || raw.tables || raw.kpis) {
    return { response_mode: "dashboard", assistant_message: raw.assistant_message || "", decision_goal: raw.decision_goal || null, dashboard: sanitizeDashboard({ title: raw.title || "Dashboard", subtitle: raw.subtitle || "", time_range: raw.time_range || "", kpis: raw.kpis || [], charts: raw.charts || [], insights: raw.insights || [], tables: raw.tables || [], recommended_next_steps: raw.recommended_next_steps || [] }) };
  }
  if (raw.chart_options) return { response_mode: "chart_picker", assistant_message: raw.assistant_message || "", chart_options: raw.chart_options };
  if (raw.clarifying_questions) return coerceClarificationToDashboard(raw);
  return { response_mode: "dashboard", assistant_message: raw.assistant_message || raw.message || JSON.stringify(raw).substring(0, 500), dashboard: null };
}

function buildNoDataDashReply(message: string) {
  return { response_mode: "dashboard", assistant_message: message, decision_goal: null, dashboard: null };
}

function buildSsePayload(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: ue } = await sb.auth.getUser();
    if (ue || !user)
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { messages, mode, botId, webhookUrl } = body;
    const af: Filters = body.filters ?? {};
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get ALL accessible tenant IDs for this user
    const { data: tenantIds } = await admin.rpc("get_accessible_tenant_ids", { _user_id: user.id });
    const tids: string[] = Array.isArray(tenantIds) ? tenantIds : [];
    console.log(`[MAIN] user=${user.id} tenants=${tids.length} mode=${mode} botId=${botId}`);

    // Get tenant names for context
    let tenantNames: string[] = [];
    if (tids.length > 0) {
      const { data: tenants } = await admin.from("tenants").select("name").in("id", tids);
      tenantNames = (tenants || []).map((t: any) => t.name);
    }

    const isDash = mode === "dashdinamics";
    const isBotChat = Boolean(botId) && !isDash;
    const key = Deno.env.get("OPENAI_API_KEY");

    // Today in Chile
    const todayChile = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });

    if (mode === "bot_builder") {
      if (!key) return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: isSuper } = await sb.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
      if (!isSuper) return new Response(JSON.stringify({ error: "Solo super administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const desc = String(body.contextDescription ?? "").trim();
      if (!desc) return new Response(JSON.stringify({ error: "contextDescription es requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const bsys = `Eres experto en diseño de system prompts para asistentes conversacionales B2B. Devuelve SOLO el texto del system prompt en español, sin prefijos. Incluye: rol, tono, límites, formato. 400-1500 palabras.`;
      const br = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: bsys }, { role: "user", content: `Descripción:\n\n${desc}` }], temperature: 0.35, max_tokens: 2500 }),
      });
      if (!br.ok) return new Response(JSON.stringify({ error: `OpenAI: ${await br.text()}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const bj = await br.json();
      return new Response(JSON.stringify({ system_prompt: String(bj.choices?.[0]?.message?.content ?? "").trim() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (webhookUrl) {
      try {
        const last = messages[messages.length - 1]?.content || "";
        const wr = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: last, chatInput: last, sessionId: botId || "default", tenantId: tids[0] || null }),
        });
        if (!wr.ok) throw new Error(`Webhook ${wr.status}`);
        const wd = await wr.json();
        const reply = typeof wd === "string" ? wd : Array.isArray(wd) ? wd[0]?.output || wd[0]?.response || JSON.stringify(wd[0]) : wd.output || wd.response || wd.message || wd.text || JSON.stringify(wd);
        return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) { console.error("webhook:", e); }
    }

    if (!key) return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: dimsData, error: dimsError } = await admin.rpc("accessible_leads_dimensions");
    const { data: kpisData, error: kpisError } = await admin.rpc("accessible_leads_kpis", {
      _fecha_desde: null,
      _fecha_hasta: null,
      _date_field: "fch_creacion",
      _filters: null,
    });
    if (dimsError) throw dimsError;
    if (kpisError) throw kpisError;
    const dims = dimsData || {};
    const kpis = kpisData || {};
    const rangeDates = Array.isArray((dims as any)?.rango_fechas) ? [] : [kpis?.fecha_min, kpis?.fecha_max].filter(Boolean) as string[];
    const availableDates = rangeDates.length === 2 ? rangeDates : [kpis?.fecha_min, kpis?.fecha_max].filter(Boolean) as string[];

    let sys: string;
    let forcedFilters: Record<string, string> = {};
    let botModel = "gpt-4o-mini";
    let botUsesTools = false;
    const lastUserMsg = String(messages.filter((m: any) => m.role === "user").pop()?.content || "").trim();
    const dateHints = resolveDateHintsFromMessage(lastUserMsg, availableDates);
    const temporalOverrides = inferTemporalOverridesFromMessage(lastUserMsg, availableDates, todayChile, kpis?.fecha_min || null, kpis?.fecha_max || null);
    let unavailableEntityReason: string | null = null;

    if (!Number(kpis?.total_leads || 0)) {
      const noData = "No hay leads accesibles para responder con datos reales.";
      if (isDash) {
        return new Response(JSON.stringify({ reply: buildNoDataDashReply(noData) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(buildSsePayload(noData), { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    if (isBotChat) {
      const { data: bot, error: botErr } = await admin
        .from("bots")
        .select("system_prompt, model, config")
        .eq("id", botId)
        .maybeSingle();
      if (botErr || !bot) return new Response(JSON.stringify({ error: "Bot no encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      botModel = (bot as { model?: string }).model || "gpt-4o-mini";
      const cfg = (bot as any).config || {};
      const dataSource = Array.isArray(cfg.dataSources) ? cfg.dataSources[0] : "leads";

      // If bot is configured for leads data, enable analytics tools
      if (dataSource === "leads") {
        botUsesTools = true;
        sys = buildBotWithToolsSys(
          String(bot.system_prompt || "Eres un asistente útil."),
          dims, kpis, todayChile, tenantNames
        );
        forcedFilters = extractFiltersFromMessage(lastUserMsg, dims);
        unavailableEntityReason = detectUnavailableEntityRequest(lastUserMsg, dims, forcedFilters);
      } else {
        sys = `${String(bot.system_prompt || "Eres un asistente útil.").trim()}\n\nResponde siempre en español. Puedes usar markdown. Sé claro y útil.`;
      }
    } else {
      sys = isDash
        ? buildDashSys(dims, kpis, af, todayChile, tenantNames)
        : buildAnalyticsSys(dims, kpis, af, todayChile, tenantNames);

      forcedFilters = extractFiltersFromMessage(lastUserMsg, dims);
      unavailableEntityReason = detectUnavailableEntityRequest(lastUserMsg, dims, forcedFilters);
      if (Object.keys(forcedFilters).length > 0) {
        sys += `\n⚠️ FILTROS DETECTADOS: ${JSON.stringify(forcedFilters)}. Inclúyelos en cada herramienta.`;
      }
    }

    if (dateHints.length > 0) {
      sys += `\n⚠️ FECHAS RESUELTAS SEGÚN LA DATA: ${dateHints.join("; ")}. Usa exactamente esas fechas si corresponde.`;
    }
    if (temporalOverrides) {
      sys += `\n⚠️ RANGO TEMPORAL RESUELTO AUTOMÁTICAMENTE: ${JSON.stringify(temporalOverrides)}. Aplícalo en las herramientas.`;
    }
    if (unavailableEntityReason) {
      if (isDash) {
        return new Response(JSON.stringify({ reply: buildNoDataDashReply(unavailableEntityReason) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(buildSsePayload(unavailableEntityReason), { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    console.log(`[MAIN] leads=${kpis?.total_leads || 0} dims=${JSON.stringify(dims).length}c mode=${mode} botTools=${botUsesTools}`);

    if (isDash) {
      try {
        const msg = await runDash(key, sys, messages, admin, af, forcedFilters, temporalOverrides);
        const c = msg?.content || "{}";
        try {
          const parsed = JSON.parse(c);
          const normalized = normalizeDashResponse(parsed);
          if (normalized.response_mode === "clarification") {
            return new Response(JSON.stringify({ reply: coerceClarificationToDashboard(normalized) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ reply: normalized }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch {
          return new Response(JSON.stringify({ reply: { response_mode: "dashboard", assistant_message: c, dashboard: null } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (e) {
        console.error("Dash err:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (isBotChat) {
      try {
        if (botUsesTools) {
          const res = await runBotWithTools(key, sys, messages, admin, af, forcedFilters, botModel, temporalOverrides);
          if (typeof res === "string") {
            const sse = buildSsePayload(res);
            return new Response(sse, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
          }
          return new Response(res, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        } else {
          const stream = await runTextBot(key, sys, messages, botModel);
          return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
      } catch (e) {
        console.error("Bot chat err:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Analytics mode (default)
    try {
      const res = await runAnalytics(key, sys, messages, admin, af, forcedFilters, temporalOverrides);
      if (typeof res === "string") {
        const sse = buildSsePayload(res);
        return new Response(sse, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }
      return new Response(res, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    } catch (e) {
      console.error("Analytics err:", e);
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("Fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

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
      description: "Embudo de conversión (leads → contactados → negocio → ventas).",
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
];

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-TENANT: fetch leads from ALL accessible tenants, execute tools in-memory
// ═══════════════════════════════════════════════════════════════════════════

async function fetchAccessibleLeads(
  admin: any,
  tenantIds: string[],
): Promise<any[]> {
  if (!tenantIds.length) return [];
  const allLeads: any[] = [];
  // Fetch up to 5000 leads per tenant (use service_role which bypasses RLS)
  for (const tid of tenantIds) {
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await admin
        .from("leads")
        .select("*")
        .eq("tenant_id", tid)
        .range(from, from + pageSize - 1);
      if (error) { console.error(`leads fetch err tid=${tid}:`, error.message); break; }
      if (!data || data.length === 0) break;
      allLeads.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
      if (from >= 5000) break; // safety cap per tenant
    }
  }
  console.log(`[MULTI] Fetched ${allLeads.length} leads from ${tenantIds.length} tenants`);
  return allLeads;
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
function computeKpis(leads: any[]): any {
  const total = leads.length;
  const ventas = leads.filter(l => l.es_venta).length;
  const conGestion = leads.filter(l => l.fch_prim_gestion).length;
  const sinGestion = total - conGestion;
  const conNegocio = leads.filter(l => l.fch_negocio).length;
  const contactMarcadora = leads.filter(l => ["CONNECTED","FINISHED"].includes(l.prim_resultado_marcadora)).length;

  const respTimes: number[] = [];
  const cicloTimes: number[] = [];
  for (const l of leads) {
    if (l.fch_prim_gestion && l.fch_creacion) {
      const diff = (new Date(l.fch_prim_gestion).getTime() - new Date(l.fch_creacion).getTime()) / 60000;
      if (diff >= 0 && diff <= 43200) respTimes.push(diff);
    }
    if (l.fch_negocio && l.fch_creacion) {
      const diff = (new Date(l.fch_negocio).getTime() - new Date(l.fch_creacion).getTime()) / 60000;
      if (diff >= 0 && diff <= 43200) cicloTimes.push(diff);
    }
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : null;

  // Date range
  const dates = leads.map(l => l.fch_creacion).filter(Boolean).map((d: string) => new Date(d).getTime()).filter((t: number) => !isNaN(t));
  const minDate = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0,10) : null;
  const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0,10) : null;

  return {
    total_leads: total,
    total_ventas: ventas,
    conv_pct: total ? Math.round(ventas/total*10000)/100 : 0,
    contactabilidad_marcadora_pct: total ? Math.round(contactMarcadora/total*10000)/100 : 0,
    con_gestion: conGestion,
    sin_gestion: sinGestion,
    con_negocio: conNegocio,
    fecha_min: minDate,
    fecha_max: maxDate,
    tasa_contacto_pct: total ? Math.round(conGestion/total*10000)/100 : 0,
    avg_resp_min: avg(respTimes),
    avg_ciclo_min: avg(cicloTimes),
  };
}

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

/** Execute tool against in-memory leads */
function executeToolInMemory(
  allLeads: any[],
  name: string,
  args: any,
  af: Filters,
  forcedFilters: Record<string, string>,
): string {
  const filtered = applyFiltersToLeads(allLeads, args, af, forcedFilters);
  const df = args.date_field || null;

  console.log(`[EXEC-MEM] ${name} total=${allLeads.length} filtered=${filtered.length} filters=${JSON.stringify({...forcedFilters, ...args.filters})}`);

  try {
    let data: any;
    switch (name) {
      case "get_kpis": data = computeKpis(filtered); break;
      case "agg_1d": data = agg1d(filtered, args.dimension, df, args.limit || 50); break;
      case "agg_2d": data = agg2d(filtered, args.dim1, args.dim2, df, args.top_n || 10); break;
      case "time_metrics": data = timeMetrics(filtered, args.group_by || null, df); break;
      case "funnel": data = funnelCalc(filtered); break;
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

// ═══════════════════════════════════════════════════════════════════════════
// FILTER EXTRACTION from user message
// ═══════════════════════════════════════════════════════════════════════════

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════
const ANTI_HALLUCINATION = `
REGLA ABSOLUTA: Cada número DEBE venir de RESULTADO_BD_REAL.
- Si RESULTADO dice "total_leads=M" → usa M directamente. NUNCA sumes filas manualmente.
- Si retorna ERROR o 0 filas → responde "No hay datos" — NUNCA inventes.
- PROHIBIDO escribir operaciones aritméticas como "199+446+397+...=". Usa get_kpis para totales.
- Sé CONCISO. Máximo 500 palabras por respuesta.`;

function buildAnalyticsSys(dims: any, kpis: any, af: Filters, todayStr: string, tenantNames: string[]): string {
  return `Eres asistente BI de Converti-IA Analytics.
Hoy es ${todayStr} (America/Santiago). El usuario tiene acceso a datos de: ${tenantNames.join(", ") || "todas las cuentas"}.

DIMENSIONES: ${JSON.stringify(dims, null, 0)}
KPIs: ${JSON.stringify(kpis, null, 0)}
FILTROS FRONTEND: ${JSON.stringify(af)}

MODELO: fch_creacion=llegada | fch_prim_gestion=1er contacto | fch_ultim_gestion=última gestión | fch_negocio=cierre
Dimensión "cliente" = cuenta/tenant del lead.

═══ REGLA #1 — FILTROS ═══
Cuando el usuario mencione CUALQUIER valor específico (ciudad, campaña, agente, tipo llamada, resultado, cliente), DEBES pasarlo en el parámetro "filters" de la herramienta.

═══ OTRAS REGLAS ═══
${ANTI_HALLUCINATION}
- Para TOTALES usa get_kpis con filtros, NUNCA sumes filas.
- Sin rango de fechas explícito: asume TODO el rango disponible.

FORMATO: español, markdown. Tablas:
| Col | Leads | Ventas | Conv% |
|-----|-------|--------|-------|`;
}

function buildDashSys(dims: any, kpis: any, af: Filters, todayStr: string, tenantNames: string[]): string {
  return `Eres el asistente analítico de DashDinamics (Converti-IA): generas insights y dashboards desde leads consolidados de ${tenantNames.length} cuenta(s): ${tenantNames.join(", ") || "todas"}.
Hoy es ${todayStr} (America/Santiago).

DIMENSIONES (valores reales consolidados): ${JSON.stringify(dims, null, 0)}
KPIs globales: ${JSON.stringify(kpis, null, 0)}
FILTROS UI: ${JSON.stringify(af)}

═══ ZONA HORARIA ═══
Interpreta fechas en America/Santiago. "ayer", "hoy", "última semana", "este mes", "marzo", etc. → fecha_desde / fecha_hasta YYYY-MM-DD.

═══ GLOSARIO ═══
Lead=registro contacto. Venta=es_venta=true. Efectividad(%)=ventas/leads×100. Contactabilidad(%)=CONNECTED+FINISHED/total×100.
cliente = cuenta/tenant. Si el usuario pregunta "de la cuenta X" o "del cliente X" → filters={"cliente":"X"}.

═══ REGLA #1 — FILTROS ═══
Todo valor concreto va en "filters" SOLO si el usuario lo pide explícitamente.
Sin rango de fechas explícito: asume TODO el rango disponible (no limites a 7 días).

═══ EJECUCIÓN OBLIGATORIA ═══
NUNCA devuelvas formularios ni clarifying_questions. SIEMPRE llama herramientas y devuelve response_mode "dashboard" con datos reales.

═══ FORMATO dashboard ═══
assistant_message: insights en markdown. dashboard: title, subtitle, time_range, kpis, charts, tables, insights, recommended_next_steps.
Cada chart: id, title, type, rationale, config ECharts. Tablas: headers string[]; rows string[][].
Paleta: Leads #3498db, Ventas #2ecc71, Conversión #e74c3c.
${ANTI_HALLUCINATION}

RESPONDE SOLO JSON válido:
{"response_mode":"dashboard","assistant_message":"...","decision_goal":"...","dashboard":{...}}`;
}

function buildBotWithToolsSys(botPrompt: string, dims: any, kpis: any, todayStr: string, tenantNames: string[]): string {
  return `${botPrompt.trim()}

═══ CONTEXTO DE DATOS ═══
Tienes acceso a herramientas analíticas sobre la tabla de leads consolidada de ${tenantNames.length} cuenta(s): ${tenantNames.join(", ") || "todas"}.
Hoy es ${todayStr} (America/Santiago).
DIMENSIONES: ${JSON.stringify(dims, null, 0)}
KPIs actuales: ${JSON.stringify(kpis, null, 0)}

Cuando el usuario pregunte sobre datos, leads, ventas, métricas, agentes, campañas, ciudades, etc., USA las herramientas (get_kpis, agg_1d, agg_2d, time_metrics, funnel).
Sin rango explícito: usa TODO el rango disponible.
${ANTI_HALLUCINATION}
Responde en español, markdown.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DASH: tools → JSON forzado
// ═══════════════════════════════════════════════════════════════════════════
async function runDash(
  key: string,
  sys: string,
  msgs: any[],
  allLeads: any[],
  af: Filters,
  ff: Record<string, string> = {},
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
        const r = executeToolInMemory(allLeads, tc.function.name, a, af, ff);
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
  allLeads: any[],
  af: Filters,
  ff: Record<string, string>,
  model: string,
): Promise<ReadableStream | string> {
  const all = [{ role: "system", content: sys }, ...msgs];
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || "gpt-4o-mini", messages: all, tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 2048 }),
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
        const r = executeToolInMemory(allLeads, tc.function.name, a, af, ff);
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
  allLeads: any[],
  af: Filters,
  ff: Record<string, string> = {},
): Promise<ReadableStream | string> {
  const all = [{ role: "system", content: sys }, ...msgs];
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: all, tools: TOOLS, tool_choice: "auto", temperature: 0.1, max_tokens: 2048 }),
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
        const r = executeToolInMemory(allLeads, tc.function.name, a, af, ff);
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

    // Fetch ALL leads from ALL accessible tenants
    const allLeads = await fetchAccessibleLeads(admin, tids);
    const dims = buildDimensionsFromLeads(allLeads);
    const kpis = computeKpis(allLeads);

    let sys: string;
    let forcedFilters: Record<string, string> = {};
    let botModel = "gpt-4o-mini";
    let botUsesTools = false;

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
      if (dataSource === "leads" && allLeads.length > 0) {
        botUsesTools = true;
        sys = buildBotWithToolsSys(
          String(bot.system_prompt || "Eres un asistente útil."),
          dims, kpis, todayChile, tenantNames
        );
        const lastUserMsg = String(messages.filter((m: any) => m.role === "user").pop()?.content || "").trim();
        forcedFilters = extractFiltersFromMessage(lastUserMsg, dims);
      } else {
        sys = `${String(bot.system_prompt || "Eres un asistente útil.").trim()}\n\nResponde siempre en español. Puedes usar markdown. Sé claro y útil.`;
      }
    } else {
      sys = isDash
        ? buildDashSys(dims, kpis, af, todayChile, tenantNames)
        : buildAnalyticsSys(dims, kpis, af, todayChile, tenantNames);

      const lastUserMsg = String(messages.filter((m: any) => m.role === "user").pop()?.content || "").trim();
      if (isDash) {
        forcedFilters = {};
      } else {
        forcedFilters = extractFiltersFromMessage(lastUserMsg, dims);
        if (Object.keys(forcedFilters).length > 0) {
          sys += `\n⚠️ FILTROS DETECTADOS: ${JSON.stringify(forcedFilters)}. Inclúyelos en cada herramienta.`;
        }
      }
    }

    console.log(`[MAIN] leads=${allLeads.length} dims=${JSON.stringify(dims).length}c mode=${mode} botTools=${botUsesTools}`);

    if (isDash) {
      try {
        const msg = await runDash(key, sys, messages, allLeads, af, forcedFilters);
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
          const res = await runBotWithTools(key, sys, messages, allLeads, af, forcedFilters, botModel);
          if (typeof res === "string") {
            const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: res } }] })}\n\ndata: [DONE]\n\n`;
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
      const res = await runAnalytics(key, sys, messages, allLeads, af, forcedFilters);
      if (typeof res === "string") {
        const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: res } }] })}\n\ndata: [DONE]\n\n`;
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

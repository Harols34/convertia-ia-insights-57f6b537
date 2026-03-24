import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═════════════════════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ═════════════════════════════════════════════════════════════════════════════
type Stat = { leads: number; ventas: number; conv: string };
type Dict<T> = Record<string, T>;

const DIAS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function statLine(l: number, v: number): Stat {
  return { leads: l, ventas: v, conv: l > 0 ? ((v / l) * 100).toFixed(1) + "%" : "0.0%" };
}

function val(r: any, key: string): string {
  if (key === "hora_creacion") return deriveHour(r.fch_creacion);
  if (key === "hora_negocio") return deriveHour(r.fch_negocio);
  if (key === "dia_semana") return deriveDay(r.fch_creacion);
  if (key === "fecha") return deriveDate(r.fch_creacion);
  if (key === "tramo_horario") return deriveTramo(r.fch_creacion);
  return String(r[key] ?? "").trim();
}

function deriveHour(ts: string | null): string {
  if (!ts) return "";
  try {
    return String(new Date(ts).getHours()).padStart(2, "0") + ":00";
  } catch {
    return "";
  }
}
function deriveDay(ts: string | null): string {
  if (!ts) return "";
  try {
    return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][new Date(ts).getDay()];
  } catch {
    return "";
  }
}
function deriveDate(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toISOString().split("T")[0];
  } catch {
    return "";
  }
}
function deriveTramo(ts: string | null): string {
  if (!ts) return "";
  try {
    const h = new Date(ts).getHours();
    if (h >= 8 && h < 12) return "Mañana (08-12)";
    if (h >= 12 && h < 15) return "Mediodía (12-15)";
    if (h >= 15 && h < 19) return "Tarde (15-19)";
    if (h >= 19 && h < 23) return "Noche (19-23)";
    return "Madrugada (00-08)";
  } catch {
    return "";
  }
}

function crossTab1D(leads: any[], ventas: any[], key: string): Dict<Stat> {
  const lm: Dict<number> = {},
    vm: Dict<number> = {};
  leads.forEach((r) => {
    const k = val(r, key);
    if (k) lm[k] = (lm[k] || 0) + 1;
  });
  ventas.forEach((r) => {
    const k = val(r, key);
    if (k) vm[k] = (vm[k] || 0) + 1;
  });
  const keys = new Set([...Object.keys(lm), ...Object.keys(vm)]);
  const out: Dict<Stat> = {};
  keys.forEach((k) => (out[k] = statLine(lm[k] || 0, vm[k] || 0)));
  if (key === "hora_creacion" || key === "hora_negocio")
    return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
  if (key === "dia_semana")
    return Object.fromEntries(Object.entries(out).sort((a, b) => DIAS_ORDER.indexOf(a[0]) - DIAS_ORDER.indexOf(b[0])));
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1].leads - a[1].leads));
}

function crossTab2D(leads: any[], ventas: any[], key1: string, key2: string, topN = 20): Dict<Dict<Stat>> {
  const acc: Dict<Dict<{ l: number; v: number }>> = {};
  const push = (rows: any[], isV: boolean) =>
    rows.forEach((r) => {
      const k1 = val(r, key1),
        k2 = val(r, key2);
      if (!k1 || !k2) return;
      if (!acc[k1]) acc[k1] = {};
      if (!acc[k1][k2]) acc[k1][k2] = { l: 0, v: 0 };
      if (isV) acc[k1][k2].v++;
      else acc[k1][k2].l++;
    });
  push(leads, false);
  push(ventas, true);
  const totals: Dict<number> = {};
  Object.entries(acc).forEach(([k1, inner]) => (totals[k1] = Object.values(inner).reduce((s, x) => s + x.l, 0)));
  const out: Dict<Dict<Stat>> = {};
  Object.entries(acc)
    .sort((a, b) => (totals[b[0]] || 0) - (totals[a[0]] || 0))
    .slice(0, topN)
    .forEach(([k1, inner]) => {
      out[k1] = {};
      let entries = Object.entries(inner)
        .sort((a, b) => b[1].l - a[1].l)
        .slice(0, topN);
      if (key2 === "hora_creacion" || key2 === "hora_negocio")
        entries = entries.sort((a, b) => a[0].localeCompare(b[0]));
      else if (key2 === "dia_semana")
        entries = entries.sort((a, b) => DIAS_ORDER.indexOf(a[0]) - DIAS_ORDER.indexOf(b[0]));
      entries.forEach(([k2, { l, v }]) => (out[k1][k2] = statLine(l, v)));
    });
  return out;
}

function calcResponseMetrics(leads: any[]) {
  const tiempos: number[] = [];
  let sinGestion = 0,
    conGestion = 0;
  const tByAgente: Dict<number[]> = {},
    tByCampana: Dict<number[]> = {};
  leads.forEach((r) => {
    const created = r.fch_creacion ? new Date(r.fch_creacion).getTime() : null;
    const firstMgmt = r.fch_prim_gestion ? new Date(r.fch_prim_gestion).getTime() : null;
    if (!firstMgmt) {
      sinGestion++;
      return;
    }
    conGestion++;
    if (created && firstMgmt > created) {
      const min = Math.round((firstMgmt - created) / 60000);
      if (min < 1440) {
        tiempos.push(min);
        const ag = r.agente_prim_gestion || "";
        if (ag) {
          if (!tByAgente[ag]) tByAgente[ag] = [];
          tByAgente[ag].push(min);
        }
        const cp = r.campana_mkt || "";
        if (cp) {
          if (!tByCampana[cp]) tByCampana[cp] = [];
          tByCampana[cp].push(min);
        }
      }
    }
  });
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null);
  const med = (a: number[]) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  const tS = [...tiempos].sort((a, b) => a - b);
  const agStat: Dict<any> = {};
  Object.entries(tByAgente).forEach(
    ([ag, arr]) => (agStat[ag] = { avg_min: avg(arr), median_min: med(arr), n: arr.length }),
  );
  const cpStat: Dict<any> = {};
  Object.entries(tByCampana).forEach(
    ([cp, arr]) => (cpStat[cp] = { avg_min: avg(arr), median_min: med(arr), n: arr.length }),
  );
  return {
    sin_gestion: sinGestion,
    con_gestion: conGestion,
    tasa_contacto: leads.length > 0 ? ((conGestion / leads.length) * 100).toFixed(1) + "%" : "0%",
    tiempo_respuesta_global: {
      avg_minutos: avg(tiempos),
      mediana_minutos: med(tiempos),
      p90_minutos: tS[Math.floor(tS.length * 0.9)] ?? null,
      n: tiempos.length,
    },
    tiempo_respuesta_por_agente: Object.fromEntries(
      Object.entries(agStat).sort((a, b) => (a[1].avg_min ?? 999) - (b[1].avg_min ?? 999)),
    ),
    tiempo_respuesta_por_campana: Object.fromEntries(
      Object.entries(cpStat).sort((a, b) => (a[1].avg_min ?? 999) - (b[1].avg_min ?? 999)),
    ),
  };
}

function calcFunnel(leads: any[]) {
  const total = leads.length;
  const c1 = leads.filter((r) => r.fch_prim_gestion).length;
  const c2 = leads.filter((r) => r.fch_ultim_gestion).length;
  const c3 = leads.filter((r) => r.fch_negocio).length;
  const ventas = leads.filter((r) => r.es_venta === true).length;
  const primToNeg: Dict<Dict<number>> = {};
  leads.forEach((r) => {
    const p = r.result_prim_gestion || "Sin gestión",
      n = r.result_negocio || "Sin resultado";
    if (!primToNeg[p]) primToNeg[p] = {};
    primToNeg[p][n] = (primToNeg[p][n] || 0) + 1;
  });
  const abandonByHour: Dict<number> = {};
  leads
    .filter((r) => !r.fch_prim_gestion)
    .forEach((r) => {
      const h = deriveHour(r.fch_creacion);
      if (h) abandonByHour[h] = (abandonByHour[h] || 0) + 1;
    });
  return {
    etapas: {
      total_leads: total,
      con_primera_gestion: c1,
      con_ultima_gestion: c2,
      con_negocio: c3,
      ventas,
      tasa_contacto: total > 0 ? ((c1 / total) * 100).toFixed(1) + "%" : "0%",
      tasa_negocio: total > 0 ? ((c3 / total) * 100).toFixed(1) + "%" : "0%",
      tasa_conversion: total > 0 ? ((ventas / total) * 100).toFixed(1) + "%" : "0%",
    },
    resultado_prim_gestion_a_negocio: primToNeg,
    abandono_por_hora: Object.fromEntries(Object.entries(abandonByHour).sort()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERS
// ─────────────────────────────────────────────────────────────────────────────
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
  hora_desde?: number;
  hora_hasta?: number;
}

function applyFilters(leads: any[], f: Filters): any[] {
  if (!f || Object.keys(f).length === 0) return leads;
  return leads.filter((r) => {
    if (f.agente && r.agente_negocio !== f.agente) return false;
    if (f.campana_mkt && r.campana_mkt !== f.campana_mkt) return false;
    if (f.campana_inconcert && r.campana_inconcert !== f.campana_inconcert) return false;
    if (f.tipo_llamada && r.tipo_llamada !== f.tipo_llamada) return false;
    if (f.ciudad && r.ciudad !== f.ciudad) return false;
    if (f.categoria_mkt && r.categoria_mkt !== f.categoria_mkt) return false;
    if (f.bpo && r.bpo !== f.bpo) return false;
    if (f.result_negocio && r.result_negocio !== f.result_negocio) return false;
    if (f.es_venta !== undefined && r.es_venta !== f.es_venta) return false;
    if (f.fecha_desde || f.fecha_hasta) {
      const d = deriveDate(r.fch_creacion);
      if (f.fecha_desde && d < f.fecha_desde) return false;
      if (f.fecha_hasta && d > f.fecha_hasta) return false;
    }
    if (f.hora_desde !== undefined || f.hora_hasta !== undefined) {
      const h = r.fch_creacion ? new Date(r.fch_creacion).getHours() : -1;
      if (f.hora_desde !== undefined && h < f.hora_desde) return false;
      if (f.hora_hasta !== undefined && h > f.hora_hasta) return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildLeadsContext(leads: any[], activeFilters?: Filters): string {
  const ventas = leads.filter((r) => r.es_venta === true);
  const total = leads.length,
    nV = ventas.length;
  const convG = total > 0 ? ((nV / total) * 100).toFixed(2) : "0.00";

  const filterNote =
    activeFilters && Object.keys(activeFilters).length > 0
      ? `\n⚠️ FILTROS ACTIVOS: ${JSON.stringify(activeFilters)}\nEstos datos ya están filtrados.`
      : "";

  const d1 = {
    tipo_llamada: crossTab1D(leads, ventas, "tipo_llamada"),
    campana_inconcert: crossTab1D(leads, ventas, "campana_inconcert"),
    campana_mkt: crossTab1D(leads, ventas, "campana_mkt"),
    categoria_mkt: crossTab1D(leads, ventas, "categoria_mkt"),
    ciudad: crossTab1D(leads, ventas, "ciudad"),
    agente_negocio: crossTab1D(leads, ventas, "agente_negocio"),
    agente_prim_gestion: crossTab1D(leads, ventas, "agente_prim_gestion"),
    agente_ultim_gestion: crossTab1D(leads, ventas, "agente_ultim_gestion"),
    result_negocio: crossTab1D(leads, ventas, "result_negocio"),
    result_prim_gestion: crossTab1D(leads, ventas, "result_prim_gestion"),
    result_ultim_gestion: crossTab1D(leads, ventas, "result_ultim_gestion"),
    bpo: crossTab1D(leads, ventas, "bpo"),
    keyword: crossTab1D(leads, ventas, "keyword"),
    hora_creacion: crossTab1D(leads, ventas, "hora_creacion"),
    hora_negocio: crossTab1D(leads, ventas, "hora_negocio"),
    tramo_horario: crossTab1D(leads, ventas, "tramo_horario"),
    dia_semana: crossTab1D(leads, ventas, "dia_semana"),
    fecha: crossTab1D(leads, ventas, "fecha"),
  };

  const d2n = {
    agente_negocio_x_ciudad: crossTab2D(leads, ventas, "agente_negocio", "ciudad"),
    agente_negocio_x_tipo_llamada: crossTab2D(leads, ventas, "agente_negocio", "tipo_llamada"),
    agente_negocio_x_campana_mkt: crossTab2D(leads, ventas, "agente_negocio", "campana_mkt"),
    agente_negocio_x_campana_inconcert: crossTab2D(leads, ventas, "agente_negocio", "campana_inconcert"),
    agente_negocio_x_result_negocio: crossTab2D(leads, ventas, "agente_negocio", "result_negocio"),
    agente_negocio_x_categoria_mkt: crossTab2D(leads, ventas, "agente_negocio", "categoria_mkt"),
    campana_mkt_x_tipo_llamada: crossTab2D(leads, ventas, "campana_mkt", "tipo_llamada"),
    campana_mkt_x_ciudad: crossTab2D(leads, ventas, "campana_mkt", "ciudad"),
    campana_mkt_x_agente_negocio: crossTab2D(leads, ventas, "campana_mkt", "agente_negocio"),
    campana_mkt_x_result_negocio: crossTab2D(leads, ventas, "campana_mkt", "result_negocio"),
    campana_inconcert_x_tipo_llamada: crossTab2D(leads, ventas, "campana_inconcert", "tipo_llamada"),
    campana_inconcert_x_ciudad: crossTab2D(leads, ventas, "campana_inconcert", "ciudad"),
    campana_inconcert_x_agente_negocio: crossTab2D(leads, ventas, "campana_inconcert", "agente_negocio"),
    tipo_llamada_x_ciudad: crossTab2D(leads, ventas, "tipo_llamada", "ciudad"),
    tipo_llamada_x_campana_mkt: crossTab2D(leads, ventas, "tipo_llamada", "campana_mkt"),
    tipo_llamada_x_agente_negocio: crossTab2D(leads, ventas, "tipo_llamada", "agente_negocio"),
    tipo_llamada_x_result_negocio: crossTab2D(leads, ventas, "tipo_llamada", "result_negocio"),
    ciudad_x_campana_mkt: crossTab2D(leads, ventas, "ciudad", "campana_mkt"),
    ciudad_x_tipo_llamada: crossTab2D(leads, ventas, "ciudad", "tipo_llamada"),
    ciudad_x_agente_negocio: crossTab2D(leads, ventas, "ciudad", "agente_negocio"),
    result_negocio_x_agente_negocio: crossTab2D(leads, ventas, "result_negocio", "agente_negocio"),
    result_negocio_x_tipo_llamada: crossTab2D(leads, ventas, "result_negocio", "tipo_llamada"),
    result_negocio_x_campana_mkt: crossTab2D(leads, ventas, "result_negocio", "campana_mkt"),
    result_prim_x_result_negocio: crossTab2D(leads, ventas, "result_prim_gestion", "result_negocio"),
    bpo_x_agente_negocio: crossTab2D(leads, ventas, "bpo", "agente_negocio"),
    bpo_x_campana_mkt: crossTab2D(leads, ventas, "bpo", "campana_mkt"),
    bpo_x_tipo_llamada: crossTab2D(leads, ventas, "bpo", "tipo_llamada"),
    categoria_mkt_x_tipo_llamada: crossTab2D(leads, ventas, "categoria_mkt", "tipo_llamada"),
    categoria_mkt_x_campana_mkt: crossTab2D(leads, ventas, "categoria_mkt", "campana_mkt"),
    categoria_mkt_x_ciudad: crossTab2D(leads, ventas, "categoria_mkt", "ciudad"),
  };

  const d2h = {
    hora_x_tipo_llamada: crossTab2D(leads, ventas, "hora_creacion", "tipo_llamada"),
    hora_x_campana_mkt: crossTab2D(leads, ventas, "hora_creacion", "campana_mkt"),
    hora_x_campana_inconcert: crossTab2D(leads, ventas, "hora_creacion", "campana_inconcert"),
    hora_x_agente_negocio: crossTab2D(leads, ventas, "hora_creacion", "agente_negocio"),
    hora_x_ciudad: crossTab2D(leads, ventas, "hora_creacion", "ciudad"),
    hora_x_result_negocio: crossTab2D(leads, ventas, "hora_creacion", "result_negocio"),
    hora_x_categoria_mkt: crossTab2D(leads, ventas, "hora_creacion", "categoria_mkt"),
    agente_x_hora: crossTab2D(leads, ventas, "agente_negocio", "hora_creacion"),
    campana_mkt_x_hora: crossTab2D(leads, ventas, "campana_mkt", "hora_creacion"),
    tipo_llamada_x_hora: crossTab2D(leads, ventas, "tipo_llamada", "hora_creacion"),
    ciudad_x_hora: crossTab2D(leads, ventas, "ciudad", "hora_creacion"),
    categoria_x_hora: crossTab2D(leads, ventas, "categoria_mkt", "hora_creacion"),
    result_negocio_x_hora: crossTab2D(leads, ventas, "result_negocio", "hora_creacion"),
    tramo_x_tipo_llamada: crossTab2D(leads, ventas, "tramo_horario", "tipo_llamada"),
    tramo_x_campana_mkt: crossTab2D(leads, ventas, "tramo_horario", "campana_mkt"),
    tramo_x_agente_negocio: crossTab2D(leads, ventas, "tramo_horario", "agente_negocio"),
    tramo_x_ciudad: crossTab2D(leads, ventas, "tramo_horario", "ciudad"),
  };

  const d2d = {
    dia_x_tipo_llamada: crossTab2D(leads, ventas, "dia_semana", "tipo_llamada"),
    dia_x_campana_mkt: crossTab2D(leads, ventas, "dia_semana", "campana_mkt"),
    dia_x_agente_negocio: crossTab2D(leads, ventas, "dia_semana", "agente_negocio"),
    dia_x_ciudad: crossTab2D(leads, ventas, "dia_semana", "ciudad"),
    dia_x_result_negocio: crossTab2D(leads, ventas, "dia_semana", "result_negocio"),
    agente_x_dia: crossTab2D(leads, ventas, "agente_negocio", "dia_semana"),
    campana_mkt_x_dia: crossTab2D(leads, ventas, "campana_mkt", "dia_semana"),
    tipo_llamada_x_dia: crossTab2D(leads, ventas, "tipo_llamada", "dia_semana"),
  };

  const d2f = {
    fecha_x_tipo_llamada: crossTab2D(leads, ventas, "fecha", "tipo_llamada"),
    fecha_x_campana_mkt: crossTab2D(leads, ventas, "fecha", "campana_mkt"),
    fecha_x_agente_negocio: crossTab2D(leads, ventas, "fecha", "agente_negocio"),
    fecha_x_result_negocio: crossTab2D(leads, ventas, "fecha", "result_negocio"),
  };

  const responseMetrics = calcResponseMetrics(leads);
  const funnel = calcFunnel(leads);

  const agenteProductividad: Dict<any> = {};
  leads.forEach((r) => {
    const ag = r.agente_negocio || r.agente_prim_gestion || "";
    if (!ag) return;
    if (!agenteProductividad[ag]) agenteProductividad[ag] = { leads_gestionados: 0, ventas: 0, resultados: {} };
    agenteProductividad[ag].leads_gestionados++;
    if (r.es_venta) agenteProductividad[ag].ventas++;
    const res = r.result_negocio || "";
    if (res) agenteProductividad[ag].resultados[res] = (agenteProductividad[ag].resultados[res] || 0) + 1;
  });
  Object.values(agenteProductividad).forEach((a: any) => {
    a.conv = a.leads_gestionados > 0 ? ((a.ventas / a.leads_gestionados) * 100).toFixed(1) + "%" : "0%";
  });

  // Valores únicos para filtros / chart_picker
  const filterOptions = {
    agentes: [...new Set(leads.map((r) => r.agente_negocio).filter(Boolean))].sort(),
    campanas_mkt: [...new Set(leads.map((r) => r.campana_mkt).filter(Boolean))].sort(),
    campanas_inconcert: [...new Set(leads.map((r) => r.campana_inconcert).filter(Boolean))].sort(),
    tipos_llamada: [...new Set(leads.map((r) => r.tipo_llamada).filter(Boolean))].sort(),
    ciudades: [...new Set(leads.map((r) => r.ciudad).filter(Boolean))].sort(),
    categorias_mkt: [...new Set(leads.map((r) => r.categoria_mkt).filter(Boolean))].sort(),
    bpos: [...new Set(leads.map((r) => r.bpo).filter(Boolean))].sort(),
    resultados_negocio: [...new Set(leads.map((r) => r.result_negocio).filter(Boolean))].sort(),
    rango_fechas: {
      desde: Object.keys(d1.fecha).sort()[0] ?? null,
      hasta: Object.keys(d1.fecha).sort().at(-1) ?? null,
    },
  };

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS REALES — tabla LEADS  (${total} registros)${filterNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KPIs: leads=${total} | ventas=${nV} | no_ventas=${total - nV} | conv=${convG}%

VALORES DISPONIBLES PARA FILTROS Y CHART_PICKER:
${JSON.stringify(filterOptions)}

MAPEO PREGUNTAS → BLOQUES:
- por hora                     → [hora_creacion]
- por tramo                    → [tramo_horario]
- por día semana               → [dia_semana]
- agente X en qué ciudades     → [agente_negocio × ciudad]["X"]
- agente X por hora            → [agente_negocio × hora_creacion]["X"]
- campaña X por tipo llamada   → [campana_mkt × tipo_llamada]["X"]
- hora X qué campaña           → [hora_creacion × campana_mkt]["09:00"]
- velocidad respuesta          → métricas_velocidad
- funnel completo              → funnel_conversion.etapas
- productividad agente         → productividad_agentes["X"]
SIEMPRE extrae números exactos. NUNCA inventes.

═══ CROSS-TABS 1-D ═══
[tipo_llamada]
${JSON.stringify(d1.tipo_llamada)}
[campana_inconcert]
${JSON.stringify(d1.campana_inconcert)}
[campana_mkt]
${JSON.stringify(d1.campana_mkt)}
[categoria_mkt]
${JSON.stringify(d1.categoria_mkt)}
[ciudad]
${JSON.stringify(d1.ciudad)}
[agente_negocio]
${JSON.stringify(d1.agente_negocio)}
[agente_prim_gestion]
${JSON.stringify(d1.agente_prim_gestion)}
[agente_ultim_gestion]
${JSON.stringify(d1.agente_ultim_gestion)}
[result_negocio]
${JSON.stringify(d1.result_negocio)}
[result_prim_gestion]
${JSON.stringify(d1.result_prim_gestion)}
[result_ultim_gestion]
${JSON.stringify(d1.result_ultim_gestion)}
[bpo]
${JSON.stringify(d1.bpo)}
[keyword]
${JSON.stringify(d1.keyword)}
[hora_creacion]
${JSON.stringify(d1.hora_creacion)}
[hora_negocio]
${JSON.stringify(d1.hora_negocio)}
[tramo_horario]
${JSON.stringify(d1.tramo_horario)}
[dia_semana]
${JSON.stringify(d1.dia_semana)}
[fecha]
${JSON.stringify(d1.fecha)}

═══ PIVOTES 2-D NEGOCIO ═══
[agente_negocio × ciudad]
${JSON.stringify(d2n.agente_negocio_x_ciudad)}
[agente_negocio × tipo_llamada]
${JSON.stringify(d2n.agente_negocio_x_tipo_llamada)}
[agente_negocio × campana_mkt]
${JSON.stringify(d2n.agente_negocio_x_campana_mkt)}
[agente_negocio × campana_inconcert]
${JSON.stringify(d2n.agente_negocio_x_campana_inconcert)}
[agente_negocio × result_negocio]
${JSON.stringify(d2n.agente_negocio_x_result_negocio)}
[agente_negocio × categoria_mkt]
${JSON.stringify(d2n.agente_negocio_x_categoria_mkt)}
[campana_mkt × tipo_llamada]
${JSON.stringify(d2n.campana_mkt_x_tipo_llamada)}
[campana_mkt × ciudad]
${JSON.stringify(d2n.campana_mkt_x_ciudad)}
[campana_mkt × agente_negocio]
${JSON.stringify(d2n.campana_mkt_x_agente_negocio)}
[campana_mkt × result_negocio]
${JSON.stringify(d2n.campana_mkt_x_result_negocio)}
[campana_inconcert × tipo_llamada]
${JSON.stringify(d2n.campana_inconcert_x_tipo_llamada)}
[campana_inconcert × ciudad]
${JSON.stringify(d2n.campana_inconcert_x_ciudad)}
[campana_inconcert × agente_negocio]
${JSON.stringify(d2n.campana_inconcert_x_agente_negocio)}
[tipo_llamada × ciudad]
${JSON.stringify(d2n.tipo_llamada_x_ciudad)}
[tipo_llamada × campana_mkt]
${JSON.stringify(d2n.tipo_llamada_x_campana_mkt)}
[tipo_llamada × agente_negocio]
${JSON.stringify(d2n.tipo_llamada_x_agente_negocio)}
[tipo_llamada × result_negocio]
${JSON.stringify(d2n.tipo_llamada_x_result_negocio)}
[ciudad × campana_mkt]
${JSON.stringify(d2n.ciudad_x_campana_mkt)}
[ciudad × tipo_llamada]
${JSON.stringify(d2n.ciudad_x_tipo_llamada)}
[ciudad × agente_negocio]
${JSON.stringify(d2n.ciudad_x_agente_negocio)}
[result_negocio × agente_negocio]
${JSON.stringify(d2n.result_negocio_x_agente_negocio)}
[result_negocio × tipo_llamada]
${JSON.stringify(d2n.result_negocio_x_tipo_llamada)}
[result_negocio × campana_mkt]
${JSON.stringify(d2n.result_negocio_x_campana_mkt)}
[result_prim_gestion → result_negocio]
${JSON.stringify(d2n.result_prim_x_result_negocio)}
[bpo × agente_negocio]
${JSON.stringify(d2n.bpo_x_agente_negocio)}
[bpo × campana_mkt]
${JSON.stringify(d2n.bpo_x_campana_mkt)}
[bpo × tipo_llamada]
${JSON.stringify(d2n.bpo_x_tipo_llamada)}
[categoria_mkt × tipo_llamada]
${JSON.stringify(d2n.categoria_mkt_x_tipo_llamada)}
[categoria_mkt × campana_mkt]
${JSON.stringify(d2n.categoria_mkt_x_campana_mkt)}
[categoria_mkt × ciudad]
${JSON.stringify(d2n.categoria_mkt_x_ciudad)}

═══ PIVOTES 2-D HORA ═══
[hora_creacion × tipo_llamada]
${JSON.stringify(d2h.hora_x_tipo_llamada)}
[hora_creacion × campana_mkt]
${JSON.stringify(d2h.hora_x_campana_mkt)}
[hora_creacion × campana_inconcert]
${JSON.stringify(d2h.hora_x_campana_inconcert)}
[hora_creacion × agente_negocio]
${JSON.stringify(d2h.hora_x_agente_negocio)}
[hora_creacion × ciudad]
${JSON.stringify(d2h.hora_x_ciudad)}
[hora_creacion × result_negocio]
${JSON.stringify(d2h.hora_x_result_negocio)}
[hora_creacion × categoria_mkt]
${JSON.stringify(d2h.hora_x_categoria_mkt)}
[agente_negocio × hora_creacion]
${JSON.stringify(d2h.agente_x_hora)}
[campana_mkt × hora_creacion]
${JSON.stringify(d2h.campana_mkt_x_hora)}
[tipo_llamada × hora_creacion]
${JSON.stringify(d2h.tipo_llamada_x_hora)}
[ciudad × hora_creacion]
${JSON.stringify(d2h.ciudad_x_hora)}
[categoria_mkt × hora_creacion]
${JSON.stringify(d2h.categoria_x_hora)}
[result_negocio × hora_creacion]
${JSON.stringify(d2h.result_negocio_x_hora)}
[tramo_horario × tipo_llamada]
${JSON.stringify(d2h.tramo_x_tipo_llamada)}
[tramo_horario × campana_mkt]
${JSON.stringify(d2h.tramo_x_campana_mkt)}
[tramo_horario × agente_negocio]
${JSON.stringify(d2h.tramo_x_agente_negocio)}
[tramo_horario × ciudad]
${JSON.stringify(d2h.tramo_x_ciudad)}

═══ PIVOTES 2-D DÍA SEMANA ═══
[dia_semana × tipo_llamada]
${JSON.stringify(d2d.dia_x_tipo_llamada)}
[dia_semana × campana_mkt]
${JSON.stringify(d2d.dia_x_campana_mkt)}
[dia_semana × agente_negocio]
${JSON.stringify(d2d.dia_x_agente_negocio)}
[dia_semana × ciudad]
${JSON.stringify(d2d.dia_x_ciudad)}
[dia_semana × result_negocio]
${JSON.stringify(d2d.dia_x_result_negocio)}
[agente_negocio × dia_semana]
${JSON.stringify(d2d.agente_x_dia)}
[campana_mkt × dia_semana]
${JSON.stringify(d2d.campana_mkt_x_dia)}
[tipo_llamada × dia_semana]
${JSON.stringify(d2d.tipo_llamada_x_dia)}

═══ PIVOTES 2-D FECHA ═══
[fecha × tipo_llamada]
${JSON.stringify(d2f.fecha_x_tipo_llamada)}
[fecha × campana_mkt]
${JSON.stringify(d2f.fecha_x_campana_mkt)}
[fecha × agente_negocio]
${JSON.stringify(d2f.fecha_x_agente_negocio)}
[fecha × result_negocio]
${JSON.stringify(d2f.fecha_x_result_negocio)}

═══ MÉTRICAS DE VELOCIDAD Y CONTACTO ═══
${JSON.stringify(responseMetrics, null, 2)}

═══ FUNNEL DE CONVERSIÓN ═══
${JSON.stringify(funnel, null, 2)}

═══ PRODUCTIVIDAD POR AGENTE ═══
${JSON.stringify(agenteProductividad, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═════════════════════════════════════════════════════════════════════════════

const ANALYTICS_SYSTEM = `Eres un asistente analítico BI senior de Converti-IA Analytics.
Responde a supervisores, coordinadores, jefes de operación, gerentes, directores y CEO.

REGLAS:
1. Solo datos del contexto. NUNCA inventes cifras.
2. Para preguntas de 1 dimensión → CROSS-TABS 1-D.
3. Para 2 dimensiones → PIVOTE 2-D correcto.
4. Temporales: hora→hora_creacion, tramo→tramo_horario, día→dia_semana, tendencia→fecha.
5. Velocidad → MÉTRICAS DE VELOCIDAD. Funnel → FUNNEL. Productividad → PRODUCTIVIDAD.
6. Si el usuario corrige un número, acéptalo.
7. Responde en español con markdown (tablas cuando el dato sea tabular).`;

// ─────────────────────────────────────────────────────────────────────────────
// DASHDINAMICS SYSTEM — incluye chart_picker, tooltip fix, filtros
// ─────────────────────────────────────────────────────────────────────────────
const DASHDINAMICS_SYSTEM = `Eres el motor de inteligencia de DashDinamics.
Responde SIEMPRE con un único objeto JSON válido. Sin texto fuera del JSON.

════════════════════════════════════════════════
REGLAS DE DATOS (CRÍTICO)
════════════════════════════════════════════════
1. Solo números del contexto. NUNCA inventes.
2. 1 dimensión  → CROSS-TABS 1-D del bloque [nombre]
3. 2 dimensiones → PIVOTES 2-D del bloque [dim1 × dim2]
4. Temporal      → hora_creacion / tramo_horario / dia_semana / fecha
5. Conv(%)       = campo "conv" del cross-tab. No recalcular.
6. Eje X horas   → ordenar 00:00→23:00 SIEMPRE.
7. Eje X días    → ordenar Lunes→Domingo SIEMPRE.

════════════════════════════════════════════════
REGLAS DE ECHARTS — TOOLTIP (CRÍTICO)
════════════════════════════════════════════════
TODOS los charts DEBEN tener esta estructura de tooltip para que funcione el hover:

Para charts de 1 serie (bar, line, pie):
"tooltip": {
  "trigger": "axis",
  "axisPointer": { "type": "shadow" }
}

Para charts con 2 ejes Y (combo leads+ventas+efectividad):
"tooltip": {
  "trigger": "axis",
  "axisPointer": { "type": "cross", "crossStyle": { "color": "#999" } }
}

SIEMPRE nombrar las series con "name" para que el tooltip muestre la leyenda:
{ "name": "Leads", "type": "bar", ... }
{ "name": "Ventas", "type": "bar", ... }
{ "name": "Efectividad (%)", "type": "line", "yAxisIndex": 1, ... }

SIEMPRE incluir "legend" con los nombres de las series:
"legend": { "data": ["Leads", "Ventas", "Efectividad (%)"], "bottom": 0 }

Para ejes duales SIEMPRE usar:
"yAxis": [
  { "type": "value", "name": "Cantidad", "axisLabel": { "color": "#aaa" } },
  { "type": "value", "name": "Efectividad (%)", "axisLabel": { "color": "#aaa", "formatter": "{value}%" }, "splitLine": { "show": false } }
]

════════════════════════════════════════════════
MODOS DE RESPUESTA
════════════════════════════════════════════════
response_mode puede ser:
  "dashboard"    → genera el dashboard con datos reales
  "chart_picker" → muestra opciones de tipo de gráfico al usuario
  "clarification"→ pide info que falta
  "recommendation"→ sugiere qué análisis hacer
  "filter_result" → re-genera el dashboard con filtros aplicados

════════════════════════════════════════════════
CUÁNDO USAR CHART_PICKER
════════════════════════════════════════════════
Usa chart_picker cuando:
- El usuario pide "dame opciones de gráficos", "qué tipo de gráfico recomiendas", "cómo visualizo X"
- El usuario pide el dashboard pero NO especifica el tipo de gráfico
- La solicitud tiene múltiples formas válidas de visualizar

En chart_picker:
- Analiza el tipo de datos (temporal, categórico, comparativo, proporcional, etc.)
- Ofrece 3-5 opciones de chart type relevantes para ESE análisis específico
- Explica en 1 línea cuándo usar cada uno
- Incluye un preview_config simplificado para que el frontend muestre una miniatura
- El usuario elige y envía su elección → ENTONCES genera el dashboard completo

════════════════════════════════════════════════
CUÁNDO USAR FILTER_RESULT
════════════════════════════════════════════════
Usa filter_result cuando el usuario aplique filtros:
- "muéstrame solo el agente X"
- "filtra por la campaña WOM_14"
- "solo datos de Santiago"
- "entre las 9 y las 17"
- "solo ventas / solo no-ventas"
El campo "applied_filters" debe contener los filtros reconocidos.
El campo "filter_options" debe contener todos los valores disponibles para filtrar.

════════════════════════════════════════════════
ESTRUCTURA JSON COMPLETA
════════════════════════════════════════════════

MODO dashboard:
{
  "response_mode": "dashboard",
  "assistant_message": "Resumen ejecutivo 1-2 oraciones",
  "decision_goal": "string",
  "applied_filters": {},
  "filter_options": { ...valores disponibles del contexto... },
  "dashboard": {
    "title": "...", "subtitle": "...", "time_range": "...",
    "kpis": [{ "label":"...","value":"...","change":"...","trend":"up|down|neutral","icon":"TrendingUp|Users|Target|DollarSign|BarChart|Activity" }],
    "charts": [{
      "id": "...",
      "title": "...",
      "type": "bar|line|pie|area|horizontalBar|donut|stackedBar|combo",
      "config": {
        "tooltip": { "trigger":"axis", "axisPointer":{"type":"cross"} },
        "legend": { "data":["Serie1","Serie2"], "bottom":0 },
        "xAxis": [{ "type":"category", "data":[...], "axisLabel":{"color":"#aaa"} }],
        "yAxis": [
          { "type":"value", "name":"Cantidad", "axisLabel":{"color":"#aaa"} },
          { "type":"value", "name":"Efectividad (%)", "axisLabel":{"color":"#aaa","formatter":"{value}%"}, "splitLine":{"show":false} }
        ],
        "series": [
          { "name":"Leads",          "type":"bar",  "data":[...], "yAxisIndex":0, "itemStyle":{"color":"#3498db"} },
          { "name":"Ventas",         "type":"bar",  "data":[...], "yAxisIndex":0, "itemStyle":{"color":"#2ecc71"} },
          { "name":"Efectividad (%)", "type":"line", "data":[...], "yAxisIndex":1, "smooth":true, "itemStyle":{"color":"#e74c3c"}, "symbol":"circle", "symbolSize":6 }
        ]
      }
    }],
    "insights": [{ "type":"success|warning|info|alert", "title":"...", "description":"..." }],
    "recommended_next_steps": ["..."],
    "tables": [{ "title":"...", "headers":["..."], "rows":[["..."]] }]
  }
}

MODO chart_picker:
{
  "response_mode": "chart_picker",
  "assistant_message": "Para analizar [tema] tengo estas opciones de visualización:",
  "decision_goal": "...",
  "analysis_context": {
    "dimension": "hora_creacion",
    "metrics": ["leads","ventas","conv"],
    "data_type": "temporal_series"
  },
  "chart_options": [
    {
      "id": "combo_bar_line",
      "name": "Barras + Línea (recomendado)",
      "description": "Barras para leads y ventas (eje izquierdo), línea para efectividad % (eje derecho). Ideal para ver volumen y calidad al mismo tiempo.",
      "best_for": "Comparar cantidad vs conversión en el mismo gráfico",
      "preview_config": {
        "type": "combo",
        "series_names": ["Leads","Ventas","Efectividad (%)"],
        "colors": ["#3498db","#2ecc71","#e74c3c"]
      }
    },
    {
      "id": "stacked_bar",
      "name": "Barras apiladas",
      "description": "Cada barra muestra el total de leads, dividido entre ventas (verde) y no-ventas (gris). Fácil ver proporción.",
      "best_for": "Ver qué parte del volumen convierte",
      "preview_config": { "type": "stackedBar", "series_names": ["Ventas","No ventas"], "colors": ["#2ecc71","#bdc3c7"] }
    },
    {
      "id": "area_line",
      "name": "Área con línea",
      "description": "Área rellena para leads, línea para ventas. Resalta el volumen y la tendencia.",
      "best_for": "Ver tendencia temporal con énfasis en el volumen",
      "preview_config": { "type": "area", "series_names": ["Leads","Ventas"], "colors": ["#3498db","#2ecc71"] }
    },
    {
      "id": "line_only",
      "name": "Solo líneas",
      "description": "Múltiples líneas para comparar series. Limpio y sin distracción visual.",
      "best_for": "Comparar tendencias cuando el volumen exacto importa menos",
      "preview_config": { "type": "line", "series_names": ["Leads","Ventas","Efectividad (%)"], "colors": ["#3498db","#2ecc71","#e74c3c"] }
    },
    {
      "id": "heatmap_table",
      "name": "Tabla de calor (tabla)",
      "description": "Tabla con filas=horas, colunas=métricas, celdas coloreadas por valor. Perfecta para supervisores.",
      "best_for": "Ver todos los datos exactos de un vistazo",
      "preview_config": { "type": "table", "series_names": ["Hora","Leads","Ventas","Conv%"], "colors": [] }
    }
  ],
  "instruction_for_user": "Elige el tipo de gráfico que prefieras y lo construyo con tus datos reales."
}

MODO clarification:
{
  "response_mode": "clarification",
  "assistant_message": "...",
  "decision_goal": null,
  "clarifying_questions": [{ "id":"q1","question":"...","type":"single_select","options":["..."] }]
}

MODO recommendation:
{
  "response_mode": "recommendation",
  "assistant_message": "...",
  "decision_goal": null,
  "recommendations": [{ "id":"r1","title":"...","description":"...","icon":"BarChart|TrendingUp|Target|Users|Activity","action_label":"Generar este dashboard" }]
}

MODO filter_result:
{
  "response_mode": "filter_result",
  "assistant_message": "Dashboard filtrado: [descripción de filtros aplicados]",
  "decision_goal": "...",
  "applied_filters": { "agente": "wom_bedi_age_0022" },
  "filter_options": { ...todos los valores disponibles para filtrar... },
  "dashboard": { ...igual que modo dashboard... }
}

════════════════════════════════════════════════
LÓGICA DE ROUTING
════════════════════════════════════════════════
- Usuario pide dashboard SIN especificar tipo gráfico → chart_picker
- Usuario pide dashboard Y especifica tipo → dashboard directo
- Usuario elige de chart_picker ("quiero barras", "la opción 1", etc.) → dashboard
- Usuario aplica filtro → filter_result
- Falta dimensión/período → clarification (máx 2 preguntas)
- Muy amplio → recommendation`;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await req.json();
    const { messages, mode, botId, webhookUrl } = body;
    // Filtros opcionales que el frontend puede enviar
    const activeFilters: Filters = body.filters ?? {};

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: user.id });

    // ── n8n webhook ─────────────────────────────────────────────────────────
    if (webhookUrl) {
      try {
        const lastMsg = messages[messages.length - 1]?.content || "";
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: lastMsg, chatInput: lastMsg, sessionId: botId || "default", tenantId }),
        });
        if (!resp.ok) throw new Error(`Webhook ${resp.status}`);
        const data = await resp.json();
        const reply =
          typeof data === "string"
            ? data
            : Array.isArray(data)
              ? data[0]?.output || data[0]?.response || JSON.stringify(data[0])
              : data.output || data.response || data.message || data.text || JSON.stringify(data);
        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("webhook fallback:", e);
      }
    }

    // ── System prompt ────────────────────────────────────────────────────────
    let systemPrompt = mode === "dashdinamics" ? DASHDINAMICS_SYSTEM : ANALYTICS_SYSTEM;
    if (botId) {
      const { data: bot } = await adminClient.from("bots").select("system_prompt").eq("id", botId).single();
      if (bot?.system_prompt) systemPrompt = bot.system_prompt;
    }

    // ── Cargar y filtrar datos ───────────────────────────────────────────────
    if (tenantId) {
      const { data: rawLeads, error: leadsErr } = await adminClient
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(5000);

      if (!leadsErr && rawLeads?.length) {
        // Aplicar filtros server-side si vienen en el body
        const filteredLeads = applyFilters(rawLeads, activeFilters);
        const nV = filteredLeads.filter((r: any) => r.es_venta).length;

        systemPrompt += "\n\n" + buildLeadsContext(filteredLeads, activeFilters);
        systemPrompt += `\n\nCONFIRMACIÓN: ventas=${nV} leads=${filteredLeads.length}${Object.keys(activeFilters).length > 0 ? " (FILTRADOS)" : ""}.`;

        // Pasar también los filter_options al contexto para que el modelo los use en chart_picker/filter_result
        const allFilterOptions = {
          agentes: [...new Set(rawLeads.map((r: any) => r.agente_negocio).filter(Boolean))].sort(),
          campanas_mkt: [...new Set(rawLeads.map((r: any) => r.campana_mkt).filter(Boolean))].sort(),
          campanas_inconcert: [...new Set(rawLeads.map((r: any) => r.campana_inconcert).filter(Boolean))].sort(),
          tipos_llamada: [...new Set(rawLeads.map((r: any) => r.tipo_llamada).filter(Boolean))].sort(),
          ciudades: [...new Set(rawLeads.map((r: any) => r.ciudad).filter(Boolean))].sort(),
          categorias_mkt: [...new Set(rawLeads.map((r: any) => r.categoria_mkt).filter(Boolean))].sort(),
          bpos: [...new Set(rawLeads.map((r: any) => r.bpo).filter(Boolean))].sort(),
          resultados_negocio: [...new Set(rawLeads.map((r: any) => r.result_negocio).filter(Boolean))].sort(),
        };
        systemPrompt += `\n\nFILTER_OPTIONS_COMPLETOS (para incluir en filter_result/chart_picker):${JSON.stringify(allFilterOptions)}`;
      } else {
        systemPrompt += "\n\nNo hay datos de leads para este tenant aún.";
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY)
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── DashDinamics: JSON no-stream ─────────────────────────────────────────
    if (mode === "dashdinamics") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });
      if (!r.ok) {
        const s = r.status;
        if (s === 429)
          return new Response(JSON.stringify({ error: "Límite excedido" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (s === 402)
          return new Response(JSON.stringify({ error: "Créditos agotados" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        return new Response(JSON.stringify({ error: "Error IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const aiData = await r.json();
      const content = aiData.choices?.[0]?.message?.content || "{}";
      try {
        return new Response(JSON.stringify({ reply: JSON.parse(content) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(
          JSON.stringify({ reply: { response_mode: "dashboard", assistant_message: content, dashboard: null } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Analytics: stream ────────────────────────────────────────────────────
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        temperature: 0.2,
      }),
    });
    if (!r.ok) {
      const s = r.status;
      if (s === 429)
        return new Response(JSON.stringify({ error: "Límite excedido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (s === 402)
        return new Response(JSON.stringify({ error: "Créditos agotados" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: "Error IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

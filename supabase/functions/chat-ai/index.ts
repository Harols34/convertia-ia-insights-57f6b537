import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════
type Stat = { leads: number; ventas: number; conv: string };
type Dict<T> = Record<string, T>;

const DIAS_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function statLine(l: number, v: number): Stat {
  return { leads: l, ventas: v, conv: l > 0 ? ((v / l) * 100).toFixed(1) + "%" : "0.0%" };
}

// ═════════════════════════════════════════════════════════════════════════════
// DATE HELPERS — extrae directo del string, SIN conversión de zona horaria
// La BD ya guarda la hora correcta; no se suma ni resta nada.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Extrae "HH:00" directo del string timestamp.
 * "2026-03-19 16:20:56+00" → "16:00"
 * "2026-03-19T09:15:31+00:00" → "09:00"
 */
function deriveHour(ts: string | null): string {
  if (!ts) return "";
  try {
    const timePart = ts.replace("T", " ").split(" ")[1];
    const h = parseInt(timePart.split(":")[0], 10);
    return isNaN(h) ? "" : String(h).padStart(2, "0") + ":00";
  } catch {
    return "";
  }
}

/**
 * Extrae "YYYY-MM-DD" directo del string.
 * "2026-03-19 16:20:56+00" → "2026-03-19"
 */
function deriveDate(ts: string | null): string {
  if (!ts) return "";
  try {
    return ts.replace("T", " ").split(" ")[0];
  } catch {
    return "";
  }
}

/**
 * Día de semana usando la fecha del string sin conversión de zona.
 * Parsea "YYYY-MM-DD" como fecha local (T00:00:00 sin zona).
 */
function deriveDay(ts: string | null): string {
  if (!ts) return "";
  try {
    const datePart = ts.replace("T", " ").split(" ")[0];
    const d = new Date(datePart + "T00:00:00");
    return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d.getDay()];
  } catch {
    return "";
  }
}

/**
 * Tramo horario basado en la hora extraída del string.
 */
function deriveTramo(ts: string | null): string {
  const hStr = deriveHour(ts);
  if (!hStr) return "";
  const h = parseInt(hStr, 10);
  if (h >= 8 && h < 12) return "Mañana (08-12)";
  if (h >= 12 && h < 15) return "Mediodía (12-15)";
  if (h >= 15 && h < 19) return "Tarde (15-19)";
  if (h >= 19 && h < 23) return "Noche (19-23)";
  return "Madrugada (00-08)";
}

/**
 * Diferencia en minutos entre dos timestamps.
 * Aquí sí usamos Date() porque solo nos importa la diferencia, no la hora local.
 */
function diffMinutes(tsStart: string | null, tsEnd: string | null): number | null {
  if (!tsStart || !tsEnd) return null;
  try {
    const s = new Date(tsStart.replace(" ", "T")).getTime();
    const e = new Date(tsEnd.replace(" ", "T")).getTime();
    const min = Math.round((e - s) / 60000);
    return min >= 0 && min < 43200 ? min : null; // máx 30 días
  } catch {
    return null;
  }
}

/** Selector de campo derivado para cross-tabs */
function val(r: any, key: string): string {
  if (key === "hora_creacion") return deriveHour(r.fch_creacion);
  if (key === "hora_negocio") return deriveHour(r.fch_negocio);
  if (key === "dia_semana") return deriveDay(r.fch_creacion);
  if (key === "fecha") return deriveDate(r.fch_creacion);
  if (key === "fecha_negocio") return deriveDate(r.fch_negocio);
  if (key === "tramo_horario") return deriveTramo(r.fch_creacion);
  return String(r[key] ?? "").trim();
}

// ═════════════════════════════════════════════════════════════════════════════
// CROSS-TABS
// ═════════════════════════════════════════════════════════════════════════════
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
  // Orden especial para campos temporales
  if (key === "hora_creacion" || key === "hora_negocio")
    return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
  if (key === "dia_semana")
    return Object.fromEntries(Object.entries(out).sort((a, b) => DIAS_ORDER.indexOf(a[0]) - DIAS_ORDER.indexOf(b[0])));
  if (key === "fecha" || key === "fecha_negocio")
    return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
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
      else if (key2 === "fecha" || key2 === "fecha_negocio") entries = entries.sort((a, b) => a[0].localeCompare(b[0]));
      entries.forEach(([k2, { l, v }]) => (out[k1][k2] = statLine(l, v)));
    });
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// MÉTRICAS DE TIEMPO
// ═════════════════════════════════════════════════════════════════════════════
interface TimeStat {
  n: number;
  avg_min: number | null;
  med_min: number | null;
  p90_min: number | null;
  min_min: number | null;
  max_min: number | null;
}

function timeStat(arr: number[]): TimeStat {
  if (!arr.length) return { n: 0, avg_min: null, med_min: null, p90_min: null, min_min: null, max_min: null };
  const s = [...arr].sort((a, b) => a - b);
  return {
    n: arr.length,
    avg_min: Math.round(arr.reduce((x, y) => x + y, 0) / arr.length),
    med_min: s[Math.floor(s.length / 2)],
    p90_min: s[Math.floor(s.length * 0.9)],
    min_min: s[0],
    max_min: s[s.length - 1],
  };
}

function calcTimeMetrics(leads: any[]) {
  const tRespuesta: number[] = [];
  const tCiclo: number[] = [];
  const tEntreMgmt: number[] = [];
  const tCicloVenta: number[] = [];

  const byAgente: Dict<{ resp: number[]; ciclo: number[]; ciclo_venta: number[] }> = {};
  const byCampana: Dict<{ resp: number[]; ciclo: number[] }> = {};
  const byTipo: Dict<{ resp: number[]; ciclo: number[] }> = {};
  const byHoraResp: Dict<number[]> = {};

  let sinPrimGestion = 0,
    conGestion = 0,
    sinNegocio = 0;

  leads.forEach((r) => {
    const resp = diffMinutes(r.fch_creacion, r.fch_prim_gestion);
    const ciclo = diffMinutes(r.fch_creacion, r.fch_negocio);
    const entre = diffMinutes(r.fch_prim_gestion, r.fch_ultim_gestion);

    if (!r.fch_prim_gestion) {
      sinPrimGestion++;
    } else {
      conGestion++;
    }
    if (!r.fch_negocio) {
      sinNegocio++;
    }

    if (resp !== null) {
      tRespuesta.push(resp);
      const h = deriveHour(r.fch_creacion);
      if (h) {
        if (!byHoraResp[h]) byHoraResp[h] = [];
        byHoraResp[h].push(resp);
      }
    }
    if (ciclo !== null) {
      tCiclo.push(ciclo);
      if (r.es_venta === true) tCicloVenta.push(ciclo);
    }
    if (entre !== null) tEntreMgmt.push(entre);

    // Por agente
    const ag = r.agente_negocio || r.agente_prim_gestion || "";
    if (ag) {
      if (!byAgente[ag]) byAgente[ag] = { resp: [], ciclo: [], ciclo_venta: [] };
      if (resp !== null) byAgente[ag].resp.push(resp);
      if (ciclo !== null) {
        byAgente[ag].ciclo.push(ciclo);
        if (r.es_venta === true) byAgente[ag].ciclo_venta.push(ciclo);
      }
    }

    // Por campaña
    const cp = r.campana_mkt || "";
    if (cp) {
      if (!byCampana[cp]) byCampana[cp] = { resp: [], ciclo: [] };
      if (resp !== null) byCampana[cp].resp.push(resp);
      if (ciclo !== null) byCampana[cp].ciclo.push(ciclo);
    }

    // Por tipo llamada
    const tp = r.tipo_llamada || "";
    if (tp) {
      if (!byTipo[tp]) byTipo[tp] = { resp: [], ciclo: [] };
      if (resp !== null) byTipo[tp].resp.push(resp);
      if (ciclo !== null) byTipo[tp].ciclo.push(ciclo);
    }
  });

  // Tiempo de respuesta promedio por hora de creación
  const avgRespByHora: Dict<{ avg_min: number | null; n: number }> = {};
  Object.entries(byHoraResp)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([h, arr]) => {
      avgRespByHora[h] = {
        avg_min: arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null,
        n: arr.length,
      };
    });

  return {
    cobertura: {
      total: leads.length,
      con_primera_gestion: conGestion,
      sin_primera_gestion: sinPrimGestion,
      sin_negocio: sinNegocio,
      tasa_contacto: leads.length > 0 ? ((conGestion / leads.length) * 100).toFixed(1) + "%" : "0%",
    },
    tiempo_respuesta_global: {
      descripcion: "fch_prim_gestion - fch_creacion (minutos)",
      ...timeStat(tRespuesta),
    },
    tiempo_ciclo_global: {
      descripcion: "fch_negocio - fch_creacion (minutos)",
      ...timeStat(tCiclo),
    },
    tiempo_entre_gestiones_global: {
      descripcion: "fch_ultim_gestion - fch_prim_gestion (minutos)",
      ...timeStat(tEntreMgmt),
    },
    tiempo_ciclo_ventas: {
      descripcion: "fch_negocio - fch_creacion solo es_venta=true (minutos)",
      ...timeStat(tCicloVenta),
    },
    tiempo_respuesta_promedio_por_hora: avgRespByHora,
    tiempo_por_agente: Object.fromEntries(
      Object.entries(byAgente).map(([ag, { resp, ciclo, ciclo_venta }]) => [
        ag,
        {
          tiempo_respuesta: timeStat(resp),
          tiempo_ciclo: timeStat(ciclo),
          tiempo_ciclo_ventas: timeStat(ciclo_venta),
        },
      ]),
    ),
    tiempo_por_campana: Object.fromEntries(
      Object.entries(byCampana).map(([cp, { resp, ciclo }]) => [
        cp,
        {
          tiempo_respuesta: timeStat(resp),
          tiempo_ciclo: timeStat(ciclo),
        },
      ]),
    ),
    tiempo_por_tipo_llamada: Object.fromEntries(
      Object.entries(byTipo).map(([tp, { resp, ciclo }]) => [
        tp,
        {
          tiempo_respuesta: timeStat(resp),
          tiempo_ciclo: timeStat(ciclo),
        },
      ]),
    ),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNNEL
// ═════════════════════════════════════════════════════════════════════════════
function calcFunnel(leads: any[]) {
  const total = leads.length;
  const c1 = leads.filter((r) => r.fch_prim_gestion).length;
  const c2 = leads.filter((r) => r.fch_ultim_gestion).length;
  const c3 = leads.filter((r) => r.fch_negocio).length;
  const ventas = leads.filter((r) => r.es_venta === true).length;

  const primToNeg: Dict<Dict<number>> = {};
  leads.forEach((r) => {
    const p = r.result_prim_gestion || "Sin gestión";
    const n = r.result_negocio || "Sin resultado";
    if (!primToNeg[p]) primToNeg[p] = {};
    primToNeg[p][n] = (primToNeg[p][n] || 0) + 1;
  });

  const abandonByHora: Dict<number> = {};
  leads
    .filter((r) => !r.fch_prim_gestion)
    .forEach((r) => {
      const h = deriveHour(r.fch_creacion);
      if (h) abandonByHora[h] = (abandonByHora[h] || 0) + 1;
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
    primer_resultado_a_negocio: primToNeg,
    abandono_sin_gestion_por_hora: Object.fromEntries(Object.entries(abandonByHora).sort()),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PRODUCTIVIDAD
// ═════════════════════════════════════════════════════════════════════════════
function calcProductividad(leads: any[]) {
  const prod: Dict<any> = {};
  leads.forEach((r) => {
    const ag = r.agente_negocio || r.agente_prim_gestion || "";
    if (!ag) return;
    if (!prod[ag]) prod[ag] = { leads: 0, ventas: 0, resultados: {} };
    prod[ag].leads++;
    if (r.es_venta) prod[ag].ventas++;
    const res = r.result_negocio || "";
    if (res) prod[ag].resultados[res] = (prod[ag].resultados[res] || 0) + 1;
  });
  Object.values(prod).forEach((a: any) => {
    a.conv = a.leads > 0 ? ((a.ventas / a.leads) * 100).toFixed(1) + "%" : "0%";
  });
  return prod;
}

// ═════════════════════════════════════════════════════════════════════════════
// FILTERS
// ═════════════════════════════════════════════════════════════════════════════
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
      const hStr = deriveHour(r.fch_creacion);
      const h = hStr ? parseInt(hStr, 10) : -1;
      if (f.hora_desde !== undefined && h < f.hora_desde) return false;
      if (f.hora_hasta !== undefined && h > f.hora_hasta) return false;
    }
    return true;
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDER
// ═════════════════════════════════════════════════════════════════════════════
function buildLeadsContext(leads: any[], activeFilters?: Filters): string {
  const ventas = leads.filter((r) => r.es_venta === true);
  const total = leads.length;
  const nV = ventas.length;
  const convG = total > 0 ? ((nV / total) * 100).toFixed(2) : "0.00";

  const filterNote =
    activeFilters && Object.keys(activeFilters).length > 0
      ? `\n⚠️ FILTROS ACTIVOS: ${JSON.stringify(activeFilters)}\nDatos ya filtrados.`
      : "";

  // ── 1-D ──────────────────────────────────────────────────────────────────
  const d1 = {
    hora_creacion: crossTab1D(leads, ventas, "hora_creacion"),
    hora_negocio: crossTab1D(leads, ventas, "hora_negocio"),
    tramo_horario: crossTab1D(leads, ventas, "tramo_horario"),
    dia_semana: crossTab1D(leads, ventas, "dia_semana"),
    fecha: crossTab1D(leads, ventas, "fecha"),
    fecha_negocio: crossTab1D(leads, ventas, "fecha_negocio"),
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
  };

  // ── 2-D negocio ───────────────────────────────────────────────────────────
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

  // ── 2-D temporal ──────────────────────────────────────────────────────────
  const d2h = {
    hora_creacion_x_tipo_llamada: crossTab2D(leads, ventas, "hora_creacion", "tipo_llamada"),
    hora_creacion_x_campana_mkt: crossTab2D(leads, ventas, "hora_creacion", "campana_mkt"),
    hora_creacion_x_campana_inconcert: crossTab2D(leads, ventas, "hora_creacion", "campana_inconcert"),
    hora_creacion_x_agente_negocio: crossTab2D(leads, ventas, "hora_creacion", "agente_negocio"),
    hora_creacion_x_ciudad: crossTab2D(leads, ventas, "hora_creacion", "ciudad"),
    hora_creacion_x_result_negocio: crossTab2D(leads, ventas, "hora_creacion", "result_negocio"),
    hora_creacion_x_categoria_mkt: crossTab2D(leads, ventas, "hora_creacion", "categoria_mkt"),
    agente_negocio_x_hora_creacion: crossTab2D(leads, ventas, "agente_negocio", "hora_creacion"),
    campana_mkt_x_hora_creacion: crossTab2D(leads, ventas, "campana_mkt", "hora_creacion"),
    tipo_llamada_x_hora_creacion: crossTab2D(leads, ventas, "tipo_llamada", "hora_creacion"),
    ciudad_x_hora_creacion: crossTab2D(leads, ventas, "ciudad", "hora_creacion"),
    categoria_mkt_x_hora_creacion: crossTab2D(leads, ventas, "categoria_mkt", "hora_creacion"),
    result_negocio_x_hora_creacion: crossTab2D(leads, ventas, "result_negocio", "hora_creacion"),
    tramo_horario_x_tipo_llamada: crossTab2D(leads, ventas, "tramo_horario", "tipo_llamada"),
    tramo_horario_x_campana_mkt: crossTab2D(leads, ventas, "tramo_horario", "campana_mkt"),
    tramo_horario_x_agente_negocio: crossTab2D(leads, ventas, "tramo_horario", "agente_negocio"),
    tramo_horario_x_ciudad: crossTab2D(leads, ventas, "tramo_horario", "ciudad"),
    hora_negocio_x_agente_negocio: crossTab2D(leads, ventas, "hora_negocio", "agente_negocio"),
    hora_negocio_x_campana_mkt: crossTab2D(leads, ventas, "hora_negocio", "campana_mkt"),
    hora_negocio_x_tipo_llamada: crossTab2D(leads, ventas, "hora_negocio", "tipo_llamada"),
  };

  const d2d = {
    dia_semana_x_tipo_llamada: crossTab2D(leads, ventas, "dia_semana", "tipo_llamada"),
    dia_semana_x_campana_mkt: crossTab2D(leads, ventas, "dia_semana", "campana_mkt"),
    dia_semana_x_agente_negocio: crossTab2D(leads, ventas, "dia_semana", "agente_negocio"),
    dia_semana_x_ciudad: crossTab2D(leads, ventas, "dia_semana", "ciudad"),
    dia_semana_x_result_negocio: crossTab2D(leads, ventas, "dia_semana", "result_negocio"),
    agente_negocio_x_dia_semana: crossTab2D(leads, ventas, "agente_negocio", "dia_semana"),
    campana_mkt_x_dia_semana: crossTab2D(leads, ventas, "campana_mkt", "dia_semana"),
    tipo_llamada_x_dia_semana: crossTab2D(leads, ventas, "tipo_llamada", "dia_semana"),
  };

  const d2f = {
    fecha_x_tipo_llamada: crossTab2D(leads, ventas, "fecha", "tipo_llamada"),
    fecha_x_campana_mkt: crossTab2D(leads, ventas, "fecha", "campana_mkt"),
    fecha_x_agente_negocio: crossTab2D(leads, ventas, "fecha", "agente_negocio"),
    fecha_x_result_negocio: crossTab2D(leads, ventas, "fecha", "result_negocio"),
  };

  // ── Métricas avanzadas ────────────────────────────────────────────────────
  const timeMetrics = calcTimeMetrics(leads);
  const funnel = calcFunnel(leads);
  const productividad = calcProductividad(leads);

  // Valores disponibles para filtros
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

MODELO DE FECHAS:
- fch_creacion      = cuándo llegó el lead → BASE de todo análisis temporal
- fch_prim_gestion  = primer contacto del agente
- fch_ultim_gestion = última gestión realizada
- fch_negocio       = cuándo se cerró el negocio (venta o no)
- hora/dia/fecha se extraen directo del string de la BD sin conversión
- Tiempo respuesta  = fch_prim_gestion - fch_creacion (minutos)
- Tiempo ciclo      = fch_negocio      - fch_creacion (minutos)

VALORES PARA FILTROS:
${JSON.stringify(filterOptions)}

MAPEO PREGUNTAS → BLOQUES:
- leads/ventas por hora de llegada    → [hora_creacion] 1D
- ventas por hora que se cerraron     → [hora_negocio] 1D (campo ventas)
- por tramo                           → [tramo_horario] 1D
- por día semana                      → [dia_semana] 1D
- tendencia diaria                    → [fecha] 1D
- agente X en qué hora trabaja        → [agente_negocio × hora_creacion]["X"]
- agente X en qué ciudades vende      → [agente_negocio × ciudad]["X"]
- campaña X por tipo llamada          → [campana_mkt × tipo_llamada]["X"]
- hora X qué campaña genera           → [hora_creacion × campana_mkt]["HH:00"]
- tiempo de respuesta global          → metricas_tiempo.tiempo_respuesta_global
- tiempo respuesta por agente         → metricas_tiempo.tiempo_por_agente["X"].tiempo_respuesta
- tiempo ciclo por campaña            → metricas_tiempo.tiempo_por_campana["X"].tiempo_ciclo
- ciclo de ventas                     → metricas_tiempo.tiempo_ciclo_ventas
- funnel completo                     → funnel.etapas
- abandono sin gestión por hora       → funnel.abandono_sin_gestion_por_hora
- productividad agente                → productividad_agentes["X"]
SIEMPRE extrae números exactos del bloque. NUNCA inventes.

═══ CROSS-TABS 1-D  { valor: { leads, ventas, conv } } ═══

[hora_creacion]  ← hora extraída de fch_creacion tal cual está en BD
${JSON.stringify(d1.hora_creacion)}

[hora_negocio]  ← hora extraída de fch_negocio tal cual está en BD
${JSON.stringify(d1.hora_negocio)}

[tramo_horario]
${JSON.stringify(d1.tramo_horario)}

[dia_semana]
${JSON.stringify(d1.dia_semana)}

[fecha]
${JSON.stringify(d1.fecha)}

[fecha_negocio]
${JSON.stringify(d1.fecha_negocio)}

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

═══ PIVOTES 2-D — NEGOCIO × NEGOCIO ═══
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

═══ PIVOTES 2-D — HORA × DIMENSIONES ═══
[hora_creacion × tipo_llamada]
${JSON.stringify(d2h.hora_creacion_x_tipo_llamada)}
[hora_creacion × campana_mkt]
${JSON.stringify(d2h.hora_creacion_x_campana_mkt)}
[hora_creacion × campana_inconcert]
${JSON.stringify(d2h.hora_creacion_x_campana_inconcert)}
[hora_creacion × agente_negocio]
${JSON.stringify(d2h.hora_creacion_x_agente_negocio)}
[hora_creacion × ciudad]
${JSON.stringify(d2h.hora_creacion_x_ciudad)}
[hora_creacion × result_negocio]
${JSON.stringify(d2h.hora_creacion_x_result_negocio)}
[hora_creacion × categoria_mkt]
${JSON.stringify(d2h.hora_creacion_x_categoria_mkt)}
[agente_negocio × hora_creacion]
${JSON.stringify(d2h.agente_negocio_x_hora_creacion)}
[campana_mkt × hora_creacion]
${JSON.stringify(d2h.campana_mkt_x_hora_creacion)}
[tipo_llamada × hora_creacion]
${JSON.stringify(d2h.tipo_llamada_x_hora_creacion)}
[ciudad × hora_creacion]
${JSON.stringify(d2h.ciudad_x_hora_creacion)}
[categoria_mkt × hora_creacion]
${JSON.stringify(d2h.categoria_mkt_x_hora_creacion)}
[result_negocio × hora_creacion]
${JSON.stringify(d2h.result_negocio_x_hora_creacion)}
[tramo_horario × tipo_llamada]
${JSON.stringify(d2h.tramo_horario_x_tipo_llamada)}
[tramo_horario × campana_mkt]
${JSON.stringify(d2h.tramo_horario_x_campana_mkt)}
[tramo_horario × agente_negocio]
${JSON.stringify(d2h.tramo_horario_x_agente_negocio)}
[tramo_horario × ciudad]
${JSON.stringify(d2h.tramo_horario_x_ciudad)}
[hora_negocio × agente_negocio]
${JSON.stringify(d2h.hora_negocio_x_agente_negocio)}
[hora_negocio × campana_mkt]
${JSON.stringify(d2h.hora_negocio_x_campana_mkt)}
[hora_negocio × tipo_llamada]
${JSON.stringify(d2h.hora_negocio_x_tipo_llamada)}

═══ PIVOTES 2-D — DÍA SEMANA ═══
[dia_semana × tipo_llamada]
${JSON.stringify(d2d.dia_semana_x_tipo_llamada)}
[dia_semana × campana_mkt]
${JSON.stringify(d2d.dia_semana_x_campana_mkt)}
[dia_semana × agente_negocio]
${JSON.stringify(d2d.dia_semana_x_agente_negocio)}
[dia_semana × ciudad]
${JSON.stringify(d2d.dia_semana_x_ciudad)}
[dia_semana × result_negocio]
${JSON.stringify(d2d.dia_semana_x_result_negocio)}
[agente_negocio × dia_semana]
${JSON.stringify(d2d.agente_negocio_x_dia_semana)}
[campana_mkt × dia_semana]
${JSON.stringify(d2d.campana_mkt_x_dia_semana)}
[tipo_llamada × dia_semana]
${JSON.stringify(d2d.tipo_llamada_x_dia_semana)}

═══ PIVOTES 2-D — FECHA ═══
[fecha × tipo_llamada]
${JSON.stringify(d2f.fecha_x_tipo_llamada)}
[fecha × campana_mkt]
${JSON.stringify(d2f.fecha_x_campana_mkt)}
[fecha × agente_negocio]
${JSON.stringify(d2f.fecha_x_agente_negocio)}
[fecha × result_negocio]
${JSON.stringify(d2f.fecha_x_result_negocio)}

═══ MÉTRICAS DE TIEMPO (minutos) ═══
tiempo_respuesta  = fch_prim_gestion  - fch_creacion
tiempo_ciclo      = fch_negocio       - fch_creacion
tiempo_ciclo_venta= fch_negocio       - fch_creacion (solo es_venta=true)
entre_gestiones   = fch_ultim_gestion - fch_prim_gestion
campos: n, avg_min, med_min, p90_min, min_min, max_min
${JSON.stringify(timeMetrics, null, 2)}

═══ FUNNEL DE CONVERSIÓN ═══
${JSON.stringify(funnel, null, 2)}

═══ PRODUCTIVIDAD POR AGENTE ═══
${JSON.stringify(productividad, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═════════════════════════════════════════════════════════════════════════════
const ANALYTICS_SYSTEM = `Eres un asistente analítico BI senior de Converti-IA Analytics.

MODELO DE DATOS — FECHAS:
- fch_creacion      = cuándo llegó el lead → BASE de todo análisis temporal
- fch_prim_gestion  = primer contacto del agente
- fch_ultim_gestion = última gestión
- fch_negocio       = cierre del negocio (venta o no)
- hora/día/fecha se usan TAL CUAL están en la BD, sin conversión de zona
- Tiempo de respuesta = fch_prim_gestion - fch_creacion (minutos)
- Tiempo ciclo total  = fch_negocio - fch_creacion (minutos)

REGLAS:
1. Solo datos del contexto. NUNCA inventes cifras.
2. 1 dimensión → CROSS-TABS 1-D. 2 dimensiones → PIVOTE 2-D.
3. Tiempos → MÉTRICAS DE TIEMPO. Funnel → FUNNEL. Productividad → PRODUCTIVIDAD.
4. Para "¿cuánto tarda en responder el agente X?" → tiempo_por_agente["X"].tiempo_respuesta.avg_min
5. Para "¿cuánto dura el ciclo de una venta?" → tiempo_ciclo_ventas.avg_min
6. Si el usuario corrige un número, acéptalo.
7. Responde en español con markdown. Tablas para datos tabulares.`;

const DASHDINAMICS_SYSTEM = `Eres el motor de inteligencia de DashDinamics.
Responde SIEMPRE con un único objeto JSON válido. Sin texto fuera del JSON.

MODELO DE DATOS — FECHAS:
- fch_creacion  = base temporal → hora_creacion, dia_semana, fecha son de fch_creacion
- fch_negocio   = cierre        → hora_negocio, fecha_negocio son de fch_negocio
- Las horas están TAL CUAL en la BD, sin conversión de zona horaria
- Tiempo respuesta = fch_prim_gestion - fch_creacion
- Tiempo ciclo     = fch_negocio - fch_creacion

REGLAS CRÍTICAS DE DATOS:
1. Solo números del contexto. NUNCA inventes.
2. 1 dimensión  → CROSS-TABS 1-D bloque [nombre]
3. 2 dimensiones → PIVOTES 2-D bloque [dim1 × dim2]
4. Tiempos/velocidad → MÉTRICAS DE TIEMPO
5. Conv(%) = campo "conv". No recalcular.
6. Horas: eje X ordenado 00:00→23:00 SIEMPRE.
7. Días:  eje X ordenado Lunes→Domingo SIEMPRE.

REGLAS ECHARTS — TOOLTIP (CRÍTICO):
- SIEMPRE: "tooltip": { "trigger": "axis", "axisPointer": { "type": "cross", "crossStyle": { "color": "#999" } } }
- SIEMPRE: "legend": { "data": ["Leads","Ventas","Efectividad (%)"], "bottom": 0 }
- SIEMPRE nombrar series con "name"
- Eje dual: yAxis[0]=Cantidad, yAxis[1]=Efectividad(%)
- Serie efectividad: yAxisIndex:1, type:"line", smooth:true, symbol:"circle", symbolSize:6

MODOS: dashboard | chart_picker | clarification | recommendation | filter_result

CHART_PICKER — usar cuando el usuario NO especifica tipo de gráfico:
- Temporal (horas/días)         → combo barras+línea, área, líneas, tabla
- Categórico (agentes/campañas) → barras horizontales, barras verticales, donut
- Comparativo                   → barras agrupadas, stackedBar
- Tiempo/velocidad              → barras horizontales, scatter
Incluir 3-5 opciones con name, description, best_for, preview_config.

FILTER_RESULT — usar cuando apliquen filtros. Incluir applied_filters y filter_options.

ESTRUCTURA JSON:

dashboard / filter_result:
{
  "response_mode": "dashboard" | "filter_result",
  "assistant_message": "...",
  "decision_goal": "...",
  "applied_filters": {},
  "filter_options": { ...del contexto... },
  "dashboard": {
    "title": "...", "subtitle": "...", "time_range": "...",
    "kpis": [{ "label":"...","value":"...","change":"...","trend":"up|down|neutral","icon":"TrendingUp|Users|Target|DollarSign|BarChart|Activity" }],
    "charts": [{
      "id": "...", "title": "...", "type": "...",
      "config": {
        "tooltip": { "trigger":"axis","axisPointer":{"type":"cross","crossStyle":{"color":"#999"}} },
        "legend": { "data":["Leads","Ventas","Efectividad (%)"],"bottom":0 },
        "xAxis": [{ "type":"category","data":[...],"axisLabel":{"color":"#aaa"} }],
        "yAxis": [
          { "type":"value","name":"Cantidad","axisLabel":{"color":"#aaa"} },
          { "type":"value","name":"Efectividad (%)","axisLabel":{"color":"#aaa","formatter":"{value}%"},"splitLine":{"show":false} }
        ],
        "series": [
          { "name":"Leads",          "type":"bar",  "data":[...],"yAxisIndex":0,"itemStyle":{"color":"#3498db"} },
          { "name":"Ventas",         "type":"bar",  "data":[...],"yAxisIndex":0,"itemStyle":{"color":"#2ecc71"} },
          { "name":"Efectividad (%)", "type":"line","data":[...],"yAxisIndex":1,"smooth":true,"itemStyle":{"color":"#e74c3c"},"symbol":"circle","symbolSize":6 }
        ]
      }
    }],
    "insights": [{ "type":"success|warning|info|alert","title":"...","description":"..." }],
    "recommended_next_steps": ["..."],
    "tables": [{ "title":"...","headers":["..."],"rows":[["..."]] }]
  }
}

chart_picker:
{
  "response_mode": "chart_picker",
  "assistant_message": "...",
  "decision_goal": "...",
  "analysis_context": { "dimension":"...","metrics":["leads","ventas","conv"],"data_type":"temporal|categorical|comparative" },
  "chart_options": [{
    "id":"...", "name":"...", "description":"...", "best_for":"...",
    "preview_config": { "type":"...","series_names":["..."],"colors":["..."] }
  }],
  "instruction_for_user": "Elige el tipo de gráfico y lo construyo con tus datos reales."
}

clarification:
{ "response_mode":"clarification","assistant_message":"...","decision_goal":null,
  "clarifying_questions":[{"id":"q1","question":"...","type":"single_select","options":["..."]}] }

recommendation:
{ "response_mode":"recommendation","assistant_message":"...","decision_goal":null,
  "recommendations":[{"id":"r1","title":"...","description":"...","icon":"BarChart|TrendingUp|Target|Users|Activity","action_label":"Generar este dashboard"}] }

ROUTING:
- Sin tipo gráfico especificado          → chart_picker
- Con tipo gráfico O eligiendo opción    → dashboard
- Con filtros del usuario                → filter_result
- Falta dimensión/período               → clarification (máx 2 preguntas)
- Solicitud muy amplia                   → recommendation`;

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

    const body = await req.json();
    const { messages, mode, botId, webhookUrl } = body;
    const activeFilters: Filters = body.filters ?? {};

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: user.id });

    // ── n8n webhook ──────────────────────────────────────────────────────────
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

    // ── Cargar datos y aplicar filtros ───────────────────────────────────────
    if (tenantId) {
      const { data: rawLeads, error: leadsErr } = await adminClient
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(5000);

      if (!leadsErr && rawLeads?.length) {
        const filteredLeads = applyFilters(rawLeads, activeFilters);
        const nV = filteredLeads.filter((r: any) => r.es_venta).length;

        systemPrompt += "\n\n" + buildLeadsContext(filteredLeads, activeFilters);
        systemPrompt += `\n\nCONFIRMACIÓN: ventas=${nV} leads=${filteredLeads.length}${Object.keys(activeFilters).length > 0 ? " (FILTRADOS)" : ""}.`;

        // filter_options completos (sobre rawLeads para el dropdown)
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
        systemPrompt += `\n\nFILTER_OPTIONS_COMPLETOS:${JSON.stringify(allFilterOptions)}`;
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
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
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

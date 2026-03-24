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

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function statLine(leads: number, ventas: number): Stat {
  return { leads, ventas, conv: leads > 0 ? ((ventas / leads) * 100).toFixed(1) + "%" : "0.0%" };
}

/** 1-D cross-tab over any string key */
function crossTab1D(leads: any[], ventas: any[], key: string): Dict<Stat> {
  const lm: Dict<number> = {};
  const vm: Dict<number> = {};
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
  return sortByLeads(out);
}

/** 2-D pivot: { k1: { k2: Stat } } capped at topN per dimension */
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
      Object.entries(inner)
        .sort((a, b) => b[1].l - a[1].l)
        .slice(0, topN)
        .forEach(([k2, { l, v }]) => (out[k1][k2] = statLine(l, v)));
    });
  return out;
}

/** Extract a derived virtual field from a record */
function val(r: any, key: string): string {
  // Derived temporal keys
  if (key === "hora_creacion") return deriveHour(r.fch_creacion);
  if (key === "hora_negocio") return deriveHour(r.fch_negocio);
  if (key === "dia_semana") return deriveDay(r.fch_creacion);
  if (key === "fecha") return deriveDate(r.fch_creacion);
  if (key === "tramo_horario") return deriveTramo(r.fch_creacion);
  // Normal fields
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
    return DIAS[new Date(ts).getDay()];
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

function sortByLeads(m: Dict<Stat>): Dict<Stat> {
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1].leads - a[1].leads));
}

function countBy(arr: any[], key: string): Dict<number> {
  const m: Dict<number> = {};
  arr.forEach((r) => {
    const v = val(r, key);
    if (v) m[v] = (m[v] || 0) + 1;
  });
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiempo de respuesta / velocidad de contacto
// ─────────────────────────────────────────────────────────────────────────────
function calcResponseMetrics(leads: any[]) {
  const tiempos: number[] = [];
  let sinGestion = 0,
    conGestion = 0,
    conNegocio = 0;
  const tByAgente: Dict<number[]> = {};
  const tByCampana: Dict<number[]> = {};

  leads.forEach((r) => {
    const created = r.fch_creacion ? new Date(r.fch_creacion).getTime() : null;
    const firstMgmt = r.fch_prim_gestion ? new Date(r.fch_prim_gestion).getTime() : null;
    const negocio = r.fch_negocio ? new Date(r.fch_negocio).getTime() : null;

    if (!firstMgmt) {
      sinGestion++;
      return;
    }
    conGestion++;
    if (negocio) conNegocio++;

    if (created && firstMgmt && firstMgmt > created) {
      const min = Math.round((firstMgmt - created) / 60000);
      if (min < 1440) {
        // ignore >24h outliers
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

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const med = (arr: number[]) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const tSorted = [...tiempos].sort((a, b) => a - b);
  const p90 = tSorted[Math.floor(tSorted.length * 0.9)] ?? null;

  const agenteStats: Dict<{ avg_min: number | null; median_min: number | null; n: number }> = {};
  Object.entries(tByAgente).forEach(
    ([ag, arr]) => (agenteStats[ag] = { avg_min: avg(arr), median_min: med(arr), n: arr.length }),
  );

  const campanaStats: Dict<{ avg_min: number | null; median_min: number | null; n: number }> = {};
  Object.entries(tByCampana).forEach(
    ([cp, arr]) => (campanaStats[cp] = { avg_min: avg(arr), median_min: med(arr), n: arr.length }),
  );

  return {
    sin_gestion: sinGestion,
    con_gestion: conGestion,
    con_negocio: conNegocio,
    tasa_contacto: leads.length > 0 ? ((conGestion / leads.length) * 100).toFixed(1) + "%" : "0%",
    tiempo_respuesta_global: {
      avg_minutos: avg(tiempos),
      mediana_minutos: med(tiempos),
      p90_minutos: p90,
      n: tiempos.length,
    },
    tiempo_respuesta_por_agente: Object.fromEntries(
      Object.entries(agenteStats).sort((a, b) => (a[1].avg_min ?? 999) - (b[1].avg_min ?? 999)),
    ),
    tiempo_respuesta_por_campana: Object.fromEntries(
      Object.entries(campanaStats).sort((a, b) => (a[1].avg_min ?? 999) - (b[1].avg_min ?? 999)),
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funnel de resultados
// ─────────────────────────────────────────────────────────────────────────────
function calcFunnel(leads: any[]) {
  const total = leads.length;
  const conPrimGestion = leads.filter((r) => r.fch_prim_gestion).length;
  const conUltimGestion = leads.filter((r) => r.fch_ultim_gestion).length;
  const conNegocio = leads.filter((r) => r.fch_negocio).length;
  const ventas = leads.filter((r) => r.es_venta === true).length;

  // Prim resultado → resultado negocio
  const primToNegocio: Dict<Dict<number>> = {};
  leads.forEach((r) => {
    const p = r.result_prim_gestion || "Sin gestión";
    const n = r.result_negocio || "Sin resultado";
    if (!primToNegocio[p]) primToNegocio[p] = {};
    primToNegocio[p][n] = (primToNegocio[p][n] || 0) + 1;
  });

  // Abandono: leads sin ninguna gestión por hora de creación
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
      con_primera_gestion: conPrimGestion,
      con_ultima_gestion: conUltimGestion,
      con_negocio: conNegocio,
      ventas: ventas,
      tasa_contacto: total > 0 ? ((conPrimGestion / total) * 100).toFixed(1) + "%" : "0%",
      tasa_negocio: total > 0 ? ((conNegocio / total) * 100).toFixed(1) + "%" : "0%",
      tasa_conversion: total > 0 ? ((ventas / total) * 100).toFixed(1) + "%" : "0%",
    },
    resultado_prim_gestion_a_negocio: primToNegocio,
    abandono_por_hora: Object.fromEntries(Object.entries(abandonByHour).sort()),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDER PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
function buildLeadsContext(leads: any[]): string {
  const ventas = leads.filter((r) => r.es_venta === true);
  const total = leads.length;
  const nV = ventas.length;
  const convG = total > 0 ? ((nV / total) * 100).toFixed(2) : "0.00";

  // ── 1-D: dimensiones de negocio ─────────────────────────────────────────
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
    // Temporales 1D
    hora_creacion: crossTab1D(leads, ventas, "hora_creacion"),
    hora_negocio: crossTab1D(leads, ventas, "hora_negocio"),
    tramo_horario: crossTab1D(leads, ventas, "tramo_horario"),
    dia_semana: crossTab1D(leads, ventas, "dia_semana"),
    fecha: crossTab1D(leads, ventas, "fecha"),
  };

  // ── 2-D: pivotes negocio × negocio ──────────────────────────────────────
  const d2_negocio = {
    // Agente × todo
    agente_negocio_x_ciudad: crossTab2D(leads, ventas, "agente_negocio", "ciudad"),
    agente_negocio_x_tipo_llamada: crossTab2D(leads, ventas, "agente_negocio", "tipo_llamada"),
    agente_negocio_x_campana_mkt: crossTab2D(leads, ventas, "agente_negocio", "campana_mkt"),
    agente_negocio_x_campana_inconcert: crossTab2D(leads, ventas, "agente_negocio", "campana_inconcert"),
    agente_negocio_x_result_negocio: crossTab2D(leads, ventas, "agente_negocio", "result_negocio"),
    agente_negocio_x_categoria_mkt: crossTab2D(leads, ventas, "agente_negocio", "categoria_mkt"),

    // Campaña × todo
    campana_mkt_x_tipo_llamada: crossTab2D(leads, ventas, "campana_mkt", "tipo_llamada"),
    campana_mkt_x_ciudad: crossTab2D(leads, ventas, "campana_mkt", "ciudad"),
    campana_mkt_x_agente_negocio: crossTab2D(leads, ventas, "campana_mkt", "agente_negocio"),
    campana_mkt_x_result_negocio: crossTab2D(leads, ventas, "campana_mkt", "result_negocio"),
    campana_inconcert_x_tipo_llamada: crossTab2D(leads, ventas, "campana_inconcert", "tipo_llamada"),
    campana_inconcert_x_ciudad: crossTab2D(leads, ventas, "campana_inconcert", "ciudad"),
    campana_inconcert_x_agente_negocio: crossTab2D(leads, ventas, "campana_inconcert", "agente_negocio"),

    // Tipo llamada × todo
    tipo_llamada_x_ciudad: crossTab2D(leads, ventas, "tipo_llamada", "ciudad"),
    tipo_llamada_x_campana_mkt: crossTab2D(leads, ventas, "tipo_llamada", "campana_mkt"),
    tipo_llamada_x_agente_negocio: crossTab2D(leads, ventas, "tipo_llamada", "agente_negocio"),
    tipo_llamada_x_result_negocio: crossTab2D(leads, ventas, "tipo_llamada", "result_negocio"),

    // Ciudad × todo
    ciudad_x_campana_mkt: crossTab2D(leads, ventas, "ciudad", "campana_mkt"),
    ciudad_x_tipo_llamada: crossTab2D(leads, ventas, "ciudad", "tipo_llamada"),
    ciudad_x_agente_negocio: crossTab2D(leads, ventas, "ciudad", "agente_negocio"),

    // Resultado × todo
    result_negocio_x_agente_negocio: crossTab2D(leads, ventas, "result_negocio", "agente_negocio"),
    result_negocio_x_tipo_llamada: crossTab2D(leads, ventas, "result_negocio", "tipo_llamada"),
    result_negocio_x_campana_mkt: crossTab2D(leads, ventas, "result_negocio", "campana_mkt"),
    result_prim_x_result_negocio: crossTab2D(leads, ventas, "result_prim_gestion", "result_negocio"),

    // BPO × todo
    bpo_x_agente_negocio: crossTab2D(leads, ventas, "bpo", "agente_negocio"),
    bpo_x_campana_mkt: crossTab2D(leads, ventas, "bpo", "campana_mkt"),
    bpo_x_tipo_llamada: crossTab2D(leads, ventas, "bpo", "tipo_llamada"),

    // Categoría × todo
    categoria_mkt_x_tipo_llamada: crossTab2D(leads, ventas, "categoria_mkt", "tipo_llamada"),
    categoria_mkt_x_campana_mkt: crossTab2D(leads, ventas, "categoria_mkt", "campana_mkt"),
    categoria_mkt_x_ciudad: crossTab2D(leads, ventas, "categoria_mkt", "ciudad"),
  };

  // ── 2-D: pivotes HORA × dimensiones ─────────────────────────────────────
  const d2_hora = {
    // Hora creación × negocio
    hora_x_tipo_llamada: crossTab2D(leads, ventas, "hora_creacion", "tipo_llamada"),
    hora_x_campana_mkt: crossTab2D(leads, ventas, "hora_creacion", "campana_mkt"),
    hora_x_campana_inconcert: crossTab2D(leads, ventas, "hora_creacion", "campana_inconcert"),
    hora_x_agente_negocio: crossTab2D(leads, ventas, "hora_creacion", "agente_negocio"),
    hora_x_ciudad: crossTab2D(leads, ventas, "hora_creacion", "ciudad"),
    hora_x_result_negocio: crossTab2D(leads, ventas, "hora_creacion", "result_negocio"),
    hora_x_categoria_mkt: crossTab2D(leads, ventas, "hora_creacion", "categoria_mkt"),

    // Dimensión × hora (invertido — "¿en qué hora vende más el agente X?")
    agente_x_hora: crossTab2D(leads, ventas, "agente_negocio", "hora_creacion"),
    campana_mkt_x_hora: crossTab2D(leads, ventas, "campana_mkt", "hora_creacion"),
    tipo_llamada_x_hora: crossTab2D(leads, ventas, "tipo_llamada", "hora_creacion"),
    ciudad_x_hora: crossTab2D(leads, ventas, "ciudad", "hora_creacion"),
    categoria_x_hora: crossTab2D(leads, ventas, "categoria_mkt", "hora_creacion"),
    result_negocio_x_hora: crossTab2D(leads, ventas, "result_negocio", "hora_creacion"),

    // Tramo horario × dimensiones
    tramo_x_tipo_llamada: crossTab2D(leads, ventas, "tramo_horario", "tipo_llamada"),
    tramo_x_campana_mkt: crossTab2D(leads, ventas, "tramo_horario", "campana_mkt"),
    tramo_x_agente_negocio: crossTab2D(leads, ventas, "tramo_horario", "agente_negocio"),
    tramo_x_ciudad: crossTab2D(leads, ventas, "tramo_horario", "ciudad"),
  };

  // ── 2-D: pivotes DÍA SEMANA × dimensiones ────────────────────────────────
  const d2_dia = {
    dia_x_tipo_llamada: crossTab2D(leads, ventas, "dia_semana", "tipo_llamada"),
    dia_x_campana_mkt: crossTab2D(leads, ventas, "dia_semana", "campana_mkt"),
    dia_x_agente_negocio: crossTab2D(leads, ventas, "dia_semana", "agente_negocio"),
    dia_x_ciudad: crossTab2D(leads, ventas, "dia_semana", "ciudad"),
    dia_x_result_negocio: crossTab2D(leads, ventas, "dia_semana", "result_negocio"),

    agente_x_dia: crossTab2D(leads, ventas, "agente_negocio", "dia_semana"),
    campana_mkt_x_dia: crossTab2D(leads, ventas, "campana_mkt", "dia_semana"),
    tipo_llamada_x_dia: crossTab2D(leads, ventas, "tipo_llamada", "dia_semana"),
  };

  // ── 2-D: pivotes FECHA × dimensiones (tendencia temporal) ────────────────
  const d2_fecha = {
    fecha_x_tipo_llamada: crossTab2D(leads, ventas, "fecha", "tipo_llamada"),
    fecha_x_campana_mkt: crossTab2D(leads, ventas, "fecha", "campana_mkt"),
    fecha_x_agente_negocio: crossTab2D(leads, ventas, "fecha", "agente_negocio"),
    fecha_x_result_negocio: crossTab2D(leads, ventas, "fecha", "result_negocio"),
  };

  // ── Métricas avanzadas ───────────────────────────────────────────────────
  const responseMetrics = calcResponseMetrics(leads);
  const funnel = calcFunnel(leads);

  // ── Actividad por agente (métricas de productividad) ─────────────────────
  const agenteProductividad: Dict<any> = {};
  leads.forEach((r) => {
    const ag = r.agente_negocio || r.agente_prim_gestion || "";
    if (!ag) return;
    if (!agenteProductividad[ag]) {
      agenteProductividad[ag] = { leads_gestionados: 0, ventas: 0, resultados: {} };
    }
    agenteProductividad[ag].leads_gestionados++;
    if (r.es_venta) agenteProductividad[ag].ventas++;
    const res = r.result_negocio || "";
    if (res) agenteProductividad[ag].resultados[res] = (agenteProductividad[ag].resultados[res] || 0) + 1;
  });
  // Añadir conv%
  Object.values(agenteProductividad).forEach((a: any) => {
    a.conv = a.leads_gestionados > 0 ? ((a.ventas / a.leads_gestionados) * 100).toFixed(1) + "%" : "0%";
  });

  const HOW_TO_READ = `
CÓMO LEER ESTE CONTEXTO:
━ Cada bloque tiene el formato: { "valor": { leads, ventas, conv } }
━ Los PIVOTES 2-D tienen formato: { "dim1": { "dim2": { leads, ventas, conv } } }
━ Los campos TEMPORALES DERIVADOS son:
  - hora_creacion   → "09:00", "14:00" etc. (hora UTC del lead)
  - hora_negocio    → hora en que se registró el negocio/venta
  - tramo_horario   → "Mañana (08-12)", "Tarde (15-19)", etc.
  - dia_semana      → "Lunes", "Martes", etc.
  - fecha           → "2026-03-19"

MAPEO DE PREGUNTAS A BLOQUES:
━ "¿En qué hora se generan más leads?"          → 1D: hora_creacion
━ "¿En qué hora se vende más?"                  → 1D: hora_creacion (campo ventas)
━ "¿Qué tramo horario convierte mejor?"         → 1D: tramo_horario
━ "¿Qué día de la semana hay más leads?"        → 1D: dia_semana
━ "¿En qué hora vende más el agente X?"         → 2D: agente_x_hora["X"]
━ "¿Qué campaña funciona mejor de noche?"       → 2D: hora_x_campana_mkt["19:00"...]
━ "¿El agente X en qué ciudades vende?"         → 2D: agente_negocio_x_ciudad["X"]
━ "¿La campaña X en qué tipo de llamada mejor?" → 2D: campana_mkt_x_tipo_llamada["X"]
━ "¿Qué agentes tienen mejor tiempo de resp.?"  → métricas_velocidad.tiempo_respuesta_por_agente
━ "¿Cuántos leads no fueron gestionados?"       → métricas_velocidad.sin_gestion
━ "¿Cuál es el funnel completo?"                → funnel_conversion.etapas
━ "¿Qué primer resultado lleva a ventas?"       → funnel_conversion.resultado_prim_gestion_a_negocio
━ "¿A qué hora se abandonan más leads?"         → funnel_conversion.abandono_por_hora
━ "Productividad del agente X"                  → productividad_agentes["X"]
SIEMPRE extrae números exactos del bloque indicado. NUNCA inventes.`;

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATOS REALES — tabla LEADS  (${total} registros)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

=== KPIs GLOBALES ===
Total leads   : ${total}
Total ventas  : ${nV}
No ventas     : ${total - nV}
Conversión    : ${convG}%

${HOW_TO_READ}

═══════════════════════════════════════════════════════
CROSS-TABS 1-D  —  { valor: { leads, ventas, conv } }
═══════════════════════════════════════════════════════

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

── TEMPORALES 1-D ──

[hora_creacion]  ← todos los leads por hora
${JSON.stringify(d1.hora_creacion)}

[hora_negocio]  ← ventas confirmadas por hora en que se cerró el negocio
${JSON.stringify(d1.hora_negocio)}

[tramo_horario]
${JSON.stringify(d1.tramo_horario)}

[dia_semana]
${JSON.stringify(d1.dia_semana)}

[fecha]
${JSON.stringify(d1.fecha)}

═══════════════════════════════════════════════════════
PIVOTES 2-D — NEGOCIO × NEGOCIO
═══════════════════════════════════════════════════════

[agente_negocio × ciudad]
${JSON.stringify(d2_negocio.agente_negocio_x_ciudad)}

[agente_negocio × tipo_llamada]
${JSON.stringify(d2_negocio.agente_negocio_x_tipo_llamada)}

[agente_negocio × campana_mkt]
${JSON.stringify(d2_negocio.agente_negocio_x_campana_mkt)}

[agente_negocio × campana_inconcert]
${JSON.stringify(d2_negocio.agente_negocio_x_campana_inconcert)}

[agente_negocio × result_negocio]
${JSON.stringify(d2_negocio.agente_negocio_x_result_negocio)}

[agente_negocio × categoria_mkt]
${JSON.stringify(d2_negocio.agente_negocio_x_categoria_mkt)}

[campana_mkt × tipo_llamada]
${JSON.stringify(d2_negocio.campana_mkt_x_tipo_llamada)}

[campana_mkt × ciudad]
${JSON.stringify(d2_negocio.campana_mkt_x_ciudad)}

[campana_mkt × agente_negocio]
${JSON.stringify(d2_negocio.campana_mkt_x_agente_negocio)}

[campana_mkt × result_negocio]
${JSON.stringify(d2_negocio.campana_mkt_x_result_negocio)}

[campana_inconcert × tipo_llamada]
${JSON.stringify(d2_negocio.campana_inconcert_x_tipo_llamada)}

[campana_inconcert × ciudad]
${JSON.stringify(d2_negocio.campana_inconcert_x_ciudad)}

[campana_inconcert × agente_negocio]
${JSON.stringify(d2_negocio.campana_inconcert_x_agente_negocio)}

[tipo_llamada × ciudad]
${JSON.stringify(d2_negocio.tipo_llamada_x_ciudad)}

[tipo_llamada × campana_mkt]
${JSON.stringify(d2_negocio.tipo_llamada_x_campana_mkt)}

[tipo_llamada × agente_negocio]
${JSON.stringify(d2_negocio.tipo_llamada_x_agente_negocio)}

[tipo_llamada × result_negocio]
${JSON.stringify(d2_negocio.tipo_llamada_x_result_negocio)}

[ciudad × campana_mkt]
${JSON.stringify(d2_negocio.ciudad_x_campana_mkt)}

[ciudad × tipo_llamada]
${JSON.stringify(d2_negocio.ciudad_x_tipo_llamada)}

[ciudad × agente_negocio]
${JSON.stringify(d2_negocio.ciudad_x_agente_negocio)}

[result_negocio × agente_negocio]
${JSON.stringify(d2_negocio.result_negocio_x_agente_negocio)}

[result_negocio × tipo_llamada]
${JSON.stringify(d2_negocio.result_negocio_x_tipo_llamada)}

[result_negocio × campana_mkt]
${JSON.stringify(d2_negocio.result_negocio_x_campana_mkt)}

[result_prim_gestion → result_negocio]  ← qué primer resultado lleva a venta
${JSON.stringify(d2_negocio.result_prim_x_result_negocio)}

[bpo × agente_negocio]
${JSON.stringify(d2_negocio.bpo_x_agente_negocio)}

[bpo × campana_mkt]
${JSON.stringify(d2_negocio.bpo_x_campana_mkt)}

[bpo × tipo_llamada]
${JSON.stringify(d2_negocio.bpo_x_tipo_llamada)}

[categoria_mkt × tipo_llamada]
${JSON.stringify(d2_negocio.categoria_mkt_x_tipo_llamada)}

[categoria_mkt × campana_mkt]
${JSON.stringify(d2_negocio.categoria_mkt_x_campana_mkt)}

[categoria_mkt × ciudad]
${JSON.stringify(d2_negocio.categoria_mkt_x_ciudad)}

═══════════════════════════════════════════════════════
PIVOTES 2-D — HORA × DIMENSIONES
═══════════════════════════════════════════════════════

[hora_creacion × tipo_llamada]
${JSON.stringify(d2_hora.hora_x_tipo_llamada)}

[hora_creacion × campana_mkt]
${JSON.stringify(d2_hora.hora_x_campana_mkt)}

[hora_creacion × campana_inconcert]
${JSON.stringify(d2_hora.hora_x_campana_inconcert)}

[hora_creacion × agente_negocio]
${JSON.stringify(d2_hora.hora_x_agente_negocio)}

[hora_creacion × ciudad]
${JSON.stringify(d2_hora.hora_x_ciudad)}

[hora_creacion × result_negocio]
${JSON.stringify(d2_hora.hora_x_result_negocio)}

[hora_creacion × categoria_mkt]
${JSON.stringify(d2_hora.hora_x_categoria_mkt)}

[agente_negocio × hora_creacion]  ← en qué hora trabaja/vende cada agente
${JSON.stringify(d2_hora.agente_x_hora)}

[campana_mkt × hora_creacion]
${JSON.stringify(d2_hora.campana_mkt_x_hora)}

[tipo_llamada × hora_creacion]
${JSON.stringify(d2_hora.tipo_llamada_x_hora)}

[ciudad × hora_creacion]
${JSON.stringify(d2_hora.ciudad_x_hora)}

[categoria_mkt × hora_creacion]
${JSON.stringify(d2_hora.categoria_x_hora)}

[result_negocio × hora_creacion]
${JSON.stringify(d2_hora.result_negocio_x_hora)}

[tramo_horario × tipo_llamada]
${JSON.stringify(d2_hora.tramo_x_tipo_llamada)}

[tramo_horario × campana_mkt]
${JSON.stringify(d2_hora.tramo_x_campana_mkt)}

[tramo_horario × agente_negocio]
${JSON.stringify(d2_hora.tramo_x_agente_negocio)}

[tramo_horario × ciudad]
${JSON.stringify(d2_hora.tramo_x_ciudad)}

═══════════════════════════════════════════════════════
PIVOTES 2-D — DÍA SEMANA × DIMENSIONES
═══════════════════════════════════════════════════════

[dia_semana × tipo_llamada]
${JSON.stringify(d2_dia.dia_x_tipo_llamada)}

[dia_semana × campana_mkt]
${JSON.stringify(d2_dia.dia_x_campana_mkt)}

[dia_semana × agente_negocio]
${JSON.stringify(d2_dia.dia_x_agente_negocio)}

[dia_semana × ciudad]
${JSON.stringify(d2_dia.dia_x_ciudad)}

[dia_semana × result_negocio]
${JSON.stringify(d2_dia.dia_x_result_negocio)}

[agente_negocio × dia_semana]
${JSON.stringify(d2_dia.agente_x_dia)}

[campana_mkt × dia_semana]
${JSON.stringify(d2_dia.campana_mkt_x_dia)}

[tipo_llamada × dia_semana]
${JSON.stringify(d2_dia.tipo_llamada_x_dia)}

═══════════════════════════════════════════════════════
PIVOTES 2-D — FECHA × DIMENSIONES  (tendencia temporal)
═══════════════════════════════════════════════════════

[fecha × tipo_llamada]
${JSON.stringify(d2_fecha.fecha_x_tipo_llamada)}

[fecha × campana_mkt]
${JSON.stringify(d2_fecha.fecha_x_campana_mkt)}

[fecha × agente_negocio]
${JSON.stringify(d2_fecha.fecha_x_agente_negocio)}

[fecha × result_negocio]
${JSON.stringify(d2_fecha.fecha_x_result_negocio)}

═══════════════════════════════════════════════════════
MÉTRICAS DE VELOCIDAD Y CONTACTO
═══════════════════════════════════════════════════════
${JSON.stringify(responseMetrics, null, 2)}

═══════════════════════════════════════════════════════
FUNNEL DE CONVERSIÓN
═══════════════════════════════════════════════════════
${JSON.stringify(funnel, null, 2)}

═══════════════════════════════════════════════════════
PRODUCTIVIDAD POR AGENTE
(leads gestionados, ventas, conv%, desglose de resultados)
═══════════════════════════════════════════════════════
${JSON.stringify(agenteProductividad, null, 2)}

═══════════════════════════════════════════════════════
COLUMNAS DISPONIBLES
═══════════════════════════════════════════════════════
id, tenant_id, cliente, id_lead, id_llave,
campana_inconcert, campana_mkt, categoria_mkt, tipo_llamada,
fch_creacion, fch_prim_resultado_marcadora, prim_resultado_marcadora,
fch_prim_gestion, agente_prim_gestion, result_prim_gestion,
fch_ultim_gestion, agente_ultim_gestion, result_ultim_gestion,
fch_negocio, agente_negocio, result_negocio,
ciudad, email, keyword, bpo, created_at, updated_at, es_venta

CAMPOS DERIVADOS (no en BD, calculados aquí):
hora_creacion, hora_negocio, tramo_horario, dia_semana, fecha
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═════════════════════════════════════════════════════════════════════════════

const ANALYTICS_SYSTEM = `Eres un asistente analítico BI senior de Converti-IA Analytics.
Respondes a supervisores, coordinadores, jefes de operación, gerentes, directores y CEO.

REGLAS CRÍTICAS:
1. Usa ÚNICAMENTE datos del contexto. NUNCA inventes cifras.
2. venta = es_venta true. Conv = campo "conv" del cross-tab.
3. Para preguntas de UNA dimensión → usa CROSS-TABS 1-D.
4. Para preguntas que cruzan DOS dimensiones → usa el PIVOTE 2-D correcto.
5. Para preguntas TEMPORALES:
   - Por hora         → hora_creacion (1D) o [X × hora_creacion] (2D)
   - Por tramo        → tramo_horario
   - Por día semana   → dia_semana
   - Tendencia diaria → fecha
6. Para velocidad/tiempo de respuesta → MÉTRICAS DE VELOCIDAD.
7. Para funnel completo → FUNNEL DE CONVERSIÓN.
8. Para productividad individual → PRODUCTIVIDAD POR AGENTE.
9. Si el usuario corrige un número, acéptalo.
10. Responde en español con markdown. Incluye tablas cuando el dato sea tabular.

VOCABULARIO POR ROL (adapta el nivel de detalle):
- Supervisor/Coordinador → detalle por agente, hora, resultado específico
- Jefe de operación      → resúmenes por equipo, SLA, funnel, cobertura horaria
- Gerente/Director       → KPIs de campaña, ciudad, tendencias, conversión
- CEO                    → visión global, ROI, campañas top, oportunidades`;

const DASHDINAMICS_SYSTEM = `Eres el motor de inteligencia de DashDinamics.
Responde SIEMPRE con un único objeto JSON válido. Sin texto fuera del JSON.

REGLAS CRÍTICAS DE DATOS:
1. Usa ÚNICAMENTE números del contexto. NUNCA inventes.
2. Para cada gráfica localiza el bloque exacto:
   - Una dimensión   → CROSS-TABS 1-D del bloque [nombre]
   - Dos dimensiones → PIVOTES 2-D del bloque [dim1 × dim2]
   - Temporal 1D     → hora_creacion / tramo_horario / dia_semana / fecha
   - Temporal + otro → [agente_negocio × hora_creacion], [hora_creacion × campana_mkt], etc.
   - Velocidad       → MÉTRICAS DE VELOCIDAD Y CONTACTO
   - Funnel          → FUNNEL DE CONVERSIÓN
   - Productividad   → PRODUCTIVIDAD POR AGENTE
3. Para gráficas de hora: ordena el eje X de "00:00" a "23:00".
4. Para gráficas de día: ordena Lunes→Domingo.
5. Conv% = campo "conv" (ya calculado). No recalcules.
6. Para comparar leads vs ventas usa dos series. Para conv% usa eje Y secundario.
7. NUNCA uses datos de 0 si el bloque tiene valores reales.

ESTRUCTURA JSON OBLIGATORIA:
{
  "response_mode": "dashboard" | "clarification" | "recommendation",
  "assistant_message": "string breve",
  "decision_goal": "string o null",
  ...según el modo abajo
}

MODO dashboard:
{
  "response_mode": "dashboard",
  "assistant_message": "...",
  "decision_goal": "...",
  "dashboard": {
    "title": "...", "subtitle": "...", "time_range": "...",
    "kpis": [{ "label":"...","value":"...","change":"...","trend":"up|down|neutral","icon":"TrendingUp|Users|Target|DollarSign|BarChart|Activity" }],
    "charts": [{ "id":"...","title":"...","type":"bar|line|pie|area|horizontalBar|donut|stackedBar|combo","config":{...ECharts...} }],
    "insights": [{ "type":"success|warning|info|alert","title":"...","description":"..." }],
    "recommended_next_steps": ["..."],
    "tables": [{ "title":"...","headers":["..."],"rows":[["..."]] }]
  }
}

MODO clarification:
{
  "response_mode": "clarification", "assistant_message":"...", "decision_goal":null,
  "clarifying_questions":[{ "id":"q1","question":"...","type":"single_select","options":["..."] }]
}

MODO recommendation:
{
  "response_mode": "recommendation", "assistant_message":"...", "decision_goal":null,
  "recommendations":[{ "id":"r1","title":"...","description":"...","icon":"BarChart|TrendingUp|Target|Users|Activity","action_label":"Generar este dashboard" }]
}

REGLAS ECharts:
- Colores: ["#008080","#e74c3c","#f39c12","#3498db","#2ecc71","#9b59b6","#1abc9c","#e67e22"]
- Transparente siempre. Tooltip siempre.
- Ejes: axisLabel: { color:"#aaa" }
- Horas: eje X ordenado 00:00→23:00
- Días: eje X ordenado Lunes→Domingo
- Dos series (leads + ventas): stackedBar o combo
- Conversión (%): segunda serie con yAxisIndex:1, yAxis[1] type "value"
- Funnel: type "bar" horizontal con stages ordenados de mayor a menor
- Tiempo de respuesta: type "bar" por agente, valor avg_min

ROUTING:
- Dimensión/período claro → dashboard
- Falta info → clarification (máx 2 preguntas)
- Muy amplio → recommendation (2-4 opciones)`;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode, botId, dataSource, webhookUrl } = await req.json();

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: user.id });

    // ── n8n webhook ─────────────────────────────────────────────────────────
    if (webhookUrl) {
      try {
        const lastUserMsg = messages[messages.length - 1]?.content || "";
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: lastUserMsg,
            chatInput: lastUserMsg,
            sessionId: botId || "default",
            tenantId,
          }),
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

    // ── Inject data ──────────────────────────────────────────────────────────
    if (tenantId) {
      const { data: leadsData, error: leadsErr } = await adminClient
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(5000);
      if (!leadsErr && leadsData?.length) {
        const nV = leadsData.filter((r: any) => r.es_venta).length;
        systemPrompt += "\n\n" + buildLeadsContext(leadsData);
        systemPrompt += `\n\nCONFIRMACIÓN: ventas=${nV} leads=${leadsData.length}. Usa los pivotes. No inventes.`;
      } else {
        systemPrompt += "\n\nNo hay datos de leads para este tenant aún.";
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

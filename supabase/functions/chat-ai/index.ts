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
const DIM_DESC = `Dimensiones: agente_negocio, agente_prim_gestion, agente_ultim_gestion, campana_mkt, campana_inconcert, tipo_llamada, ciudad, categoria_mkt, result_negocio, result_prim_gestion, result_ultim_gestion, prim_resultado_marcadora, bpo, hora, hora_negocio, fecha, fecha_negocio, dia_semana, tramo_horario`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_kpis",
      description:
        "Totales y tasas en un rango: total_leads, ventas (es_venta), conversión/efectividad %, tiempos agregados. Fechas relativas (ayer, última semana, este mes) → convierte a fecha_desde/fecha_hasta YYYY-MM-DD en America/Santiago. Contactabilidad: si no viene en el resultado, calcúlala con agg_1d(dimension=prim_resultado_marcadora) y fórmula (CONNECTED+FINISHED)/total.",
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
      description: `Agregación 1D: leads, ventas y conversión por dimensión (${DIM_DESC}). "Por ciudad/campaña/agente" = usa dimension, no filters, salvo que el usuario pida un valor concreto (ej. ciudad=Santiago). Omite filters o {} si no hay corte explícito.`,
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
      description:
        "Embudo de conversión (leads → contactados/gestionados → negocio → ventas según devuelva el RPC). Úsalo para preguntas de funnel o embudo.",
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
// TOOL EXECUTION — con filtros forzados extraídos del mensaje del usuario
// ═══════════════════════════════════════════════════════════════════════════

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "America/Santiago" contiene "santiago" → no debe disparar filters.ciudad */
function scrubTimezoneFalsePositives(text: string): string {
  return text
    .replace(/\bAmerica\/Santiago\b/gi, " ")
    .replace(/\bPacific\/Easter\b/gi, " ")
    .replace(/\bAmerica\/[A-Za-z_]+\/[A-Za-z_]+\b/g, " ");
}

/** Ciudad solo si aparece como término (no como parte de otra cadena) */
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

// Extrae filtros REALES del mensaje del usuario comparando contra dimensiones de la BD
function extractFiltersFromMessage(userMsg: string, dims: any): Record<string, string> {
  if (!userMsg || !dims) return {};
  const scrubbed = scrubTimezoneFalsePositives(userMsg);
  const msg = scrubbed.toLowerCase();
  const found: Record<string, string> = {};

  // Ciudades (NUNCA por subcadena tipo America/Santiago)
  if (dims.ciudades && Array.isArray(dims.ciudades)) {
    for (const c of dims.ciudades) {
      if (c && c.length > 2 && messageMentionsCityName(scrubbed, c)) {
        found.ciudad = c;
        break;
      }
    }
  }
  // Campañas mkt
  if (dims.campanas_mkt && Array.isArray(dims.campanas_mkt)) {
    for (const c of dims.campanas_mkt) {
      if (c && msg.includes(c.toLowerCase())) {
        found.campana_mkt = c;
        break;
      }
    }
  }
  // Campañas inconcert
  if (dims.campanas_inconcert && Array.isArray(dims.campanas_inconcert)) {
    for (const c of dims.campanas_inconcert) {
      if (c && msg.includes(c.toLowerCase())) {
        found.campana_inconcert = c;
        break;
      }
    }
  }
  // Tipos de llamada
  if (dims.tipos_llamada && Array.isArray(dims.tipos_llamada)) {
    for (const t of dims.tipos_llamada) {
      if (t && msg.includes(t.toLowerCase())) {
        found.tipo_llamada = t;
        break;
      }
    }
  }
  // Categorías mkt
  if (dims.categorias_mkt && Array.isArray(dims.categorias_mkt)) {
    for (const c of dims.categorias_mkt) {
      if (c && c.length > 3 && msg.includes(c.toLowerCase())) {
        found.categoria_mkt = c;
        break;
      }
    }
  }
  // Agentes (todos los tipos)
  for (const [dimKey, filterKey] of [
    ["agentes_negocio", "agente_negocio"],
    ["agentes_prim_gestion", "agente_prim_gestion"],
    ["agentes_ultim_gestion", "agente_ultim_gestion"],
  ] as const) {
    if (dims[dimKey] && Array.isArray(dims[dimKey])) {
      for (const a of dims[dimKey]) {
        if (a && msg.includes(a.toLowerCase())) {
          found[filterKey] = a;
          break;
        }
      }
    }
  }
  // Resultados negocio
  if (dims.resultados_negocio && Array.isArray(dims.resultados_negocio)) {
    for (const r of dims.resultados_negocio) {
      if (r && r.length > 3 && msg.includes(r.toLowerCase())) {
        found.result_negocio = r;
        break;
      }
    }
  }
  // Resultados primera gestión
  if (dims.resultados_prim_gestion && Array.isArray(dims.resultados_prim_gestion)) {
    for (const r of dims.resultados_prim_gestion) {
      if (r && r.length > 3 && msg.includes(r.toLowerCase())) {
        found.result_prim_gestion = r;
        break;
      }
    }
  }
  // Resultados última gestión
  if (dims.resultados_ultim_gestion && Array.isArray(dims.resultados_ultim_gestion)) {
    for (const r of dims.resultados_ultim_gestion) {
      if (r && r.length > 3 && msg.includes(r.toLowerCase())) {
        found.result_ultim_gestion = r;
        break;
      }
    }
  }
  // Resultado marcadora
  if (dims.prim_resultado_marcadora && Array.isArray(dims.prim_resultado_marcadora)) {
    for (const r of dims.prim_resultado_marcadora) {
      if (r && msg.includes(r.toLowerCase())) {
        found.prim_resultado_marcadora = r;
        break;
      }
    }
  }

  // Portabilidad (nombre coloquial → código en DIMENSIONES)
  if (!found.campana_mkt && /portabilidad/.test(msg) && Array.isArray(dims.campanas_mkt)) {
    const hit = dims.campanas_mkt.find((c: string) => /portabilidad/i.test(c));
    if (hit) found.campana_mkt = hit;
  }

  // Canales frecuentes
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
  if (!found.tipo_llamada && /salientes?/.test(msg) && Array.isArray(dims.tipos_llamada)) {
    const w = dims.tipos_llamada.find((t: string) => /c2c/i.test(String(t)));
    if (w) found.tipo_llamada = w;
  }

  if (!found.result_ultim_gestion && /buz[oó]n/.test(msg) && Array.isArray(dims.resultados_ultim_gestion)) {
    const hit = dims.resultados_ultim_gestion.find((r: string) => /buz[oó]n/i.test(r));
    if (hit) found.result_ultim_gestion = hit;
  }
  if (!found.result_negocio && /no interesad/.test(msg) && Array.isArray(dims.resultados_negocio)) {
    const hit = dims.resultados_negocio.find((r: string) => /no interesad/i.test(r));
    if (hit) found.result_negocio = hit;
  }

  if (/última gestión|ultima gestion/.test(msg) && /no interesad/.test(msg) && Array.isArray(dims.resultados_ultim_gestion)) {
    const hit = dims.resultados_ultim_gestion.find((r: string) => /no interesad/i.test(r));
    if (hit) {
      found.result_ultim_gestion = hit;
      delete found.result_negocio;
    }
  }
  if (/primera gestión|primera gestion/.test(msg) && /no interesad/.test(msg) && Array.isArray(dims.resultados_prim_gestion)) {
    const hit = dims.resultados_prim_gestion.find((r: string) => /no interesad/i.test(r));
    if (hit) {
      found.result_prim_gestion = hit;
      delete found.result_negocio;
    }
  }

  // Agente: match parcial por token (ej. "luke" → wom_luke_age_0029) si no hubo match exacto
  if (!found.agente_negocio && !found.agente_prim_gestion && !found.agente_ultim_gestion) {
    const tokens = scrubbed
      .toLowerCase()
      .split(/[^a-z0-9áéíóúñü]+/)
      .filter((t: string) => t.length >= 4 && !GENERIC_AGENT_TOKENS.has(t));
    const agentPairs = [
      ["agentes_negocio", "agente_negocio"],
      ["agentes_prim_gestion", "agente_prim_gestion"],
      ["agentes_ultim_gestion", "agente_ultim_gestion"],
    ] as const;
    outer: for (const [dimKey, fk] of agentPairs) {
      const arr = dims[dimKey];
      if (!Array.isArray(arr)) continue;
      for (const a of arr) {
        if (!a || typeof a !== "string") continue;
        const al = a.toLowerCase();
        for (const tok of tokens) {
          if (al.includes(tok)) {
            found[fk] = a;
            break outer;
          }
        }
      }
    }
  }

  return found;
}

// Combina: filtros forzados (del mensaje) + filtros del modelo (args.filters) + filtros frontend
function buildFilters(args: any, af: Filters, forcedFilters: Record<string, string> = {}): object | null {
  const m: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(forcedFilters)) {
    if (v) m[k] = v;
  }

  if (af.campana_mkt) m.campana_mkt = af.campana_mkt;
  if (af.agente) m.agente_negocio = af.agente;
  if (af.tipo_llamada) m.tipo_llamada = af.tipo_llamada;
  if (af.ciudad) m.ciudad = af.ciudad;
  if (af.categoria_mkt) m.categoria_mkt = af.categoria_mkt;
  if (af.campana_inconcert) m.campana_inconcert = af.campana_inconcert;
  if (af.bpo) m.bpo = af.bpo;
  if (af.result_negocio) m.result_negocio = af.result_negocio;
  if (af.es_venta === true) m.es_venta = true;

  if (args.filters && typeof args.filters === "object") {
    for (const [k, v] of Object.entries(args.filters)) {
      if (v !== undefined && v !== null && v !== "") m[k] = v;
    }
  }

  return Object.keys(m).length > 0 ? m : null;
}

async function executeTool(
  admin: any,
  tid: string,
  name: string,
  args: any,
  af: Filters,
  forcedFilters: Record<string, string> = {},
): Promise<string> {
  const fd = args.fecha_desde || af.fecha_desde || null;
  const fh = args.fecha_hasta || af.fecha_hasta || null;
  const df = args.date_field || null;
  const fi = buildFilters(args, af, forcedFilters);

  // Log para verificar que los filtros se aplican
  console.log(`[EXEC] ${name} filters=${JSON.stringify(fi)} forced=${JSON.stringify(forcedFilters)}`);

  try {
    let data: any, error: any;

    switch (name) {
      case "get_kpis":
        ({ data, error } = await admin.rpc("get_leads_kpis", {
          _tenant_id: tid,
          _fecha_desde: fd,
          _fecha_hasta: fh,
          _date_field: df,
          _filters: fi,
        }));
        break;
      case "agg_1d":
        ({ data, error } = await admin.rpc("leads_agg_1d", {
          _tenant_id: tid,
          _dimension: args.dimension,
          _fecha_desde: fd,
          _fecha_hasta: fh,
          _limit: args.limit || 50,
          _date_field: df,
          _filters: fi,
        }));
        break;
      case "agg_2d":
        ({ data, error } = await admin.rpc("leads_agg_2d", {
          _tenant_id: tid,
          _dim1: args.dim1,
          _dim2: args.dim2,
          _fecha_desde: fd,
          _fecha_hasta: fh,
          _top_n: args.top_n || 10,
          _date_field: df,
          _filters: fi,
        }));
        break;
      case "time_metrics":
        ({ data, error } = await admin.rpc("leads_time_metrics", {
          _tenant_id: tid,
          _group_by: args.group_by || null,
          _fecha_desde: fd,
          _fecha_hasta: fh,
          _date_field: df,
          _filters: fi,
        }));
        break;
      case "funnel":
        ({ data, error } = await admin.rpc("leads_funnel", {
          _tenant_id: tid,
          _fecha_desde: fd,
          _fecha_hasta: fh,
          _date_field: df,
          _filters: fi,
        }));
        break;
      default:
        return `ERROR: herramienta "${name}" no existe`;
    }

    if (error) {
      console.error(`RPC ${name} ERROR:`, JSON.stringify(error));
      return `ERROR_BD: ${name} falló: ${error.message || error.code || JSON.stringify(error)}. NO inventes datos, reporta este error.`;
    }

    if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
      console.log(`RPC ${name}: sin resultados`);
      return `RESULTADO_BD: ${name} retornó 0 filas. No hay datos para estos filtros. NO inventes datos.`;
    }

    // Envolver resultado con metadata de verificación
    const json = JSON.stringify(data, null, 0);
    const rowCount = Array.isArray(data) ? data.length : 1;
    const totalLeads = Array.isArray(data)
      ? data.reduce((s: number, r: any) => s + (r.leads || 0), 0)
      : data.total_leads || data.total || data.n || 0;

    console.log(`RPC ${name}: ${rowCount} filas, ${totalLeads} leads total, ${json.length}c`);

    return `RESULTADO_BD_REAL(${name}, filas=${rowCount}, total_leads=${totalLeads}):\n${json}\nFIN_RESULTADO. Usa EXACTAMENTE estos números.`;
  } catch (e) {
    console.error(`CRASH ${name}:`, e);
    return `ERROR_SISTEMA: ${name} crasheó: ${(e as Error).message}. NO inventes datos.`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — anti-hallucination reforzado
// ═══════════════════════════════════════════════════════════════════════════
const ANTI_HALLUCINATION = `
REGLA ABSOLUTA: Cada número DEBE venir de RESULTADO_BD_REAL.
- Si RESULTADO dice "total_leads=M" → usa M directamente. NUNCA sumes filas manualmente.
- Si retorna ERROR o 0 filas → responde "No hay datos" — NUNCA inventes.
- PROHIBIDO escribir operaciones aritméticas como "199+446+397+...=". Usa get_kpis para totales.
- PROHIBIDO repetir secuencias de números (8,8,8,8... o similar). Si detectas que estás repitiendo, PARA y da el total directo.
- Sé CONCISO. Máximo 500 palabras por respuesta.`;

function buildAnalyticsSys(dims: any, kpis: any, af: Filters): string {
  return `Eres asistente BI de Converti-IA Analytics.

DIMENSIONES: ${JSON.stringify(dims, null, 0)}
KPIs: ${JSON.stringify(kpis, null, 0)}
FILTROS FRONTEND: ${JSON.stringify(af)}

MODELO: fch_creacion=llegada | fch_prim_gestion=1er contacto(agente_prim_gestion) | fch_ultim_gestion=última gestión(agente_ultim_gestion) | fch_negocio=cierre(agente_negocio)

═══ REGLA #1 — FILTROS (LA MÁS IMPORTANTE) ═══
Cuando el usuario mencione CUALQUIER valor específico (ciudad, campaña, agente, tipo llamada, resultado, etc.), DEBES pasarlo en el parámetro "filters" de la herramienta. SIN EXCEPCIÓN.

MAPEO OBLIGATORIO:
- Usuario dice una CIUDAD (Santiago, Melipilla, etc.) → filters={"ciudad":"Santiago"}
- Usuario dice una CAMPAÑA (WOM_01_EX, etc.) → filters={"campana_mkt":"WOM_01_EX"}
- Usuario dice un AGENTE → filters={"agente_negocio":"wom_xxx"} o agente_prim_gestion o agente_ultim_gestion
- Usuario dice TIPO LLAMADA (form, c2c, Entrante) → filters={"tipo_llamada":"form"}
- Usuario dice RESULTADO → filters={"result_negocio":"SAC"}
- Usuario dice CAMPAÑA INCONCERT → filters={"campana_inconcert":"xxx"}

EJEMPLOS COMPLETOS:
- "leads diarios de Santiago" → agg_1d(dimension="fecha", filters={"ciudad":"Santiago"})
- "tabla de la ciudad santiago" → agg_1d(dimension="fecha", filters={"ciudad":"Santiago"})
- "leads de Melipilla" → get_kpis(filters={"ciudad":"Melipilla"})
- "resultados del agente wom_orga_age_0070" → agg_1d(dimension="fecha", filters={"agente_negocio":"wom_orga_age_0070"})
- "tipo llamada form del 24 feb" → agg_1d(dimension="fecha", fecha_desde="2026-02-24", fecha_hasta="2026-02-24", filters={"tipo_llamada":"form"})
- "ventas por campaña tipo Entrante" → agg_1d(dimension="campana_mkt", filters={"tipo_llamada":"Entrante"})
- "total leads de marzo" → get_kpis(fecha_desde="2026-03-01", fecha_hasta="2026-03-31")

ERROR COMÚN QUE DEBES EVITAR:
❌ MALO: usuario dice "de Santiago" y tú llamas agg_1d(dimension="fecha") SIN filters → devuelve TODOS los leads
✅ BUENO: agg_1d(dimension="fecha", filters={"ciudad":"Santiago"}) → devuelve SOLO Santiago

═══ OTRAS REGLAS ═══
${ANTI_HALLUCINATION}
- Para TOTALES usa get_kpis con filtros, NUNCA sumes filas manualmente.
- NUNCA hagas aritmética paso a paso. Usa get_kpis.
- Respuestas CONCISAS, máximo 500 palabras.

FORMATO: español, markdown. Tablas:
| Col | Leads | Ventas | Conv% |
|-----|-------|--------|-------|`;
}

function buildDashSys(dims: any, kpis: any, af: Filters): string {
  return `Eres el asistente analítico de DashDinamics (Converti-IA): generas insights y dashboards desde la tabla leads (call center / ventas telco, ej. WOM Chile) en Supabase.

DIMENSIONES (valores reales del tenant): ${JSON.stringify(dims, null, 0)}
KPIs globales de referencia: ${JSON.stringify(kpis, null, 0)}
FILTROS UI ya aplicados por el front: ${JSON.stringify(af)}

═══ DASH — SIN FILTROS AUTOMÁTICOS DESDE EL TEXTO ═══
El servidor NO inyecta ciudad, campaña, agente ni tipo de llamada desde el mensaje del usuario. Solo deben usarse: (1) filtros que el usuario pida explícitamente en lenguaje natural y tú traduzcas a "filters", (2) los de FILTROS UI arriba. Expresiones genéricas como "por ciudad" o "por campaña" indican DIMENSIÓN de agrupación, NO filters salvo valor concreto (ej. "solo Santiago", código WOM_…).

═══ ZONA HORARIA ═══
Interpreta y expresa fechas en America/Santiago (Chile). Convierte "ayer", "hoy", "última semana", "semana pasada", "este mes", "marzo", "hace 8 días", "últimos 30 días", "del 10 al 14 de marzo" a fecha_desde / fecha_hasta en YYYY-MM-DD según calendario local.
Comparaciones: "esta semana vs anterior", "mes actual vs anterior", "lunes vs martes" → dos llamadas a herramientas o rangos explícitos en get_kpis/agg.

═══ GLOSARIO (usa en insights) ═══
Lead = registro de contacto. Venta = es_venta=true. Efectividad/conversión (%) = ventas / leads × 100 (si leads=0, indicar N/A).
Contactabilidad (%) = leads con prim_resultado_marcadora IN ('CONNECTED','FINISHED') / total leads × 100.
Porta POS/PRE, Fibra, Línea nueva, BAM: tipos de resultado de negocio. c2c=click-to-call saliente; Entrante; whatsapp; form=formulario.
Distingue SIEMPRE: result_prim_gestion (primera gestión agente), result_ultim_gestion (última gestión), result_negocio (cierre definitivo). Si el usuario dice "resultado" sin aclarar → prioriza result_negocio; si dice "primera gestión" o "última gestión" → filtro en el campo correspondiente.
Ciudad vacía en datos → mostrar/agrupar como "Sin ciudad". keyword vacío → ignorar.

═══ SINÓNIMOS ═══
ventas/conversiones/plata hecha → es_venta=true o métricas sobre ventas. convertimos/efectividad → tasa ventas/leads.
mejor vendedor → ranking por agente y ventas. "se perdieron" → NO_ANSWER / sin venta según contexto. "por dónde entran" → tipo_llamada o categoria_mkt.

═══ REGLA #1 — FILTROS EN HERRAMIENTAS ═══
Todo valor concreto (ciudad, campaña_mkt, agente_*, tipo_llamada, result_*, prim_resultado_marcadora, categoria_mkt, es_venta) va en "filters" del tool SOLO si el usuario lo pide explícitamente (nombre de ciudad, código de campaña, id de agente, etc.).
Si el usuario dice "portabilidad" y no da código, elige de DIMENSIONES.campanas_mkt la que contenga PORTABILIDAD.
Sin rango de fechas explícito: asume los últimos 7 días calendario en Chile (fch_creacion) y dilo en time_range.

═══ CIUDAD: DIMENSIÓN agrupación vs FILTRO ═══
Frases como "por ciudad", "rendimiento por ciudad", "desglose por ciudad", "KPIs por ciudad" = usa agg_1d con dimension "ciudad" y SIN filters.ciudad (debes ver TODAS las ciudades con datos en el rango).
filters.ciudad SOLO si el usuario nombra una ciudad concreta ("solo Santiago", "Melipilla", etc.).
El huso horario o "calendario Chile" NO implica filtro por ciudad.

═══ HERRAMIENTAS ═══
get_kpis: totales, conversión, tiempos agregados. agg_1d: por dimensión (fecha, hora, campana_mkt, agente_*, ciudad, tipo_llamada, result_*, etc.). agg_2d: cruce 2 dimensiones. time_metrics: tiempos respuesta/ciclo. funnel: embudo leads→gestión→negocio→ventas.
Para hora pico / leads por hora usa dimension "hora" o "hora_negocio" según date_field adecuado (fch_creacion para llegada).

═══ EJECUCIÓN OBLIGATORIA ═══
NUNCA devuelvas formularios, preguntas de afinación, clarifying_questions ni dashboard_presets. SIEMPRE llama herramientas y devuelve response_mode "dashboard" con datos reales. Si el pedido es vago, infiere periodo (p. ej. últimos 7 días), métricas razonables y los gráficos más útiles.

═══ DESGLOSE "NINGUNO" ═══
Si el usuario eligió "Ninguno" (sin desglose por agente/campaña/ciudad): NO uses dimension campana_mkt, agente_* ni ciudad en agg_1d/agg_2d ni en títulos de gráficos. Solo fecha, hora o KPIs globales. Prohibido titular "por campaña" o "por agente".

═══ FECHAS Y TOTALES ═══
Mismo rango inclusivo (America/Santiago) y mismo date_field (por defecto fch_creacion) en get_kpis y en agg_1d(dimension=fecha). total_leads de get_kpis debe ser coherente con la serie diaria del mismo rango.

Cuando corresponda dashboard: LLAMA herramientas ANTES del JSON final. TOTALES con get_kpis, no sumes filas a mano. Prioriza kpis[] con valores copiados de RESULTADO_BD_REAL.
${ANTI_HALLUCINATION}

═══ FORMATO dashboard ═══
assistant_message: insights en markdown. dashboard: title, subtitle, time_range, kpis (leads, ventas, conversión %, contactabilidad cuando aplique), charts, tables, insights, recommended_next_steps.
Cada chart: id, title, type, rationale, config ECharts con datos reales. Si el usuario pidió un solo tablero, unifica en un dashboard; si pidió varios paneles, varios charts bien titulados en el mismo dashboard.
Tablas: headers como array de strings; rows SIEMPRE array de arrays (cada fila = array de celdas en el mismo orden que headers). Si el chart tiene datos, la tabla detalle debe repetir esas filas con valores numéricos, no rows vacío.
Paleta: Leads #3498db, Ventas #2ecc71, Conversión #e74c3c.

RESPONDE SOLO JSON válido en la raíz:
{"response_mode":"dashboard","assistant_message":"...","decision_goal":"...","dashboard":{...}}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DASH: tools → JSON forzado
// ═══════════════════════════════════════════════════════════════════════════
async function runDash(
  key: string,
  sys: string,
  msgs: any[],
  admin: any,
  tid: string,
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
        const r = await executeTool(admin, tid, tc.function.name, a, af, ff);
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
        {
          role: "user",
          content:
            'JSON único: response_mode "dashboard" obligatorio. RESULTADO_BD_REAL en kpis/charts/tables. "por ciudad" = dimension ciudad sin filters.ciudad salvo ciudad explícita. tablas: rows array de arrays. get_kpis y agg mismo rango y date_field. Sin clarifying_questions.',
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });
  if (!fr.ok) throw new Error(`OpenAI final ${fr.status}`);
  return (await fr.json()).choices?.[0]?.message;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS: tools → stream
// ═══════════════════════════════════════════════════════════════════════════
/** Chat de bots (/app/bots): conversación textual sin herramientas SQL ni filtros inyectados desde el texto. */
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
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: all,
      stream: true,
      temperature: 0.45,
      max_tokens: 2048,
    }),
  });
  if (!fr.ok) {
    const t = await fr.text();
    throw new Error(`OpenAI ${fr.status}: ${t}`);
  }
  if (!fr.body) throw new Error("Sin cuerpo de respuesta");
  return fr.body;
}

async function runAnalytics(
  key: string,
  sys: string,
  msgs: any[],
  admin: any,
  tid: string,
  af: Filters,
  ff: Record<string, string> = {},
): Promise<ReadableStream | string> {
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
        max_tokens: 2048,
      }),
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
        const r = await executeTool(admin, tid, tc.function.name, a, af, ff);
        console.log(`[A] → ${r.substring(0, 150)}`);
        return { role: "tool", tool_call_id: tc.id, content: r };
      }),
    );
    all.push(...res);
  }
  // Final streaming - con instrucción anti-loop
  all.push({
    role: "system",
    content:
      "Responde de forma CONCISA. Para totales usa el número de total_leads del RESULTADO_BD. NUNCA sumes manualmente. NUNCA repitas secuencias de números. Máximo 500 palabras.",
  });

  const fr = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: all, stream: true, temperature: 0.1, max_tokens: 1024 }),
  });
  if (!fr.ok) throw new Error(`Stream ${fr.status}`);
  return fr.body!;
}

function coerceStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? ""));
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).map((x) => String(x ?? ""));
  return [];
}

/** El modelo a veces devuelve rows como objetos; el front espera string[][]. */
/** Quita entradas no-objeto en series[] (JSON roto del modelo → strings como `},{`) */
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
      if (headers.length > 0) {
        return headers.map((h) => {
          const v = o[h] ?? o[String(h).toLowerCase()];
          return v != null ? String(v) : "—";
        });
      }
      return Object.values(o).map((v) => (v != null ? String(v) : "—"));
    }
    return [row != null ? String(row) : "—"];
  });
}

function sanitizeDashboard(d: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!d || typeof d !== "object") {
    return {
      title: "Dashboard",
      subtitle: "",
      time_range: "",
      kpis: [],
      charts: [],
      tables: [],
      insights: [],
      recommended_next_steps: [],
    };
  }
  const charts = Array.isArray(d.charts)
    ? d.charts.map((ch: any) => ({
        ...ch,
        config: ch?.config != null ? sanitizeChartConfig(ch.config) : ch?.config,
      }))
    : [];
  const tables = Array.isArray(d.tables)
    ? d.tables.map((t: any) => {
        const headers = Array.isArray(t?.headers) ? t.headers.map((h: unknown) => String(h ?? "")) : [];
        let rows = t?.rows;
        if (Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])) {
          const sample = rows[0] as Record<string, unknown>;
          const derived =
            headers.length > 0 ? headers : Object.keys(sample);
          const h = derived.length > 0 ? derived : headers;
          return {
            ...t,
            headers: h,
            rows: normalizeTableRows(h, rows),
          };
        }
        return {
          ...t,
          headers,
          rows: normalizeTableRows(headers, rows),
        };
      })
    : [];
  return {
    ...d,
    kpis: Array.isArray(d.kpis) ? d.kpis : [],
    charts,
    tables,
    insights: Array.isArray(d.insights) ? d.insights : [],
    recommended_next_steps: coerceStringArray(d.recommended_next_steps),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// JSON NORMALIZER — asegura que la estructura sea la que espera el frontend
// ═══════════════════════════════════════════════════════════════════════════

/** Respuestas antiguas "clarification" → dashboard mínimo (sin formulario en UI) */
function coerceClarificationToDashboard(raw: any): any {
  const hint =
    raw.assistant_message ||
    "No se generó un tablero. Reformula tu pregunta con periodo y qué quieres medir, o pulsa Regenerar.";
  return {
    response_mode: "dashboard",
    assistant_message: hint,
    decision_goal: null,
    dashboard: null,
  };
}
function normalizeDashResponse(raw: any): any {
  // Caso 1: Ya tiene response_mode en raíz → estructura correcta
  if (raw.response_mode) {
    if (raw.response_mode === "clarification") {
      return coerceClarificationToDashboard(raw);
    }
    if (raw.response_mode === "dashboard" && raw.dashboard) {
      return { ...raw, dashboard: sanitizeDashboard(raw.dashboard) };
    }
    return raw;
  }

  // Caso 2: response_mode está dentro de dashboard → extraer
  if (raw.dashboard?.response_mode) {
    const inner = raw.dashboard;
    const mode = inner.response_mode;
    delete inner.response_mode;
    return {
      response_mode: mode,
      assistant_message: inner.assistant_message || inner.message || "",
      decision_goal: inner.decision_goal || null,
      dashboard: sanitizeDashboard(inner),
    };
  }

  // Caso 3: El JSON tiene una key raíz arbitraria con el dashboard dentro
  // ej: {"comparativa_leads": {"title": "...", "charts": [...]}}
  const keys = Object.keys(raw);
  if (keys.length === 1 && typeof raw[keys[0]] === "object") {
    const inner = raw[keys[0]];
    // Si tiene charts o tables o kpis, es un dashboard
    if (inner.charts || inner.tables || inner.kpis || inner.data) {
      return {
        response_mode: "dashboard",
        assistant_message: inner.assistant_message || inner.description || inner.message || "",
        decision_goal: inner.decision_goal || null,
        dashboard: sanitizeDashboard({
          title: inner.title || keys[0],
          subtitle: inner.subtitle || "",
          time_range: inner.time_range || "",
          kpis: inner.kpis || [],
          charts: inner.charts || [],
          insights: inner.insights || [],
          tables: inner.tables || [],
          recommended_next_steps: inner.recommended_next_steps || [],
        }),
      };
    }
  }

  // Caso 4: El JSON tiene charts/tables/kpis en raíz directamente
  if (raw.charts || raw.tables || raw.kpis) {
    return {
      response_mode: "dashboard",
      assistant_message: raw.assistant_message || raw.message || "",
      decision_goal: raw.decision_goal || null,
      dashboard: sanitizeDashboard({
        title: raw.title || "Dashboard",
        subtitle: raw.subtitle || "",
        time_range: raw.time_range || "",
        kpis: raw.kpis || [],
        charts: raw.charts || [],
        insights: raw.insights || [],
        tables: raw.tables || [],
        recommended_next_steps: raw.recommended_next_steps || [],
      }),
    };
  }

  // Caso 5: chart_options → chart_picker
  if (raw.chart_options) {
    return {
      response_mode: "chart_picker",
      assistant_message: raw.assistant_message || "",
      chart_options: raw.chart_options,
    };
  }

  // Caso 6: clarifying_questions (legado) → dashboard sin panel
  if (raw.clarifying_questions) {
    return coerceClarificationToDashboard(raw);
  }

  // Fallback: envolver como mensaje
  return {
    response_mode: "dashboard",
    assistant_message: raw.assistant_message || raw.message || JSON.stringify(raw).substring(0, 500),
    dashboard: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
      error: ue,
    } = await sb.auth.getUser();
    if (ue || !user)
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const body = await req.json();
    const { messages, mode, botId, webhookUrl } = body;
    const af: Filters = body.filters ?? {};
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tid } = await admin.rpc("get_user_tenant", { _user_id: user.id });
    const isDash = mode === "dashdinamics";
    const isBotChat = Boolean(botId) && !isDash;

    const key = Deno.env.get("OPENAI_API_KEY");
    if (mode === "bot_builder") {
      if (!key) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isSuper } = await sb.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
      if (!isSuper) {
        return new Response(JSON.stringify({ error: "Solo super administradores pueden usar el asistente de creación" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const desc = String(body.contextDescription ?? "").trim();
      if (!desc) {
        return new Response(JSON.stringify({ error: "contextDescription es requerido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bsys =
        `Eres experto en diseño de system prompts para asistentes conversacionales B2B (ventas, soporte, analytics). ` +
        `El usuario describirá el propósito del bot. Devuelve SOLO el texto del system prompt en español, sin prefijos como "System prompt:", sin cercar el texto en markdown. ` +
        `Incluye: rol, tono, límites (no inventar cifras o datos internos sin fuente), formato de respuesta. Entre 400 y 1500 palabras.`;
      const br = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: bsys },
            { role: "user", content: `Descripción del bot deseada:\n\n${desc}` },
          ],
          temperature: 0.35,
          max_tokens: 2500,
        }),
      });
      if (!br.ok) {
        const tx = await br.text();
        return new Response(JSON.stringify({ error: `OpenAI: ${tx}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const bj = await br.json();
      const system_prompt = String(bj.choices?.[0]?.message?.content ?? "").trim();
      return new Response(JSON.stringify({ system_prompt }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (webhookUrl) {
      try {
        const last = messages[messages.length - 1]?.content || "";
        const wr = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: last, chatInput: last, sessionId: botId || "default", tenantId: tid }),
        });
        if (!wr.ok) throw new Error(`Webhook ${wr.status}`);
        const wd = await wr.json();
        const reply =
          typeof wd === "string"
            ? wd
            : Array.isArray(wd)
              ? wd[0]?.output || wd[0]?.response || JSON.stringify(wd[0])
              : wd.output || wd.response || wd.message || wd.text || JSON.stringify(wd);
        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("webhook:", e);
      }
    }

    if (!key) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sys: string;
    let forcedFilters: Record<string, string> = {};
    let botModel = "gpt-4o-mini";

    if (isBotChat) {
      if (!tid) {
        return new Response(JSON.stringify({ error: "Sin tenant asignado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: bot, error: botErr } = await admin
        .from("bots")
        .select("system_prompt, model")
        .eq("id", botId)
        .eq("tenant_id", tid)
        .maybeSingle();
      if (botErr || !bot) {
        return new Response(JSON.stringify({ error: "Bot no encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sys =
        `${String(bot.system_prompt || "Eres un asistente útil.").trim()}\n\n` +
        `Responde siempre en español. Puedes usar markdown (títulos, listas, negritas). ` +
        `Sé claro y útil; no inventes cifras de negocio ni tablas de datos salvo que el usuario pida orientación general.`;
      botModel = (bot as { model?: string }).model || "gpt-4o-mini";
      forcedFilters = {};
    } else if (tid) {
      const [dr, kr] = await Promise.all([
        admin.rpc("get_leads_dimensions", { _tenant_id: tid }),
        admin.rpc("get_leads_kpis", {
          _tenant_id: tid,
          _fecha_desde: null,
          _fecha_hasta: null,
          _date_field: null,
          _filters: null,
        }),
      ]);
      if (dr.error) console.error("dims err:", JSON.stringify(dr.error));
      if (kr.error) console.error("kpis err:", JSON.stringify(kr.error));
      const dims = dr.data || {};
      const kpis = kr.data || {};
      console.log(`Meta OK: dims=${JSON.stringify(dims).length}c kpis=${JSON.stringify(kpis).length}c`);
      sys = mode === "dashdinamics" ? buildDashSys(dims, kpis, af) : buildAnalyticsSys(dims, kpis, af);

      const lastUserMsg =
        String(messages.filter((m: any) => m.role === "user").pop()?.content || "").trim();
      if (mode === "dashdinamics") {
        forcedFilters = {};
      } else {
        forcedFilters = extractFiltersFromMessage(lastUserMsg, dims);
        if (Object.keys(forcedFilters).length > 0) {
          console.log(`FORCED FILTERS from message: ${JSON.stringify(forcedFilters)}`);
          sys += `\n⚠️ FILTROS DETECTADOS EN EL MENSAJE: ${JSON.stringify(forcedFilters)}. DEBES incluir estos en cada llamada a herramientas.`;
        }
      }
    } else {
      sys = "No hay tenant_id.";
    }

    console.log(`Prompt: ${sys.length}c mode=${mode} botChat=${isBotChat}`);

    if (mode === "dashdinamics") {
      try {
        const msg = await runDash(key, sys, messages, admin, tid, af, forcedFilters);
        const c = msg?.content || "{}";
        console.log(`[D] Raw JSON: ${c.substring(0, 300)}`);
        try {
          const parsed = JSON.parse(c);
          const normalized = normalizeDashResponse(parsed);
          if (normalized.response_mode === "clarification") {
            const coerced = coerceClarificationToDashboard(normalized);
            return new Response(JSON.stringify({ reply: coerced }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.log(`[D] Normalized mode: ${normalized.response_mode}, has dashboard: ${!!normalized.dashboard}`);
          return new Response(JSON.stringify({ reply: normalized }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return new Response(
            JSON.stringify({ reply: { response_mode: "dashboard", assistant_message: c, dashboard: null } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        console.error("Dash err:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (isBotChat) {
      try {
        const stream = await runTextBot(key, sys, messages, botModel);
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      } catch (e) {
        console.error("Bot chat err:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    try {
      const res = await runAnalytics(key, sys, messages, admin, tid, af, forcedFilters);
      if (typeof res === "string") {
        const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: res } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sse, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }
      return new Response(res, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    } catch (e) {
      console.error("Analytics err:", e);
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("Fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

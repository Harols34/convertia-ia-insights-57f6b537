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

const FILTER_DESC = `Filtros WHERE como JSON. Campos: agente_negocio, agente_prim_gestion, agente_ultim_gestion, campana_mkt, campana_inconcert, tipo_llamada, ciudad, categoria_mkt, result_negocio, result_prim_gestion, result_ultim_gestion, prim_resultado_marcadora, bpo, cliente. Ejemplo: {"campana_mkt":"WOM_CL_ENTRANTES","tipo_llamada":"Entrante"}`;
const DATE_DESC = `Campo fecha para rango: fch_creacion(default), fch_negocio, fch_prim_gestion, fch_ultim_gestion, fch_prim_resultado_marcadora`;
const DIM_DESC = `Dimensiones: agente_negocio, agente_prim_gestion, agente_ultim_gestion, campana_mkt, campana_inconcert, tipo_llamada, ciudad, categoria_mkt, result_negocio, result_prim_gestion, result_ultim_gestion, prim_resultado_marcadora, bpo, hora, hora_negocio, fecha, fecha_negocio, dia_semana, tramo_horario`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_kpis",
      description: "KPIs globales: total leads, ventas, conversión, tiempos.",
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
      description: `Agregación 1D: leads,ventas,conv% por dimensión. ${DIM_DESC}. Usa filters para filtrar, date_field para elegir fecha.`,
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
      description: "Funnel: total→gestión→negocio→ventas.",
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

// Extrae filtros REALES del mensaje del usuario comparando contra dimensiones de la BD
function extractFiltersFromMessage(userMsg: string, dims: any): Record<string, string> {
  if (!userMsg || !dims) return {};
  const msg = userMsg.toLowerCase();
  const found: Record<string, string> = {};

  // Ciudades
  if (dims.ciudades && Array.isArray(dims.ciudades)) {
    for (const c of dims.ciudades) {
      if (c && c.length > 2 && msg.includes(c.toLowerCase())) {
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
  // Resultado marcadora
  if (dims.prim_resultado_marcadora && Array.isArray(dims.prim_resultado_marcadora)) {
    for (const r of dims.prim_resultado_marcadora) {
      if (r && msg.includes(r.toLowerCase())) {
        found.prim_resultado_marcadora = r;
        break;
      }
    }
  }

  return found;
}

// Combina: filtros forzados (del mensaje) + filtros del modelo (args.filters) + filtros frontend
function buildFilters(args: any, af: Filters, forcedFilters: Record<string, string> = {}): object | null {
  const m: Record<string, string> = {};

  // 1. Filtros forzados (extraídos del mensaje del usuario) — MÁXIMA prioridad
  for (const [k, v] of Object.entries(forcedFilters)) {
    if (v) m[k] = v;
  }

  // 2. Filtros del frontend
  if (af.campana_mkt) m.campana_mkt = af.campana_mkt;
  if (af.agente) m.agente_negocio = af.agente;
  if (af.tipo_llamada) m.tipo_llamada = af.tipo_llamada;
  if (af.ciudad) m.ciudad = af.ciudad;
  if (af.categoria_mkt) m.categoria_mkt = af.categoria_mkt;
  if (af.campana_inconcert) m.campana_inconcert = af.campana_inconcert;
  if (af.bpo) m.bpo = af.bpo;
  if (af.result_negocio) m.result_negocio = af.result_negocio;

  // 3. Filtros del modelo (si los pasa bien, genial; si no, los forzados ya están)
  if (args.filters && typeof args.filters === "object") {
    for (const [k, v] of Object.entries(args.filters)) {
      if (v) m[k] = String(v);
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
  return `Motor de DashDinamics.

DIMENSIONES: ${JSON.stringify(dims, null, 0)}
KPIs: ${JSON.stringify(kpis, null, 0)}
FILTROS: ${JSON.stringify(af)}

═══ REGLA #1 — FILTROS ═══
Cuando el usuario mencione CUALQUIER valor específico, DEBES pasarlo en "filters":
- Ciudad → filters={"ciudad":"Santiago"}
- Campaña → filters={"campana_mkt":"WOM_01_EX"}
- Agente → filters={"agente_negocio":"wom_xxx"}
- Tipo llamada → filters={"tipo_llamada":"form"}
- Resultado → filters={"result_negocio":"SAC"}

EJEMPLO CRÍTICO:
❌ MALO: "tabla de Santiago" → agg_1d(dimension="fecha") sin filters → TODOS los leads
✅ BUENO: agg_1d(dimension="fecha", filters={"ciudad":"Santiago"}) → solo Santiago

LLAMA HERRAMIENTAS PRIMERO, luego genera JSON.
Para TOTALES usa get_kpis(filters={...}), NUNCA sumes filas.
${ANTI_HALLUCINATION}

ECHARTS: tooltip:{"trigger":"axis","axisPointer":{"type":"cross"}} | legend:{"data":[...],"bottom":0} | Colores: Leads="#3498db" Ventas="#2ecc71" Efectividad="#e74c3c"

RESPONDE SOLO JSON:
dashboard: {"response_mode":"dashboard","assistant_message":"...","decision_goal":"...","dashboard":{"title":"...","subtitle":"...","time_range":"...","kpis":[{"label":"...","value":"...","trend":"up|down|neutral","icon":"TrendingUp|Users|Target"}],"charts":[{"id":"...","title":"...","type":"...","config":{...ECharts con datos REALES...}}],"insights":[{"type":"info","title":"...","description":"..."}],"tables":[{"title":"...","headers":[...],"rows":[[...]]}]}}
chart_picker: {"response_mode":"chart_picker","assistant_message":"...","chart_options":[{"id":"...","name":"...","description":"..."}]}
clarification: {"response_mode":"clarification","assistant_message":"...","clarifying_questions":[{"id":"q1","question":"...","options":["..."]}]}`;
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
            'Genera JSON final. ESTRUCTURA OBLIGATORIA: {"response_mode":"dashboard","assistant_message":"...","dashboard":{"title":"...","charts":[...],"tables":[...],"kpis":[...],"insights":[...]}}. response_mode DEBE estar en la RAÍZ del JSON, NO dentro de dashboard. Usa EXACTAMENTE los números de RESULTADO_BD_REAL.',
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

// ═══════════════════════════════════════════════════════════════════════════
// JSON NORMALIZER — asegura que la estructura sea la que espera el frontend
// ═══════════════════════════════════════════════════════════════════════════
function normalizeDashResponse(raw: any): any {
  // Caso 1: Ya tiene response_mode en raíz → estructura correcta
  if (raw.response_mode) {
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
      dashboard: inner,
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
        dashboard: {
          title: inner.title || keys[0],
          subtitle: inner.subtitle || "",
          time_range: inner.time_range || "",
          kpis: inner.kpis || [],
          charts: inner.charts || [],
          insights: inner.insights || [],
          tables: inner.tables || [],
          recommended_next_steps: inner.recommended_next_steps || [],
        },
      };
    }
  }

  // Caso 4: El JSON tiene charts/tables/kpis en raíz directamente
  if (raw.charts || raw.tables || raw.kpis) {
    return {
      response_mode: "dashboard",
      assistant_message: raw.assistant_message || raw.message || "",
      decision_goal: raw.decision_goal || null,
      dashboard: {
        title: raw.title || "Dashboard",
        subtitle: raw.subtitle || "",
        time_range: raw.time_range || "",
        kpis: raw.kpis || [],
        charts: raw.charts || [],
        insights: raw.insights || [],
        tables: raw.tables || [],
        recommended_next_steps: raw.recommended_next_steps || [],
      },
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

  // Caso 6: clarifying_questions → clarification
  if (raw.clarifying_questions) {
    return {
      response_mode: "clarification",
      assistant_message: raw.assistant_message || "",
      clarifying_questions: raw.clarifying_questions,
    };
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

    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key)
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    let sys: string;
    let forcedFilters: Record<string, string> = {};
    if (tid) {
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

      // Extraer filtros FORZADOS del mensaje del usuario
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop()?.content || "";
      forcedFilters = extractFiltersFromMessage(lastUserMsg, dims);
      if (Object.keys(forcedFilters).length > 0) {
        console.log(`FORCED FILTERS from message: ${JSON.stringify(forcedFilters)}`);
        // También agregar al system prompt como recordatorio
        sys += `\n⚠️ FILTROS DETECTADOS EN EL MENSAJE: ${JSON.stringify(forcedFilters)}. DEBES incluir estos en cada llamada a herramientas.`;
      }

      if (botId) {
        const { data: bot } = await admin.from("bots").select("system_prompt").eq("id", botId).single();
        if (bot?.system_prompt) sys = bot.system_prompt + "\n\n" + sys;
      }
    } else {
      sys = "No hay tenant_id.";
    }

    console.log(`Prompt: ${sys.length}c mode=${mode}`);

    if (mode === "dashdinamics") {
      try {
        const msg = await runDash(key, sys, messages, admin, tid, af, forcedFilters);
        const c = msg?.content || "{}";
        console.log(`[D] Raw JSON: ${c.substring(0, 300)}`);
        try {
          const parsed = JSON.parse(c);
          const normalized = normalizeDashResponse(parsed);
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

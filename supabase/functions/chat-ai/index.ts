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

// ═════════════════════════════════════════════════════════════════════════════
// AVAILABLE TOOLS — las funciones que la IA puede llamar
// ═════════════════════════════════════════════════════════════════════════════
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_kpis",
      description:
        "Obtener KPIs globales: total leads, ventas, conversión, tasa contacto, tiempos promedio. Usar siempre como primera consulta para dar contexto general.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string", description: "Fecha inicio YYYY-MM-DD. Null para todo el rango." },
          fecha_hasta: { type: "string", description: "Fecha fin YYYY-MM-DD. Null para todo el rango." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agg_1d",
      description:
        "Agregación por 1 dimensión: leads, ventas, conv% agrupados por la dimensión elegida. Dimensiones válidas: agente_negocio, campana_mkt, campana_inconcert, tipo_llamada, ciudad, categoria_mkt, result_negocio, result_prim_gestion, result_ultim_gestion, prim_resultado_marcadora, bpo, hora, hora_negocio, fecha, fecha_negocio, dia_semana, tramo_horario.",
      parameters: {
        type: "object",
        properties: {
          dimension: { type: "string", description: "Nombre de la dimensión." },
          fecha_desde: { type: "string", description: "Filtro fecha inicio YYYY-MM-DD" },
          fecha_hasta: { type: "string", description: "Filtro fecha fin YYYY-MM-DD" },
          limit: { type: "integer", description: "Máximo de filas a retornar. Default 50." },
        },
        required: ["dimension"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agg_2d",
      description:
        "Cruce de 2 dimensiones: leads, ventas, conv% por combinación de dim1 × dim2. Útil para comparar agentes por campaña, campañas por hora, etc.",
      parameters: {
        type: "object",
        properties: {
          dim1: { type: "string", description: "Primera dimensión" },
          dim2: { type: "string", description: "Segunda dimensión" },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
          top_n: { type: "integer", description: "Top N por cada dimensión. Default 10." },
        },
        required: ["dim1", "dim2"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "time_metrics",
      description:
        "Métricas de tiempo: respuesta (fch_prim_gestion - fch_creacion), ciclo (fch_negocio - fch_creacion). Puede agrupar por dimensión.",
      parameters: {
        type: "object",
        properties: {
          group_by: { type: "string", description: "Dimensión para agrupar. Null para global." },
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "funnel",
      description: "Funnel de conversión: total → con gestión → con negocio → ventas, con tasas.",
      parameters: {
        type: "object",
        properties: {
          fecha_desde: { type: "string" },
          fecha_hasta: { type: "string" },
        },
      },
    },
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTION — ejecuta las funciones RPC en Supabase
// ═════════════════════════════════════════════════════════════════════════════
async function executeTool(
  adminClient: any,
  tenantId: string,
  toolName: string,
  args: any,
  activeFilters: Filters,
): Promise<string> {
  // Merge active filters con args de la tool
  const fDesde = args.fecha_desde || activeFilters.fecha_desde || null;
  const fHasta = args.fecha_hasta || activeFilters.fecha_hasta || null;

  try {
    let result: any;

    switch (toolName) {
      case "get_kpis": {
        const { data, error } = await adminClient.rpc("get_leads_kpis", {
          _tenant_id: tenantId,
          _fecha_desde: fDesde,
          _fecha_hasta: fHasta,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case "agg_1d": {
        const { data, error } = await adminClient.rpc("leads_agg_1d", {
          _tenant_id: tenantId,
          _dimension: args.dimension,
          _fecha_desde: fDesde,
          _fecha_hasta: fHasta,
          _limit: args.limit || 50,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case "agg_2d": {
        const { data, error } = await adminClient.rpc("leads_agg_2d", {
          _tenant_id: tenantId,
          _dim1: args.dim1,
          _dim2: args.dim2,
          _fecha_desde: fDesde,
          _fecha_hasta: fHasta,
          _top_n: args.top_n || 10,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case "time_metrics": {
        const { data, error } = await adminClient.rpc("leads_time_metrics", {
          _tenant_id: tenantId,
          _group_by: args.group_by || null,
          _fecha_desde: fDesde,
          _fecha_hasta: fHasta,
        });
        if (error) throw error;
        result = data;
        break;
      }

      case "funnel": {
        const { data, error } = await adminClient.rpc("leads_funnel", {
          _tenant_id: tenantId,
          _fecha_desde: fDesde,
          _fecha_hasta: fHasta,
        });
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return JSON.stringify({ error: `Tool desconocida: ${toolName}` });
    }

    return JSON.stringify(result, null, 0);
  } catch (e) {
    console.error(`Tool ${toolName} error:`, e);
    return JSON.stringify({ error: `Error ejecutando ${toolName}: ${(e as Error).message}` });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — ahora LIGEROS, sin datos
// ═════════════════════════════════════════════════════════════════════════════

function buildAnalyticsSystem(dimensions: any, kpis: any, filters: Filters): string {
  return `Eres un asistente analítico BI senior de Converti-IA Analytics.

DATOS DISPONIBLES: tabla "leads" con las siguientes dimensiones y valores:
${JSON.stringify(dimensions, null, 0)}

KPIs ACTUALES (todo el rango de datos):
${JSON.stringify(kpis, null, 0)}

FILTROS ACTIVOS: ${JSON.stringify(filters)}

MODELO DE DATOS:
- fch_creacion = cuándo llegó el lead (BASE temporal)
- fch_prim_gestion = primer contacto del agente
- fch_ultim_gestion = última gestión
- fch_negocio = cierre/resultado final
- es_venta = booleano de si se cerró venta
- Tiempo respuesta = fch_prim_gestion - fch_creacion
- Tiempo ciclo = fch_negocio - fch_creacion

HERRAMIENTAS DISPONIBLES:
Tienes acceso a funciones que consultan la BD directamente. USA SIEMPRE las herramientas para obtener datos — NUNCA inventes números.

REGLAS:
1. SIEMPRE usa las herramientas para cada dato que necesites. No asumas valores.
2. Para "¿cuántos leads hoy?" → llama agg_1d(dimension="fecha") y busca la fecha.
3. Para comparar agentes → llama agg_1d(dimension="agente_negocio").
4. Para cruces → llama agg_2d con las 2 dimensiones.
5. Para tiempos → llama time_metrics.
6. Para funnel → llama funnel.
7. Puedes llamar VARIAS herramientas en paralelo si necesitas múltiples datos.
8. Responde en español con markdown. Tablas para datos tabulares.
9. Si el usuario pide un dato que no cubre ninguna herramienta, indícalo.`;
}

function buildDashSystem(dimensions: any, kpis: any, filters: Filters): string {
  return `Eres el motor de inteligencia de DashDinamics.
  
DATOS DISPONIBLES (dimensiones y valores):
${JSON.stringify(dimensions, null, 0)}

KPIs ACTUALES:
${JSON.stringify(kpis, null, 0)}

FILTROS ACTIVOS: ${JSON.stringify(filters)}

HERRAMIENTAS: Tienes funciones para consultar la BD. SIEMPRE usa las herramientas para obtener datos reales.

REGLAS CRÍTICAS:
1. SIEMPRE llama las herramientas necesarias ANTES de generar el JSON de respuesta.
2. Usa los datos reales retornados por las herramientas, NUNCA inventes.
3. Para gráficos temporales (hora, fecha, día), llama agg_1d con la dimensión correspondiente.
4. Para comparativos, llama agg_1d o agg_2d según corresponda.
5. Puedes llamar múltiples herramientas en paralelo.

DESPUÉS de obtener los datos, responde con un ÚNICO objeto JSON válido.

REGLAS ECHARTS — TOOLTIP:
- SIEMPRE: "tooltip": { "trigger": "axis", "axisPointer": { "type": "cross" } }
- SIEMPRE: "legend": { "data": [...nombres de series...], "bottom": 0 }
- Eje dual: yAxis[0]=Cantidad, yAxis[1]=Efectividad(%)
- Serie efectividad: yAxisIndex:1, type:"line", smooth:true

MODOS: dashboard | chart_picker | clarification | recommendation | filter_result

ESTRUCTURA JSON FINAL (después de tener datos de herramientas):

dashboard / filter_result:
{
  "response_mode": "dashboard" | "filter_result",
  "assistant_message": "...",
  "decision_goal": "...",
  "applied_filters": {},
  "filter_options": {},
  "dashboard": {
    "title":"...","subtitle":"...","time_range":"...",
    "kpis":[{"label":"...","value":"...","change":"...","trend":"up|down|neutral","icon":"..."}],
    "charts":[{
      "id":"...","title":"...","type":"...",
      "config":{...ECharts config con datos REALES de las herramientas...}
    }],
    "insights":[{"type":"success|warning|info|alert","title":"...","description":"..."}],
    "recommended_next_steps":["..."],
    "tables":[{"title":"...","headers":["..."],"rows":[["..."]]}]
  }
}

chart_picker:
{"response_mode":"chart_picker","assistant_message":"...","chart_options":[{"id":"...","name":"...","description":"...","best_for":"..."}],"instruction_for_user":"..."}

clarification:
{"response_mode":"clarification","assistant_message":"...","clarifying_questions":[{"id":"q1","question":"...","type":"single_select","options":["..."]}]}

recommendation:
{"response_mode":"recommendation","assistant_message":"...","recommendations":[{"id":"r1","title":"...","description":"...","action_label":"Generar este dashboard"}]}

ROUTING:
- Sin tipo gráfico → chart_picker
- Con tipo gráfico → dashboard (DESPUÉS de llamar herramientas)
- Falta info → clarification
- Muy amplio → recommendation`;
}

// ═════════════════════════════════════════════════════════════════════════════
// TOOL CALL LOOP — ejecuta iterativamente las tool calls de OpenAI
// ═════════════════════════════════════════════════════════════════════════════
async function runWithTools(
  apiKey: string,
  systemPrompt: string,
  messages: any[],
  adminClient: any,
  tenantId: string,
  activeFilters: Filters,
  mode: string,
  maxIterations = 5,
): Promise<any> {
  const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

  for (let i = 0; i < maxIterations; i++) {
    const requestBody: any = {
      model: "gpt-4o-mini",
      messages: allMessages,
      tools: TOOLS,
      tool_choice: i === 0 ? "auto" : "auto", // Let model decide
      temperature: 0.15,
      max_tokens: mode === "dashdinamics" ? 4096 : 2048,
    };

    if (mode === "dashdinamics" && i > 0) {
      // En las iteraciones finales de dashdinamics, forzar JSON
      // Solo cuando ya no necesite más tools
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!r.ok) {
      const status = r.status;
      const body = await r.text();
      console.error(`OpenAI error ${status}:`, body);
      throw new Error(`OpenAI error ${status}`);
    }

    const aiData = await r.json();
    const choice = aiData.choices?.[0];

    if (!choice) throw new Error("No choice in response");

    const assistantMsg = choice.message;
    allMessages.push(assistantMsg);

    // Si no hay tool calls, terminamos
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return assistantMsg;
    }

    // Ejecutar todas las tool calls en paralelo
    const toolResults = await Promise.all(
      assistantMsg.tool_calls.map(async (tc: any) => {
        const args = JSON.parse(tc.function.arguments || "{}");
        console.log(`Executing tool: ${tc.function.name}`, args);
        const result = await executeTool(adminClient, tenantId, tc.function.name, args, activeFilters);
        console.log(`Tool ${tc.function.name} result length: ${result.length} chars`);
        return {
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        };
      }),
    );

    // Agregar resultados al historial
    allMessages.push(...toolResults);
  }

  // Si llegamos aquí, excedimos iteraciones — pedir respuesta final sin tools
  const finalReq: any = {
    model: "gpt-4o-mini",
    messages: allMessages,
    temperature: 0.15,
    max_tokens: mode === "dashdinamics" ? 4096 : 2048,
  };
  if (mode === "dashdinamics") {
    finalReq.response_format = { type: "json_object" };
  }

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(finalReq),
  });

  if (!r.ok) throw new Error(`OpenAI final error ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message;
}

// ═════════════════════════════════════════════════════════════════════════════
// STREAMING VERSION — para modo analytics
// ═════════════════════════════════════════════════════════════════════════════
async function runWithToolsStreaming(
  apiKey: string,
  systemPrompt: string,
  messages: any[],
  adminClient: any,
  tenantId: string,
  activeFilters: Filters,
): Promise<ReadableStream | string> {
  const allMessages = [{ role: "system", content: systemPrompt }, ...messages];

  // Fase 1: Tool calls (no streaming)
  for (let i = 0; i < 5; i++) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: allMessages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.15,
        max_tokens: 2048,
      }),
    });

    if (!r.ok) throw new Error(`OpenAI error ${r.status}`);
    const data = await r.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("No message");

    allMessages.push(msg);

    if (!msg.tool_calls?.length) {
      // No más tool calls — retornar contenido directamente
      return msg.content || "";
    }

    // Ejecutar tools
    const results = await Promise.all(
      msg.tool_calls.map(async (tc: any) => {
        const args = JSON.parse(tc.function.arguments || "{}");
        console.log(`[stream] Executing: ${tc.function.name}`, args);
        const result = await executeTool(adminClient, tenantId, tc.function.name, args, activeFilters);
        return { role: "tool", tool_call_id: tc.id, content: result };
      }),
    );
    allMessages.push(...results);
  }

  // Fase 2: Respuesta final con streaming
  const finalR = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: allMessages,
      stream: true,
      temperature: 0.15,
      max_tokens: 2048,
    }),
  });

  if (!finalR.ok) throw new Error(`OpenAI stream error ${finalR.status}`);
  return finalR.body!;
}

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

    // ── n8n webhook (sin cambios) ────────────────────────────────────────
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY)
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── Obtener metadata ligera (NO toda la data) ────────────────────────
    let systemPrompt: string;

    if (tenantId) {
      // Ejecutar en paralelo: dimensiones + KPIs (~2 queries ligeras)
      const [dimResult, kpiResult] = await Promise.all([
        adminClient.rpc("get_leads_dimensions", { _tenant_id: tenantId }),
        adminClient.rpc("get_leads_kpis", {
          _tenant_id: tenantId,
          _fecha_desde: activeFilters.fecha_desde || null,
          _fecha_hasta: activeFilters.fecha_hasta || null,
        }),
      ]);

      const dimensions = dimResult.data || {};
      const kpis = kpiResult.data || {};

      console.log(
        `Metadata loaded: dimensions=${JSON.stringify(dimensions).length} chars, kpis=${JSON.stringify(kpis).length} chars`,
      );

      if (mode === "dashdinamics") {
        systemPrompt = buildDashSystem(dimensions, kpis, activeFilters);
      } else {
        systemPrompt = buildAnalyticsSystem(dimensions, kpis, activeFilters);
      }

      // Si hay un system prompt custom del bot, prepend
      if (botId) {
        const { data: bot } = await adminClient.from("bots").select("system_prompt").eq("id", botId).single();
        if (bot?.system_prompt) {
          systemPrompt = bot.system_prompt + "\n\n" + systemPrompt;
        }
      }
    } else {
      systemPrompt =
        mode === "dashdinamics"
          ? "No hay tenant_id. No se pueden consultar datos."
          : "No hay tenant_id. No se pueden consultar datos.";
    }

    console.log(`System prompt: ${systemPrompt.length} chars (mode=${mode})`);

    // ── DashDinamics: JSON con tools ─────────────────────────────────────
    if (mode === "dashdinamics") {
      try {
        const result = await runWithTools(
          OPENAI_API_KEY,
          systemPrompt,
          messages,
          adminClient,
          tenantId,
          activeFilters,
          "dashdinamics",
        );

        const content = result?.content || "{}";

        try {
          // Intentar parsear como JSON
          const parsed = JSON.parse(content);
          return new Response(JSON.stringify({ reply: parsed }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          // Si no es JSON válido, envolver en estructura
          return new Response(
            JSON.stringify({
              reply: {
                response_mode: "dashboard",
                assistant_message: content,
                dashboard: null,
              },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      } catch (e) {
        const errMsg = (e as Error).message;
        console.error("DashDinamics error:", errMsg);
        if (errMsg.includes("429"))
          return new Response(JSON.stringify({ error: "Límite de solicitudes excedido" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (errMsg.includes("402"))
          return new Response(JSON.stringify({ error: "Créditos agotados" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (errMsg.includes("400"))
          return new Response(JSON.stringify({ error: "Error de contexto" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        return new Response(JSON.stringify({ error: `Error IA: ${errMsg}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Analytics: tools + stream ────────────────────────────────────────
    try {
      const result = await runWithToolsStreaming(
        OPENAI_API_KEY,
        systemPrompt,
        messages,
        adminClient,
        tenantId,
        activeFilters,
      );

      if (typeof result === "string") {
        // La respuesta vino sin streaming (tool calls resolvieron todo)
        // Convertir a SSE format para compatibilidad
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: result } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseData, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Streaming response
      return new Response(result, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } catch (e) {
      const errMsg = (e as Error).message;
      console.error("Analytics error:", errMsg);
      if (errMsg.includes("429"))
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      return new Response(JSON.stringify({ error: `Error: ${errMsg}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

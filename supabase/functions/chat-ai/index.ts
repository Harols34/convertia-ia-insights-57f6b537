import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildLeadsContext(leads: any[]): string {
  const totalLeads = leads.length;
  const ventas = leads.filter((l: any) => l.es_venta === true).length;
  const noVentas = leads.filter((l: any) => l.es_venta === false).length;
  const conNegocio = leads.filter((l: any) => l.result_negocio && l.result_negocio !== "").length;
  const conGestion = leads.filter((l: any) => l.result_prim_gestion && l.result_prim_gestion !== "").length;

  const countBy = (arr: any[], key: string) => {
    const m: Record<string, number> = {};
    arr.forEach((i) => { if (i[key]) m[i[key]] = (m[i[key]] || 0) + 1; });
    return m;
  };

  const byHour: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  leads.forEach((l: any) => {
    if (l.fch_creacion) {
      try {
        const d = new Date(l.fch_creacion);
        const hourKey = `${d.toISOString().split('T')[0]} ${String(d.getHours()).padStart(2, '0')}:00`;
        byHour[hourKey] = (byHour[hourKey] || 0) + 1;
        const dateKey = d.toISOString().split('T')[0];
        byDate[dateKey] = (byDate[dateKey] || 0) + 1;
      } catch {}
    }
  });

  const ventasPorCiudad: Record<string, number> = {};
  const ventasPorCampana: Record<string, number> = {};
  const ventasPorBpo: Record<string, number> = {};
  const ventasPorAgente: Record<string, number> = {};
  leads.filter((l: any) => l.es_venta === true).forEach((l: any) => {
    if (l.ciudad) ventasPorCiudad[l.ciudad] = (ventasPorCiudad[l.ciudad] || 0) + 1;
    if (l.campana_mkt) ventasPorCampana[l.campana_mkt] = (ventasPorCampana[l.campana_mkt] || 0) + 1;
    if (l.bpo) ventasPorBpo[l.bpo] = (ventasPorBpo[l.bpo] || 0) + 1;
    if (l.agente_negocio) ventasPorAgente[l.agente_negocio] = (ventasPorAgente[l.agente_negocio] || 0) + 1;
  });

  return `
📊 DATOS REALES — Tabla LEADS (${totalLeads} registros)

=== KPIs ===
Total leads: ${totalLeads}
Ventas (es_venta=true): ${ventas} (${totalLeads > 0 ? ((ventas/totalLeads)*100).toFixed(1) : 0}%)
No ventas: ${noVentas} (${totalLeads > 0 ? ((noVentas/totalLeads)*100).toFixed(1) : 0}%)
Con gestión: ${conGestion} (${totalLeads > 0 ? ((conGestion/totalLeads)*100).toFixed(1) : 0}%)
Con negocio: ${conNegocio} (${totalLeads > 0 ? ((conNegocio/totalLeads)*100).toFixed(1) : 0}%)

=== DISTRIBUCIONES ===
Por cliente: ${JSON.stringify(countBy(leads, "cliente"))}
Por campaña MKT: ${JSON.stringify(countBy(leads, "campana_mkt"))}
Por BPO: ${JSON.stringify(countBy(leads, "bpo"))}
Resultados negocio: ${JSON.stringify(countBy(leads, "result_negocio"))}
Resultados primera gestión: ${JSON.stringify(countBy(leads, "result_prim_gestion"))}
Resultados última gestión: ${JSON.stringify(countBy(leads, "result_ultim_gestion"))}
Por ciudad: ${JSON.stringify(countBy(leads, "ciudad"))}
Por categoría MKT: ${JSON.stringify(countBy(leads, "categoria_mkt"))}
Por tipo llamada: ${JSON.stringify(countBy(leads, "tipo_llamada"))}
Por keyword: ${JSON.stringify(countBy(leads, "keyword"))}
Por agente negocio: ${JSON.stringify(countBy(leads, "agente_negocio"))}
Por agente primera gestión: ${JSON.stringify(countBy(leads, "agente_prim_gestion"))}

=== VENTAS POR DIMENSIÓN ===
Ventas por ciudad: ${JSON.stringify(ventasPorCiudad)}
Ventas por campaña: ${JSON.stringify(ventasPorCampana)}
Ventas por BPO: ${JSON.stringify(ventasPorBpo)}
Ventas por agente: ${JSON.stringify(ventasPorAgente)}

=== TEMPORAL ===
Por fecha: ${JSON.stringify(byDate)}
Por hora: ${JSON.stringify(Object.fromEntries(Object.entries(byHour).slice(-48)))}

=== COLUMNAS ===
cliente, id_lead, id_llave, campana_inconcert, campana_mkt, categoria_mkt, tipo_llamada, fch_creacion, fch_prim_resultado_marcadora, prim_resultado_marcadora, fch_prim_gestion, agente_prim_gestion, result_prim_gestion, fch_ultim_gestion, agente_ultim_gestion, result_ultim_gestion, fch_negocio, agente_negocio, result_negocio, ciudad, email, keyword, bpo, es_venta`;
}

const DASHDINAMICS_SYSTEM = `Eres el motor de inteligencia del módulo DashDinamics. Actúas como consultor senior de BI y toma de decisiones.

REGLA CRÍTICA: Responde SIEMPRE con JSON válido y NADA MÁS. Sin texto fuera del JSON. Sin markdown. Sin explicaciones fuera del JSON. Solo el objeto JSON.

Tu respuesta DEBE ser un único objeto JSON con esta estructura:

{
  "response_mode": "dashboard" | "clarification" | "recommendation",
  "assistant_message": "string breve",
  "decision_goal": "string o null",
  ...campos según el modo
}

=== MODO "dashboard" ===
Usa cuando hay suficiente contexto. Incluye:
{
  "response_mode": "dashboard",
  "assistant_message": "Resumen ejecutivo breve (1-2 oraciones)",
  "decision_goal": "Qué decisión ayuda a tomar",
  "dashboard": {
    "title": "string",
    "subtitle": "string",
    "time_range": "string",
    "kpis": [{"label":"string","value":"string o number","change":"string o null","trend":"up|down|neutral","icon":"TrendingUp|Users|Target|DollarSign|BarChart|Activity"}],
    "charts": [{"id":"string","title":"string","type":"bar|line|pie|area|horizontalBar|donut|stackedBar|combo","config":{...ECharts config...}}],
    "insights": [{"type":"success|warning|info|alert","title":"string","description":"string"}],
    "recommended_next_steps": ["string"],
    "tables": [{"title":"string","headers":["string"],"rows":[["string"]]}]
  }
}

=== MODO "clarification" ===
Usa cuando falta contexto clave. Incluye:
{
  "response_mode": "clarification",
  "assistant_message": "Pregunta o contexto breve",
  "decision_goal": null,
  "clarifying_questions": [
    {"id":"q1","question":"string","type":"single_select","options":["string"]}
  ]
}

=== MODO "recommendation" ===
Usa cuando la solicitud es amplia. Incluye:
{
  "response_mode": "recommendation",
  "assistant_message": "Mensaje ejecutivo breve",
  "decision_goal": null,
  "recommendations": [
    {"id":"r1","title":"string","description":"string","icon":"BarChart|TrendingUp|Target|Users|Activity","action_label":"Generar este dashboard"}
  ]
}

REGLAS DE GRÁFICOS (ECharts):
- USA SIEMPRE datos reales proporcionados, NUNCA inventes.
- Colores: #008080, #e74c3c, #f39c12, #3498db, #2ecc71, #9b59b6, #1abc9c, #e67e22.
- Fondo transparente siempre.
- Incluye tooltip siempre.
- Para pie/donut: "type":"pie", data:[{name,value}].
- Para barras horizontales: yAxis type category, xAxis type value.
- Para tendencias: type "line" o "area".
- Textos de ejes en color #aaa.

REGLAS DE DECISIÓN:
- Si la intención del usuario es clara y específica → dashboard
- Si falta información clave (período, dimensión, nivel detalle) → clarification (máx 3 preguntas)
- Si la solicitud es muy amplia ("analiza todo", "hazme un dashboard") → recommendation (2-4 opciones)

REGLAS DE CONTENIDO:
- KPIs: 3-6 métricas clave con tendencia.
- Insights: 2-4 hallazgos accionables.
- Next steps: 2-3 recomendaciones.
- Mensajes breves, ejecutivos, orientados a decisión.
- Nunca texto largo. Dashboard es protagonista.
- Genera múltiples gráficos complementarios cuando sea útil (2-4).
- Incluye tablas solo si aportan valor real.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, mode, botId, dataSource, webhookUrl } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: user.id });

    // ── n8n webhook mode ──
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

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "");
          throw new Error(`Webhook ${resp.status}${errorText ? ` - ${errorText}` : ""}`);
        }

        const data = await resp.json();
        let reply: string;
        if (typeof data === "string") reply = data;
        else if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          reply = first.output || first.response || first.message || first.text || JSON.stringify(first);
        } else {
          reply = data.output || data.response || data.message || data.text || JSON.stringify(data);
        }

        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (whErr) {
        console.error("n8n webhook error, using AI fallback:", whErr);
      }
    }

    // ── Build system prompt ──
    let systemPrompt: string;
    
    if (mode === "dashdinamics") {
      systemPrompt = DASHDINAMICS_SYSTEM;
    } else {
      systemPrompt = `Eres un asistente analítico BI avanzado de Converti-IA Analytics.
Responde en español. Experto en análisis de datos de marketing, leads, campañas y gestión comercial.
Usa formato markdown con tablas, listas y negritas.
Basa TODAS tus respuestas en los datos reales. Nunca inventes datos.
Si piden "ventas", filtra por es_venta=true.`;
    }

    if (botId) {
      const { data: bot } = await adminClient
        .from("bots").select("system_prompt").eq("id", botId).single();
      if (bot?.system_prompt) systemPrompt = bot.system_prompt;
    }

    // Inject real data
    if (tenantId) {
      const { data: leads, error: leadsErr } = await adminClient
        .from("leads").select("*").eq("tenant_id", tenantId).limit(1000);

      if (!leadsErr && leads && leads.length > 0) {
        systemPrompt += "\n\n" + buildLeadsContext(leads);
        systemPrompt += `\n\nIMPORTANTE: Usa SIEMPRE estos datos reales. Ventas totales: ${leads.filter((l: any) => l.es_venta === true).length}. Nunca digas que no tienes datos.`;
      } else {
        systemPrompt += `\n\nNo hay datos de leads disponibles para este tenant aún.`;
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For dashdinamics mode, use non-streaming to get clean JSON
    if (mode === "dashdinamics") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Límite excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos agotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await response.text();
        console.error("OpenAI error:", status, t);
        return new Response(JSON.stringify({ error: "Error del servicio de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "{}";
      
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({ reply: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ reply: { response_mode: "dashboard", assistant_message: content, dashboard: null } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Streaming for other modes (analytics, bots)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Límite excedido" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos agotados" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("OpenAI error:", status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

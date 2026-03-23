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

  // Group leads by hour of creation for temporal analysis
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

  // Ventas por ciudad
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
📊 DATOS REALES DE LA BASE DE DATOS — Tabla LEADS (${totalLeads} registros)

=== KPIs PRINCIPALES ===
- Total de leads: ${totalLeads}
- **Ventas (es_venta=true): ${ventas}** (${totalLeads > 0 ? ((ventas/totalLeads)*100).toFixed(1) : 0}%)
- No ventas (es_venta=false): ${noVentas} (${totalLeads > 0 ? ((noVentas/totalLeads)*100).toFixed(1) : 0}%)
- Leads con gestión: ${conGestion} (${totalLeads > 0 ? ((conGestion/totalLeads)*100).toFixed(1) : 0}%)
- Leads con negocio: ${conNegocio} (${totalLeads > 0 ? ((conNegocio/totalLeads)*100).toFixed(1) : 0}%)

=== DISTRIBUCIONES GENERALES ===
Por cliente: ${JSON.stringify(countBy(leads, "cliente"))}
Por campaña MKT: ${JSON.stringify(countBy(leads, "campana_mkt"))}
Por BPO: ${JSON.stringify(countBy(leads, "bpo"))}
Resultados de negocio: ${JSON.stringify(countBy(leads, "result_negocio"))}
Resultados primera gestión: ${JSON.stringify(countBy(leads, "result_prim_gestion"))}
Resultados última gestión: ${JSON.stringify(countBy(leads, "result_ultim_gestion"))}
Por ciudad: ${JSON.stringify(countBy(leads, "ciudad"))}
Por categoría MKT: ${JSON.stringify(countBy(leads, "categoria_mkt"))}
Por tipo de llamada: ${JSON.stringify(countBy(leads, "tipo_llamada"))}
Por keyword: ${JSON.stringify(countBy(leads, "keyword"))}
Por agente negocio: ${JSON.stringify(countBy(leads, "agente_negocio"))}
Por agente primera gestión: ${JSON.stringify(countBy(leads, "agente_prim_gestion"))}

=== VENTAS POR DIMENSIÓN ===
Ventas por ciudad: ${JSON.stringify(ventasPorCiudad)}
Ventas por campaña MKT: ${JSON.stringify(ventasPorCampana)}
Ventas por BPO: ${JSON.stringify(ventasPorBpo)}
Ventas por agente negocio: ${JSON.stringify(ventasPorAgente)}

=== DISTRIBUCIÓN TEMPORAL ===
Leads por fecha: ${JSON.stringify(byDate)}
Leads por hora (últimas entradas): ${JSON.stringify(Object.fromEntries(Object.entries(byHour).slice(-48)))}

=== COLUMNAS DISPONIBLES ===
cliente, id_lead, id_llave, campana_inconcert, campana_mkt, categoria_mkt, tipo_llamada, fch_creacion, fch_prim_resultado_marcadora, prim_resultado_marcadora, fch_prim_gestion, agente_prim_gestion, result_prim_gestion, fch_ultim_gestion, agente_ultim_gestion, result_ultim_gestion, fch_negocio, agente_negocio, result_negocio, ciudad, email, keyword, bpo, es_venta

=== MUESTRA DE REGISTROS (primeros 10) ===
${JSON.stringify(leads.slice(0, 10), null, 2)}`;
}

const DASHDINAMICS_EXTRA = `

=== INSTRUCCIONES PARA GRÁFICOS DINÁMICOS ===
Cuando el usuario pida un gráfico, dashboard o visualización, DEBES incluir un bloque JSON de ECharts envuelto en etiquetas <CHART_CONFIG> y </CHART_CONFIG>.
El JSON debe ser una configuración válida de ECharts (Apache ECharts). Ejemplo:

<CHART_CONFIG>
{
  "title": { "text": "Ventas por Ciudad", "left": "center", "textStyle": { "color": "#e0e0e0" } },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["Bogotá", "Medellín", "Cali"], "axisLabel": { "color": "#aaa", "rotate": 30 } },
  "yAxis": { "type": "value", "axisLabel": { "color": "#aaa" }, "splitLine": { "lineStyle": { "color": "#333" } } },
  "series": [{ "name": "Ventas", "type": "bar", "data": [45, 30, 20], "itemStyle": { "color": "#008080", "borderRadius": [4,4,0,0] } }]
}
</CHART_CONFIG>

Reglas para gráficos:
- USA SIEMPRE los datos reales proporcionados arriba, NUNCA inventes números.
- Usa colores como #008080, #e74c3c, #f39c12, #3498db, #2ecc71, #9b59b6.
- Para gráficos de pastel usa "type": "pie" con "data": [{"name":"...", "value": N}].
- Para líneas usa "type": "line".
- Para barras horizontales usa yAxis type category y xAxis type value.
- Incluye "tooltip" siempre.
- Puedes generar MÚLTIPLES gráficos en una sola respuesta.
- Siempre explica el gráfico con texto markdown antes y/o después del bloque.
- El fondo siempre es transparente (no pongas backgroundColor).
`;

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { messages, mode, botId, dataSource, webhookUrl } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: userId });
    let n8nFallbackReason = "";

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
        if (typeof data === "string") {
          reply = data;
        } else if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          reply = first.output || first.response || first.message || first.text || JSON.stringify(first);
        } else {
          reply = data.output || data.response || data.message || data.text || JSON.stringify(data);
        }

        return new Response(JSON.stringify({ reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (whErr) {
        n8nFallbackReason = whErr instanceof Error ? whErr.message : "desconocido";
        console.error("n8n webhook error, using AI fallback:", whErr);
      }
    }

    // ── Build system prompt ──
    let systemPrompt = `Eres un asistente analítico BI (Business Intelligence) avanzado de la plataforma Converti-IA Analytics.
Responde siempre en español. Eres experto en análisis de datos de marketing, leads, campañas y gestión comercial.
Cuando presentes datos, usa formato markdown con tablas, listas y negritas para mayor claridad.
Basa TODAS tus respuestas en los datos reales proporcionados abajo. Nunca inventes datos.
Si te piden "ventas", filtra por es_venta=true. Si te piden leads por hora, usa la distribución temporal.
Si te piden datos por ciudad, campaña, BPO, agente, etc., usa las distribuciones correspondientes.
Siempre da números exactos basados en los datos.`;

    if (botId) {
      const { data: bot } = await adminClient
        .from("bots")
        .select("system_prompt")
        .eq("id", botId)
        .single();
      if (bot?.system_prompt) systemPrompt = bot.system_prompt;
    }

    // Add chart generation instructions for dashdinamics mode
    if (mode === "dashdinamics") {
      systemPrompt += DASHDINAMICS_EXTRA;
    }

    // Inject real data
    if (tenantId) {
      const { data: leads, error: leadsErr } = await adminClient
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(1000);

      if (!leadsErr && leads && leads.length > 0) {
        systemPrompt += "\n\n" + buildLeadsContext(leads);

        systemPrompt += `\n\nIMPORTANTE: Usa SIEMPRE estos datos reales para responder. Si preguntan cuántas ventas hay, la respuesta es ${leads.filter((l: any) => l.es_venta === true).length}. Nunca digas que no tienes acceso a datos.`;

        if (n8nFallbackReason) {
          systemPrompt += `\n\nAVISO: Webhook n8n falló (${n8nFallbackReason}), respondiendo con IA + datos reales.`;
        }
      } else {
        systemPrompt += `\n\nNo hay datos de leads disponibles para este tenant aún.`;
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables that contain business data (not config)
const BUSINESS_TABLES: Record<string, { label: string; description: string }> = {
  leads: { label: "Leads", description: "Datos de leads de marketing, gestiones, negocios, campañas" },
  exports: { label: "Exportaciones", description: "Historial de archivos exportados" },
  audit_logs: { label: "Auditoría", description: "Eventos y actividad del sistema" },
};

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

    const { messages, mode, botId, dataSource } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: userId });

    let systemPrompt = `Eres un asistente analítico avanzado de la plataforma Converti-IA Analytics. 
Responde siempre en español. Eres experto en análisis de datos de marketing, leads, campañas y gestión comercial.
Cuando presentes datos, usa formato markdown con tablas, listas y negritas para mayor claridad.
Si te piden gráficos, describe los datos en formato que pueda ser interpretado para visualización.`;

    // If a bot is specified, use its system prompt
    if (botId) {
      const { data: bot } = await adminClient
        .from("bots")
        .select("system_prompt, n8n_workflow_id")
        .eq("id", botId)
        .single();
      if (bot?.system_prompt) systemPrompt = bot.system_prompt;
    }

    // Inject real data context based on selected data source
    const selectedTable = dataSource || "leads";
    
    if ((mode === "analytics" || botId) && tenantId && BUSINESS_TABLES[selectedTable]) {
      if (selectedTable === "leads") {
        const { data: leads, error: leadsErr } = await adminClient
          .from("leads")
          .select("*")
          .eq("tenant_id", tenantId)
          .limit(500);

        if (!leadsErr && leads && leads.length > 0) {
          const countBy = (arr: any[], key: string) => {
            const m: Record<string, number> = {};
            arr.forEach((i) => { if (i[key]) m[i[key]] = (m[i[key]] || 0) + 1; });
            return m;
          };

          const conNegocio = leads.filter((l: any) => l.result_negocio && l.result_negocio !== "").length;
          const conGestion = leads.filter((l: any) => l.result_prim_gestion && l.result_prim_gestion !== "").length;

          systemPrompt += `\n\n📊 CONTEXTO DE DATOS REALES — Tabla: LEADS (${leads.length} registros del tenant)
Total de leads: ${leads.length}
Leads con gestión: ${conGestion} (${((conGestion/leads.length)*100).toFixed(1)}%)
Leads con negocio: ${conNegocio} (${((conNegocio/leads.length)*100).toFixed(1)}%)
Distribución por cliente: ${JSON.stringify(countBy(leads, "cliente"))}
Distribución por campaña MKT: ${JSON.stringify(countBy(leads, "campana_mkt"))}
Distribución por BPO: ${JSON.stringify(countBy(leads, "bpo"))}
Resultados de negocio: ${JSON.stringify(countBy(leads, "result_negocio"))}
Resultados primera gestión: ${JSON.stringify(countBy(leads, "result_prim_gestion"))}
Distribución por ciudad: ${JSON.stringify(countBy(leads, "ciudad"))}
Categoría MKT: ${JSON.stringify(countBy(leads, "categoria_mkt"))}
Tipo de llamada: ${JSON.stringify(countBy(leads, "tipo_llamada"))}

Columnas disponibles: cliente, id_lead, id_llave, campana_inconcert, campana_mkt, categoria_mkt, tipo_llamada, fch_creacion, fch_prim_resultado_marcadora, prim_resultado_marcadora, fch_prim_gestion, agente_prim_gestion, result_prim_gestion, fch_ultim_gestion, agente_ultim_gestion, result_ultim_gestion, fch_negocio, agente_negocio, result_negocio, ciudad, email, keyword, bpo

Muestra primeros 5 registros como ejemplo:
${JSON.stringify(leads.slice(0, 5), null, 2)}

Usa estos datos reales para responder con precisión. Genera tablas, KPIs, comparaciones y análisis detallados.`;
        } else {
          systemPrompt += `\n\nNo hay datos de leads disponibles para este tenant aún.`;
        }
      } else if (selectedTable === "exports") {
        const { data: exports } = await adminClient
          .from("exports")
          .select("*")
          .eq("tenant_id", tenantId)
          .limit(200);
        
        if (exports && exports.length > 0) {
          systemPrompt += `\n\n📊 CONTEXTO DE DATOS REALES — Tabla: EXPORTACIONES (${exports.length} registros)
${JSON.stringify(exports.slice(0, 10), null, 2)}`;
        }
      } else if (selectedTable === "audit_logs") {
        const { data: logs } = await adminClient
          .from("audit_logs")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(200);
        
        if (logs && logs.length > 0) {
          systemPrompt += `\n\n📊 CONTEXTO DE DATOS REALES — Tabla: AUDITORÍA (${logs.length} registros)
${JSON.stringify(logs.slice(0, 10), null, 2)}`;
        }
      }
    }

    // Append available tables info
    systemPrompt += `\n\nTablas de negocio disponibles para consulta:
${Object.entries(BUSINESS_TABLES).map(([k, v]) => `- ${v.label} (${k}): ${v.description}`).join("\n")}
El usuario está consultando la tabla: ${BUSINESS_TABLES[selectedTable]?.label || selectedTable}`;

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

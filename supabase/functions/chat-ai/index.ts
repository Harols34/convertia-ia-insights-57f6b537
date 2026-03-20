import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { messages, mode, botId } = await req.json();

    // Get tenant context
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

    // In analytics mode, inject leads context
    if (mode === "analytics" && tenantId) {
      const { data: leads } = await adminClient
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(500);

      if (leads && leads.length > 0) {
        const clienteCount: Record<string, number> = {};
        const campanaCount: Record<string, number> = {};
        const bpoCount: Record<string, number> = {};
        const resultNegocio: Record<string, number> = {};
        const ciudadCount: Record<string, number> = {};

        leads.forEach((l: any) => {
          if (l.cliente) clienteCount[l.cliente] = (clienteCount[l.cliente] || 0) + 1;
          if (l.campana_mkt) campanaCount[l.campana_mkt] = (campanaCount[l.campana_mkt] || 0) + 1;
          if (l.bpo) bpoCount[l.bpo] = (bpoCount[l.bpo] || 0) + 1;
          if (l.result_negocio) resultNegocio[l.result_negocio] = (resultNegocio[l.result_negocio] || 0) + 1;
          if (l.ciudad) ciudadCount[l.ciudad] = (ciudadCount[l.ciudad] || 0) + 1;
        });

        systemPrompt += `\n\nCONTEXTO DE DATOS REALES DEL TENANT:
Total de leads: ${leads.length}
Distribución por cliente: ${JSON.stringify(clienteCount)}
Distribución por campaña MKT: ${JSON.stringify(campanaCount)}
Distribución por BPO: ${JSON.stringify(bpoCount)}
Resultados de negocio: ${JSON.stringify(resultNegocio)}
Distribución por ciudad: ${JSON.stringify(ciudadCount)}
Datos completos disponibles para análisis detallado.`;
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

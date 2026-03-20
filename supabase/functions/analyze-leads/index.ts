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

    const body = await req.json().catch(() => ({}));
    const { filters } = body as { filters?: { cliente?: string; campana_mkt?: string; bpo?: string; fecha_inicio?: string; fecha_fin?: string } };

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tenantId } = await adminClient.rpc("get_user_tenant", { _user_id: userId });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = adminClient.from("leads").select("*").eq("tenant_id", tenantId);

    if (filters?.cliente) query = query.eq("cliente", filters.cliente);
    if (filters?.campana_mkt) query = query.eq("campana_mkt", filters.campana_mkt);
    if (filters?.bpo) query = query.eq("bpo", filters.bpo);
    if (filters?.fecha_inicio) query = query.gte("fch_creacion", filters.fecha_inicio);
    if (filters?.fecha_fin) query = query.lte("fch_creacion", filters.fecha_fin);

    const { data: leads, error } = await query.limit(1000);
    if (error) throw error;

    const total = leads?.length || 0;
    const countBy = (arr: any[], key: string) => {
      const map: Record<string, number> = {};
      arr.forEach((item) => {
        const val = item[key];
        if (val) map[val] = (map[val] || 0) + 1;
      });
      return Object.entries(map)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    const conNegocio = leads?.filter((l: any) => l.result_negocio && l.result_negocio !== "").length || 0;
    const conGestion = leads?.filter((l: any) => l.result_prim_gestion && l.result_prim_gestion !== "").length || 0;

    const result = {
      total,
      conNegocio,
      conGestion,
      tasaGestion: total > 0 ? ((conGestion / total) * 100).toFixed(1) : "0",
      tasaNegocio: total > 0 ? ((conNegocio / total) * 100).toFixed(1) : "0",
      porCliente: countBy(leads || [], "cliente"),
      porCampanaMkt: countBy(leads || [], "campana_mkt"),
      porBpo: countBy(leads || [], "bpo"),
      porResultNegocio: countBy(leads || [], "result_negocio"),
      porCiudad: countBy(leads || [], "ciudad"),
      porResultPrimGestion: countBy(leads || [], "result_prim_gestion"),
      porCategoriaMkt: countBy(leads || [], "categoria_mkt"),
      filterOptions: {
        clientes: [...new Set(leads?.map((l: any) => l.cliente).filter(Boolean))],
        campanas: [...new Set(leads?.map((l: any) => l.campana_mkt).filter(Boolean))],
        bpos: [...new Set(leads?.map((l: any) => l.bpo).filter(Boolean))],
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

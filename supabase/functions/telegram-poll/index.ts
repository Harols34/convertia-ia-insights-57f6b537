// Telegram long-polling worker — invoked every minute by pg_cron
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;

const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 8_000;

serve(async (_req) => {
  const start = Date.now();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // initial offset
  const { data: state, error: stErr } = await admin
    .from("telegram_bot_state")
    .select("update_offset")
    .eq("id", 1)
    .single();
  if (stErr) {
    return new Response(JSON.stringify({ error: stErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let offset: number = state.update_offset;
  let total = 0;

  while (true) {
    const elapsed = Date.now() - start;
    const remaining = MAX_RUNTIME_MS - elapsed;
    if (remaining < MIN_REMAINING_MS) break;
    const timeout = Math.min(45, Math.max(1, Math.floor(remaining / 1000) - 5));

    const r = await fetch(`${GATEWAY_URL}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ offset, timeout, allowed_updates: ["message"] }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("getUpdates failed:", r.status, t);
      break;
    }
    const data = await r.json();
    const updates: any[] = data.result || [];
    if (updates.length === 0) continue;

    // Send to handler (fire and forget per batch, but await to advance offset only after)
    try {
      const hr = await fetch(`${SUPABASE_URL}/functions/v1/telegram-handler`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ updates }),
      });
      if (!hr.ok) console.error("handler returned", hr.status, await hr.text());
    } catch (e) {
      console.error("handler invoke err:", e);
    }

    const newOffset = Math.max(...updates.map(u => u.update_id)) + 1;
    await admin.from("telegram_bot_state")
      .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
      .eq("id", 1);
    offset = newOffset;
    total += updates.length;
  }

  return new Response(JSON.stringify({ ok: true, processed: total, finalOffset: offset }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Telegram message handler — process incoming messages, route to chat-ai or dashboard mode
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
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

async function tgSend(chatId: number, text: string, parseMode: "Markdown" | "HTML" | null = "Markdown") {
  // Telegram limits messages to ~4096 chars; split if needed
  const chunks: string[] = [];
  let s = text || "";
  // Sanitize: avoid inline LaTeX/code block issues; keep simple
  if (parseMode === "Markdown") {
    s = s.replace(/```([\s\S]*?)```/g, (_, c) => "```\n" + c.trim() + "\n```");
  }
  while (s.length > 0) {
    chunks.push(s.slice(0, 3800));
    s = s.slice(3800);
  }
  for (const chunk of chunks) {
    const body: Record<string, unknown> = { chat_id: chatId, text: chunk, disable_web_page_preview: true };
    if (parseMode) body.parse_mode = parseMode;
    const r = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      // retry without markdown if formatting fails
      if (parseMode) {
        await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chat_id: chatId, text: chunk, disable_web_page_preview: true }),
        });
      } else {
        console.error("tgSend failed:", r.status, await r.text());
      }
    }
  }
}

async function tgSendChatAction(chatId: number, action = "typing") {
  await fetch(`${GATEWAY_URL}/sendChatAction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

function detectMode(text: string, override?: string): "dashboard" | "text" {
  if (override === "dashboard") return "dashboard";
  if (override === "text") return "text";
  const t = text.toLowerCase();
  // Triggers for dashboard generation
  const dashWords = [
    "dashboard", "tablero", "kpis", "kpi", "gráfica", "grafica", "gráfico", "grafico",
    "analiza", "análisis", "analisis", "compara", "comparativa", "ranking", "top ",
    "evolución", "evolucion", "tendencia", "distribución", "distribucion",
    "por agente", "por campaña", "por campana", "por ciudad", "por bpo", "por canal",
  ];
  return dashWords.some(w => t.includes(w)) ? "dashboard" : "text";
}

function dashboardToText(dash: any, msg: string): string {
  if (!dash || typeof dash !== "object") return msg || "Sin datos.";
  const lines: string[] = [];
  if (dash.title) lines.push(`*${dash.title}*`);
  if (dash.subtitle) lines.push(`_${dash.subtitle}_`);
  if (dash.time_range) lines.push(`📅 ${dash.time_range}`);
  if (msg && msg.length > 4) lines.push("", msg);
  if (Array.isArray(dash.kpis) && dash.kpis.length > 0) {
    lines.push("", "*KPIs*");
    for (const k of dash.kpis.slice(0, 8)) {
      const v = typeof k.value === "number" ? k.value.toLocaleString("es-CL") : k.value;
      const ch = k.change ? ` (${k.change})` : "";
      lines.push(`• ${k.label}: *${v}*${ch}`);
    }
  }
  if (Array.isArray(dash.tables)) {
    for (const tbl of dash.tables.slice(0, 2)) {
      lines.push("", `*${tbl.title || "Tabla"}*`);
      const rows = (tbl.rows || []).slice(0, 8);
      for (const row of rows) lines.push(`• ${row.join(" — ")}`);
      if ((tbl.rows || []).length > 8) lines.push(`_… +${tbl.rows.length - 8} filas_`);
    }
  }
  if (Array.isArray(dash.insights) && dash.insights.length > 0) {
    lines.push("", "*Insights*");
    for (const ins of dash.insights.slice(0, 4)) {
      lines.push(`💡 *${ins.title}*: ${ins.description}`);
    }
  }
  if (Array.isArray(dash.recommended_next_steps) && dash.recommended_next_steps.length > 0) {
    lines.push("", "*Próximos pasos*");
    for (const s of dash.recommended_next_steps.slice(0, 4)) lines.push(`→ ${s}`);
  }
  return lines.join("\n");
}

async function mintAccessTokenForUser(userId: string): Promise<string | null> {
  // 1) get email of the user
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!ur.ok) {
    console.error("[mint] admin/users failed", ur.status, await ur.text());
    return null;
  }
  const u = await ur.json();
  const email: string | undefined = u?.email;
  if (!email) {
    console.error("[mint] user has no email", userId);
    return null;
  }

  // 2) generate a magiclink (gives us properties.email_otp + hashed_token)
  const lr = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!lr.ok) {
    console.error("[mint] generate_link failed", lr.status, await lr.text());
    return null;
  }
  const lj = await lr.json();
  const otp: string | undefined = lj?.properties?.email_otp;
  const hashed: string | undefined = lj?.properties?.hashed_token;

  // 3) Try /verify with the OTP first (most reliable), then fallback to hashed token
  // Use type "email" for plain OTP, type "magiclink" for hashed token
  const attempts: Array<{ type: string; token: string }> = [];
  if (otp) attempts.push({ type: "email", token: otp });
  if (hashed) attempts.push({ type: "magiclink", token: hashed });

  for (const attempt of attempts) {
    const vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ type: attempt.type, token: attempt.token, email }),
    });
    if (vr.ok) {
      const vj = await vr.json();
      if (vj?.access_token) return vj.access_token;
    } else {
      console.warn(`[mint] verify ${attempt.type} failed`, vr.status, (await vr.text()).slice(0, 200));
    }
  }
  console.error("[mint] all verify attempts failed");
  return null;
}

// In-memory cache (per function instance) — ok for single-invocation lifetime
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const token = await mintAccessTokenForUser(userId);
  if (token) {
    // Supabase access tokens last 1h by default
    tokenCache.set(userId, { token, expiresAt: Date.now() + 50 * 60_000 });
  }
  return token;
}

async function callChatAi(opts: {
  userId: string;
  text: string;
  mode: "dashboard" | "text";
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const { userId, text, mode, history } = opts;

  const accessToken = await getAccessTokenForUser(userId);

  if (!accessToken) {
    // Fallback: call OpenAI directly with no DB tool access (text-only response)
    if (!OPENAI_API_KEY) return "⚠️ No pude autenticarte para consultar la base. Pide soporte para revisar el vínculo de tu cuenta.";
    console.warn("[callChatAi] no access token, falling back to direct OpenAI");
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres asistente analítico de Convertía. Responde breve en español. Aclara que no tienes acceso a la base ahora." },
          ...history.slice(-6),
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });
    const j = await r.json();
    return j?.choices?.[0]?.message?.content || "Sin respuesta.";
  }

  const messages = [...history.slice(-8), { role: "user", content: text }];
  const payload: Record<string, unknown> = { messages };
  if (mode === "dashboard") payload.mode = "dashdinamics";

  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-ai`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("chat-ai err", res.status, t);
    return `⚠️ Error del asistente (${res.status}).`;
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const j = await res.json();
    if (mode === "dashboard") {
      // chat-ai returns SSE for dashboard mode; this branch unlikely. Try parse.
      if (j.response_mode === "dashboard") return dashboardToText(j.dashboard, j.assistant_message || "");
      return j.assistant_message || j.reply || JSON.stringify(j).slice(0, 1500);
    }
    return j.reply || j.assistant_message || JSON.stringify(j).slice(0, 1500);
  }

  // SSE streaming -> accumulate
  if (!res.body) return "Sin respuesta.";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let acc = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const p = JSON.parse(data);
        const c = p.choices?.[0]?.delta?.content;
        if (c) acc += c;
      } catch { /* skip */ }
    }
  }

  if (mode === "dashboard") {
    // try to parse JSON from acc
    const match = acc.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj.response_mode === "dashboard" && obj.dashboard) {
          return dashboardToText(obj.dashboard, obj.assistant_message || "");
        }
        return obj.assistant_message || acc;
      } catch { /* fallthrough */ }
    }
  }
  return acc.trim() || "Sin respuesta.";
}

async function processUpdate(update: any, admin: ReturnType<typeof createClient>) {
  const msg = update.message;
  if (!msg || !msg.chat) return;
  const chatId: number = msg.chat.id;
  const text: string = (msg.text || "").trim();
  const updateId: number = update.update_id;
  const username = msg.from?.username || null;
  const firstName = msg.from?.first_name || null;

  console.log(`[handler] update=${updateId} chat=${chatId} text="${text.slice(0, 80)}"`);

  // Idempotency: skip if already FULLY processed
  const { data: existing } = await admin
    .from("telegram_messages")
    .select("update_id, status")
    .eq("update_id", updateId)
    .maybeSingle();
  if (existing && existing.status === "processed") {
    console.log(`[handler] skip update=${updateId} already processed`);
    return;
  }

  if (!existing) {
    await admin.from("telegram_messages").insert({
      update_id: updateId,
      chat_id: chatId,
      direction: "in",
      message_text: text,
      raw: update,
      status: "received",
    });
  }


  if (!text) {
    await tgSend(chatId, "Solo proceso mensajes de texto por ahora.");
    return;
  }

  // /start CODE  -> link account
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const code = parts[1]?.toUpperCase();
    if (!code) {
      await tgSend(
        chatId,
        "👋 *Bienvenido a Convertía IA Insights*\n\nPara conectar tu cuenta:\n1. Ve a *Configuración → Telegram* en la app\n2. Genera un código de vinculación\n3. Envíame: `/start TU_CODIGO`",
      );
      return;
    }
    const { data: linkCode } = await admin
      .from("telegram_link_codes")
      .select("*")
      .eq("code", code)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!linkCode) {
      await tgSend(chatId, "❌ Código inválido o expirado. Genera uno nuevo en la app.");
      return;
    }
    await admin.from("telegram_user_links").upsert({
      chat_id: chatId,
      user_id: linkCode.user_id,
      tenant_id: linkCode.tenant_id,
      bot_id: linkCode.bot_id,
      mode: linkCode.mode,
      telegram_username: username,
      telegram_first_name: firstName,
      is_active: true,
      linked_at: new Date().toISOString(),
    });
    await admin.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);
    await tgSend(
      chatId,
      `✅ *Cuenta vinculada correctamente*\n\nHola ${firstName || username || ""}! Ya puedes consultarme.\n\n💬 Pregúntame en lenguaje natural:\n• "Ventas de hoy"\n• "Top 10 agentes esta semana"\n• "Dashboard de campañas del mes"\n\nUsa /modo para cambiar entre texto y dashboards.\nUsa /desvincular para desconectar.`,
    );
    return;
  }

  // Find link for this chat
  const { data: link } = await admin
    .from("telegram_user_links")
    .select("*")
    .eq("chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  if (!link) {
    await tgSend(
      chatId,
      "🔒 Tu chat no está vinculado a una cuenta.\n\nGenera un código en *Configuración → Telegram* en la app y envíalo así:\n`/start TU_CODIGO`",
    );
    return;
  }

  // Commands
  if (text.startsWith("/help") || text === "/?") {
    await tgSend(chatId,
      "*Comandos disponibles*\n\n" +
      "/modo `auto|texto|dashboard` — Cambiar modo de respuesta\n" +
      "/desvincular — Desconectar este chat\n" +
      "/help — Mostrar esta ayuda\n\n" +
      "💬 Escríbeme cualquier consulta en lenguaje natural.");
    return;
  }
  if (text.startsWith("/modo")) {
    const m = text.split(/\s+/)[1]?.toLowerCase();
    const allowed = ["auto", "texto", "text", "dashboard"];
    if (!m || !allowed.includes(m)) {
      await tgSend(chatId, `Modo actual: *${link.mode}*\n\nUsa: /modo auto | texto | dashboard`);
      return;
    }
    const norm = m === "texto" ? "text" : m;
    await admin.from("telegram_user_links").update({ mode: norm }).eq("chat_id", chatId);
    await tgSend(chatId, `✅ Modo cambiado a: *${norm}*`);
    return;
  }
  if (text.startsWith("/desvincular") || text.startsWith("/logout")) {
    await admin.from("telegram_user_links").update({ is_active: false }).eq("chat_id", chatId);
    await tgSend(chatId, "👋 Chat desvinculado. Hasta pronto.");
    return;
  }

  // Update last_message_at
  await admin.from("telegram_user_links").update({ last_message_at: new Date().toISOString() }).eq("chat_id", chatId);

  // Fetch short conversation history
  const { data: hist } = await admin
    .from("telegram_messages")
    .select("direction, message_text, reply_text")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(6);
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (const h of (hist || []).reverse()) {
    if (h.direction === "in" && h.message_text) history.push({ role: "user", content: h.message_text });
    if (h.direction === "out" && h.reply_text) history.push({ role: "assistant", content: h.reply_text });
  }

  // Determine mode
  const effectiveMode = link.mode === "auto" ? detectMode(text) : (link.mode as "text" | "dashboard");

  await tgSendChatAction(chatId, "typing");

  let reply = "";
  try {
    reply = await callChatAi({
      userId: link.user_id,
      text,
      mode: effectiveMode,
      history: history.slice(0, -1), // exclude current message
    });
  } catch (e) {
    console.error("callChatAi error:", e);
    reply = "⚠️ Ocurrió un error procesando tu consulta. Intenta de nuevo.";
  }

  await tgSend(chatId, reply || "Sin respuesta.");

  try {
    await admin.from("telegram_messages").insert({
      update_id: -(Date.now()), // synthetic negative id, unique per ms
      chat_id: chatId,
      user_id: link.user_id,
      tenant_id: link.tenant_id,
      direction: "out",
      reply_text: reply,
      status: "sent",
    });
  } catch (e) {
    console.error("[handler] outbound insert err:", e);
  }
  await admin.from("telegram_messages").update({
    status: "processed",
    user_id: link.user_id,
    tenant_id: link.tenant_id,
  }).eq("update_id", updateId);
  console.log(`[handler] done update=${updateId} replyLen=${reply.length}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (req.method === "GET") {
      // health check
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));

    // Two modes:
    //  1. invoked by telegram-poll: { updates: [...] }
    //  2. invoked as webhook (future): a single update object
    const updates: any[] = Array.isArray(body.updates) ? body.updates : (body.update_id ? [body] : []);

    let processed = 0;
    for (const u of updates) {
      try {
        await processUpdate(u, admin);
        processed++;
      } catch (e) {
        console.error("processUpdate err:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("handler error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

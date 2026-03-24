import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, Plus, MessageSquare, Settings2, Trash2, Power, PowerOff, Loader2, Link2, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface BotRow {
  id: string; name: string; channel: string; system_prompt: string;
  model: string; is_active: boolean; n8n_workflow_id: string | null; config: any; created_at: string;
}

interface ChatMsg { id: string; role: "user" | "assistant"; content: string; created_at: string; }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

export default function BotsPage() {
  const { user } = useAuth();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBot, setEditBot] = useState<BotRow | null>(null);
  const [activeBot, setActiveBot] = useState<BotRow | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", channel: "web", system_prompt: "Eres un asistente inteligente de análisis de datos.",
    model: "gpt-4o-mini", n8n_workflow_id: "", n8n_webhook_url: "",
    dataSources: ["leads"] as string[], responseMode: "prompt" as "prompt" | "n8n",
  });
  const { toast } = useToast();

  const fetchBots = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setBots((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBots(); }, []);

  const getBotConfig = (bot: BotRow) => {
    const cfg = bot.config as any;
    const mode = cfg?.responseMode || (cfg?.n8n_webhook_url ? "n8n" : "prompt");
    return { dataSource: cfg?.dataSources?.[0] || "leads", webhookUrl: mode === "n8n" ? (cfg?.n8n_webhook_url || null) : null, responseMode: mode };
  };

  // Load or create conversation for bot+user
  const openChat = async (bot: BotRow) => {
    setActiveBot(bot);
    setMessages([]);
    setChatInput("");
    setConversationId(null);

    if (!user) return;
    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

    // Find existing conversation
    const { data: convs } = await supabase
      .from("bot_conversations")
      .select("id")
      .eq("bot_id", bot.id)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1);

    let convId: string;
    if (convs && convs.length > 0) {
      convId = convs[0].id;
    } else {
      const { data: newConv } = await supabase
        .from("bot_conversations")
        .insert({ bot_id: bot.id, user_id: user.id, tenant_id: tenantId, title: `Chat con ${bot.name}` })
        .select("id")
        .single();
      if (!newConv) return;
      convId = newConv.id;
    }
    setConversationId(convId);

    // Load messages
    const { data: msgs } = await supabase
      .from("bot_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (msgs) {
      setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })));
    }
  };

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading || !activeBot || !conversationId) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    // Save user message to DB
    const { data: savedUser } = await supabase.from("bot_messages")
      .insert({ conversation_id: conversationId, role: "user", content: text })
      .select("id, role, content, created_at").single();

    if (savedUser) setMessages(prev => [...prev, savedUser as ChatMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cfg = getBotConfig(activeBot);
      const allMsgs = [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: text }];

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: allMsgs, botId: activeBot.id, dataSource: cfg.dataSource, webhookUrl: cfg.webhookUrl }),
      });

      let reply: string;
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error" }));
        reply = `⚠️ ${err.error || "Error de conexión"}`;
      } else {
        const ct = resp.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await resp.json();
          reply = data.reply || data.error || "Sin respuesta";
        } else if (resp.body) {
          // Stream
          let acc = "";
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let ni: number;
            while ((ni = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, ni); buf = buf.slice(ni + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") break;
              try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) acc += c; } catch {}
            }
          }
          reply = acc || "Sin respuesta";
        } else {
          reply = "Sin respuesta";
        }
      }

      // Save assistant message to DB
      const { data: savedAss } = await supabase.from("bot_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: reply })
        .select("id, role, content, created_at").single();

      if (savedAss) setMessages(prev => [...prev, savedAss as ChatMsg]);
    } catch (e: any) {
      const errContent = `⚠️ Error: ${e.message}`;
      await supabase.from("bot_messages").insert({ conversation_id: conversationId, role: "assistant", content: errContent });
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: errContent, created_at: new Date().toISOString() }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, activeBot, conversationId, messages]);

  const handleSave = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: u.id });
    const payload = {
      name: form.name, channel: form.channel, system_prompt: form.system_prompt, model: form.model,
      n8n_workflow_id: form.n8n_workflow_id || null, tenant_id: tenantId,
      config: { dataSources: form.dataSources, n8n_webhook_url: form.responseMode === "n8n" ? form.n8n_webhook_url : null, responseMode: form.responseMode },
    };
    if (editBot) {
      await supabase.from("bots").update(payload).eq("id", editBot.id);
      toast({ title: "Bot actualizado" });
    } else {
      await supabase.from("bots").insert(payload);
      toast({ title: "Bot creado" });
    }
    setShowForm(false); setEditBot(null);
    setForm({ name: "", channel: "web", system_prompt: "Eres un asistente inteligente de análisis de datos.", model: "gpt-4o-mini", n8n_workflow_id: "", n8n_webhook_url: "", dataSources: ["leads"], responseMode: "prompt" });
    fetchBots();
  };

  const toggleBot = async (bot: BotRow) => { await supabase.from("bots").update({ is_active: !bot.is_active }).eq("id", bot.id); fetchBots(); };
  const deleteBot = async (id: string) => { await supabase.from("bots").delete().eq("id", id); if (activeBot?.id === id) { setActiveBot(null); setMessages([]); } fetchBots(); };
  const openEdit = (bot: BotRow) => {
    setEditBot(bot); const cfg = bot.config as any;
    setForm({ name: bot.name, channel: bot.channel, system_prompt: bot.system_prompt, model: bot.model,
      n8n_workflow_id: bot.n8n_workflow_id || "", n8n_webhook_url: cfg?.n8n_webhook_url || "",
      dataSources: cfg?.dataSources || ["leads"], responseMode: cfg?.responseMode || "prompt" });
    setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Chatbots / AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Administra agentes inteligentes para tus canales</p>
        </div>
        <Button onClick={() => { setEditBot(null); setForm({ name: "", channel: "web", system_prompt: "Eres un asistente inteligente de análisis de datos.", model: "gpt-4o-mini", n8n_workflow_id: "", n8n_webhook_url: "", dataSources: ["leads"], responseMode: "prompt" }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Bot
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
        <div className="space-y-3">
          {bots.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground text-sm">No hay bots configurados</p>
            </div>
          ) : bots.map((bot, i) => {
            const cfg = getBotConfig(bot);
            return (
              <motion.div key={bot.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md ${activeBot?.id === bot.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                onClick={() => openChat(bot)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{bot.name}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant={bot.is_active ? "default" : "outline"} className="text-[10px]">{bot.is_active ? "Activo" : "Inactivo"}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{cfg.responseMode === "n8n" ? "n8n" : "IA"}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toggleBot(bot); }}>
                      {bot.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(bot); }}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteBot(bot.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Chat area with DB persistence */}
        <div className="h-[600px] border border-border rounded-xl bg-card/30 overflow-hidden flex flex-col">
          {activeBot ? (
            <>
              <div className="p-3 border-b border-border bg-card/50 flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{activeBot.name}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{messages.length} msgs</Badge>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1"><Bot className="h-3 w-3 text-primary" /></div>}
                      <div className={`rounded-lg text-sm px-3 py-2 max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 mt-1"><User className="h-3 w-3" /></div>}
                    </div>
                  ))}
                  {chatLoading && <div className="flex gap-2"><div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center"><Bot className="h-3 w-3 text-primary" /></div><div className="bg-muted rounded-lg px-3 py-2"><Loader2 className="h-4 w-4 animate-spin" /></div></div>}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border bg-card/50 flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={`Escribe a ${activeBot.name}...`}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
                <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim() || chatLoading}><Send className="h-4 w-4" /></Button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Selecciona un bot para chatear</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editBot ? "Editar Bot" : "Nuevo Bot"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium mb-1 block">Nombre</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-sm font-medium mb-1 block">Canal</label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="web">Web</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="telegram">Telegram</SelectItem></SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">Prompt del sistema</label><Textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={4} /></div>
            <div>
              <label className="text-sm font-medium mb-2 block">Modo de respuesta</label>
              <div className="grid grid-cols-2 gap-2">
                {(["prompt", "n8n"] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setForm({ ...form, responseMode: mode })}
                    className={`p-3 rounded-lg border text-left transition-colors ${form.responseMode === mode ? "border-primary bg-primary/10" : "border-border bg-muted/50 hover:bg-muted"}`}>
                    <p className="text-sm font-medium">{mode === "prompt" ? "🤖 Prompt / IA" : "🔗 n8n Webhook"}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.responseMode === "n8n" && (
              <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                <div><label className="text-xs font-medium mb-1 block">Webhook URL *</label><Input value={form.n8n_webhook_url} onChange={(e) => setForm({ ...form, n8n_webhook_url: e.target.value })} className="text-xs" /></div>
                <div><label className="text-xs font-medium mb-1 block">Workflow ID</label><Input value={form.n8n_workflow_id} onChange={(e) => setForm({ ...form, n8n_workflow_id: e.target.value })} className="text-xs" /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || (form.responseMode === "n8n" && !form.n8n_webhook_url.trim())}>{editBot ? "Guardar" : "Crear Bot"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

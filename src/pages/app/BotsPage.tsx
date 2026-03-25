import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Bot, Plus, MessageSquare, Settings2, Trash2, Power, PowerOff, Loader2, Send, User } from "lucide-react";
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
import ReactMarkdown from "react-markdown";

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
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: "", channel: "web", system_prompt: "Eres un asistente inteligente de análisis de datos.",
    model: "gpt-4o-mini", n8n_workflow_id: "", n8n_webhook_url: "",
    dataSources: ["leads"] as string[], responseMode: "prompt" as "prompt" | "n8n",
  });
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const fetchBots = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setBots((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBots(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const getBotConfig = (bot: BotRow) => {
    const cfg = bot.config as any;
    const mode = cfg?.responseMode || (cfg?.n8n_webhook_url ? "n8n" : "prompt");
    return { dataSource: cfg?.dataSources?.[0] || "leads", webhookUrl: mode === "n8n" ? (cfg?.n8n_webhook_url || null) : null, responseMode: mode };
  };

  const openChat = async (bot: BotRow) => {
    setActiveBot(bot);
    setMessages([]);
    setChatInput("");
    setConversationId(null);

    if (!user) return;
    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

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
          <h1 className="text-2xl font-display font-bold tracking-tight">Chatbots / AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Administra agentes inteligentes para tus canales</p>
        </div>
        <Button onClick={() => { setEditBot(null); setForm({ name: "", channel: "web", system_prompt: "Eres un asistente inteligente de análisis de datos.", model: "gpt-4o-mini", n8n_workflow_id: "", n8n_webhook_url: "", dataSources: ["leads"], responseMode: "prompt" }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Bot
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
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
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><Bot className="h-5 w-5 text-primary" /></div>
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

        {/* Chat area */}
        <div className="h-[650px] border border-border rounded-xl bg-card/30 overflow-hidden flex flex-col">
          {activeBot ? (
            <>
              <div className="p-4 border-b border-border bg-card/50 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold">{activeBot.name}</span>
                  <p className="text-[11px] text-muted-foreground">Agente IA activo</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{messages.length} msgs</Badge>
              </div>
              <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Bot className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">Inicia una conversación con {activeBot.name}</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className={`rounded-xl text-sm px-4 py-3 max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div>
                      <div className="bg-muted rounded-xl px-4 py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-4 border-t border-border bg-card/50">
                <div className="flex gap-3">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Escribe tu pregunta a ${activeBot.name}...`}
                    className="min-h-[56px] max-h-[120px] resize-none bg-background text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim() || chatLoading} className="h-14 w-14 rounded-xl flex-shrink-0">
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Selecciona un bot para chatear</p>
                <p className="text-xs mt-1">Elige un agente de la lista para comenzar</p>
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

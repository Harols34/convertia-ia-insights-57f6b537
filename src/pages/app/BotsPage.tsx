import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Plus, MessageSquare, Settings2, Trash2, Power, PowerOff, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChatWindow } from "@/components/app/ChatWindow";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BotRow {
  id: string;
  name: string;
  channel: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  n8n_workflow_id: string | null;
  config: any;
  created_at: string;
}

const AVAILABLE_TABLES = [
  { value: "leads", label: "Leads", description: "Datos de marketing, gestiones y negocios" },
];

export default function BotsPage() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBot, setEditBot] = useState<BotRow | null>(null);
  const [activeBot, setActiveBot] = useState<BotRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    channel: "web",
    system_prompt: "Eres un asistente inteligente de análisis de datos.",
    model: "gpt-4o-mini",
    n8n_workflow_id: "",
    n8n_webhook_url: "",
    dataSources: ["leads"] as string[],
    responseMode: "prompt" as "prompt" | "n8n",
  });
  const { messages, isLoading: chatLoading, sendMessage, clearMessages } = useStreamChat();
  const { toast } = useToast();

  const fetchBots = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setBots((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBots(); }, []);

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

    const payload = {
      name: form.name,
      channel: form.channel,
      system_prompt: form.system_prompt,
      model: form.model,
      n8n_workflow_id: form.n8n_workflow_id || null,
      tenant_id: tenantId,
      config: {
        dataSources: form.dataSources,
        n8n_webhook_url: form.responseMode === "n8n" ? (form.n8n_webhook_url || null) : null,
        responseMode: form.responseMode,
      },
    };

    if (editBot) {
      await supabase.from("bots").update(payload).eq("id", editBot.id);
      toast({ title: "Bot actualizado" });
    } else {
      await supabase.from("bots").insert(payload);
      toast({ title: "Bot creado" });
    }
    setShowForm(false);
    setEditBot(null);
    setForm({ name: "", channel: "web", system_prompt: "Eres un asistente inteligente de análisis de datos.", model: "gpt-4o-mini", n8n_workflow_id: "", n8n_webhook_url: "", dataSources: ["leads"], responseMode: "prompt" });
    fetchBots();
  };

  const toggleBot = async (bot: BotRow) => {
    await supabase.from("bots").update({ is_active: !bot.is_active }).eq("id", bot.id);
    fetchBots();
  };

  const deleteBot = async (id: string) => {
    await supabase.from("bots").delete().eq("id", id);
    if (activeBot?.id === id) setActiveBot(null);
    fetchBots();
  };

  const openEdit = (bot: BotRow) => {
    setEditBot(bot);
    const cfg = bot.config as any;
    setForm({
      name: bot.name,
      channel: bot.channel,
      system_prompt: bot.system_prompt,
      model: bot.model,
      n8n_workflow_id: bot.n8n_workflow_id || "",
      n8n_webhook_url: cfg?.n8n_webhook_url || "",
      dataSources: cfg?.dataSources || ["leads"],
      responseMode: cfg?.responseMode || (cfg?.n8n_webhook_url ? "n8n" : "prompt"),
    });
    setShowForm(true);
  };

  const openChat = (bot: BotRow) => {
    setActiveBot(bot);
    clearMessages();
  };

  const toggleDataSource = (value: string) => {
    setForm((prev) => {
      const current = prev.dataSources;
      if (current.includes(value)) {
        if (current.length === 1) return prev;
        return { ...prev, dataSources: current.filter((v) => v !== value) };
      }
      return { ...prev, dataSources: [...current, value] };
    });
  };

  const channelLabel: Record<string, string> = { web: "Web", whatsapp: "WhatsApp", telegram: "Telegram", webchat: "Webchat" };

  const getBotConfig = (bot: BotRow) => {
    const cfg = bot.config as any;
    const mode = cfg?.responseMode || (cfg?.n8n_webhook_url ? "n8n" : "prompt");
    return {
      dataSource: cfg?.dataSources?.[0] || "leads",
      webhookUrl: mode === "n8n" ? (cfg?.n8n_webhook_url || null) : null,
      responseMode: mode,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
        {/* Bot list */}
        <div className="space-y-3">
          {bots.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground text-sm">No hay bots configurados</p>
              <Button className="mt-4" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Crear primer bot
              </Button>
            </div>
          ) : (
            bots.map((bot, i) => {
              const cfg = getBotConfig(bot);
              return (
                <motion.div
                  key={bot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md ${
                    activeBot?.id === bot.id ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                  onClick={() => openChat(bot)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{bot.name}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{channelLabel[bot.channel] || bot.channel}</Badge>
                          <Badge variant={bot.is_active ? "default" : "outline"} className="text-[10px]">
                            {bot.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            {cfg.responseMode === "n8n" ? (
                              <><Link2 className="h-2.5 w-2.5" /> n8n</>
                            ) : "Prompt/IA"}
                          </Badge>
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
            })
          )}
        </div>

        {/* Chat area */}
        <div className="h-[600px]">
          {activeBot ? (
            <ChatWindow
              messages={messages}
              onSend={(text) => {
                const cfg = getBotConfig(activeBot);
                sendMessage(text, {
                  botId: activeBot.id,
                  dataSource: cfg.dataSource,
                  webhookUrl: cfg.webhookUrl,
                });
              }}
              isLoading={chatLoading}
              placeholder={`Chatea con ${activeBot.name}...`}
            />
          ) : (
            <div className="h-full rounded-xl border border-dashed border-border flex items-center justify-center">
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
          <DialogHeader>
            <DialogTitle>{editBot ? "Editar Bot" : "Nuevo Bot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asistente de Ventas" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Canal</label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tablas de datos</label>
              <p className="text-xs text-muted-foreground mb-2">Selecciona las tablas que este bot podrá consultar</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TABLES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleDataSource(t.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      form.dataSources.includes(t.value)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    📊 {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prompt del sistema</label>
              <Textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={4} />
            </div>

            {/* Response Mode */}
            <div>
              <label className="text-sm font-medium mb-2 block">Modo de respuesta</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, responseMode: "prompt" })}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    form.responseMode === "prompt"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium">🤖 Prompt / IA</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Usa la Edge Function con OpenAI para responder</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, responseMode: "n8n" })}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    form.responseMode === "n8n"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium">🔗 n8n Webhook</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Envía el mensaje a un workflow de n8n</p>
                </button>
              </div>
            </div>

            {/* n8n config - only when n8n mode */}
            {form.responseMode === "n8n" && (
              <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Configuración n8n</span>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Webhook URL <span className="text-destructive">*</span></label>
                  <Input
                    value={form.n8n_webhook_url}
                    onChange={(e) => setForm({ ...form, n8n_webhook_url: e.target.value })}
                    placeholder="https://tu-n8n.com/webhook/abc123..."
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Workflow ID (opcional)</label>
                  <Input
                    value={form.n8n_workflow_id}
                    onChange={(e) => setForm({ ...form, n8n_workflow_id: e.target.value })}
                    placeholder="workflow-id"
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || (form.responseMode === "n8n" && !form.n8n_webhook_url.trim())}>
              {editBot ? "Guardar Cambios" : "Crear Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

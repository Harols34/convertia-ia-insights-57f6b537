import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Plus,
  MessageSquare,
  Settings2,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Send,
  User,
  Sparkles,
  Search,
  Pencil,
  Check,
  X,
  ChevronDown,
  History,
  Zap,
  GripHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperAdmin } from "@/hooks/use-app-access";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { resolveWritableTenantId } from "@/lib/accessible-tenant";

interface BotRow {
  id: string;
  name: string;
  channel: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  n8n_workflow_id: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  tenant_id: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ConvSummary {
  id: string;
  title: string | null;
  created_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

export default function BotsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBot, setEditBot] = useState<BotRow | null>(null);
  const [activeBot, setActiveBot] = useState<BotRow | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [headerTitleEditing, setHeaderTitleEditing] = useState(false);
  const [headerTitleDraft, setHeaderTitleDraft] = useState("");
  const [editingListConvId, setEditingListConvId] = useState<string | null>(null);
  const [listTitleDraft, setListTitleDraft] = useState("");

  const { data: isSuperAdmin = false } = useIsSuperAdmin();
  const [showIaWizard, setShowIaWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardContext, setWizardContext] = useState("");
  const [wizardGenerating, setWizardGenerating] = useState(false);

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

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const fetchBots = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setBots((data as BotRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const getBotConfig = (bot: BotRow) => {
    const cfg = (bot.config || {}) as Record<string, unknown>;
    const mode = (cfg.responseMode as string) || (cfg.n8n_webhook_url ? "n8n" : "prompt");
    return {
      dataSource: Array.isArray(cfg.dataSources) ? (cfg.dataSources as string[])[0] : "leads",
      webhookUrl: mode === "n8n" ? (cfg.n8n_webhook_url as string) || null : null,
      responseMode: mode as "prompt" | "n8n",
    };
  };

  const currentConvTitle = conversations.find((c) => c.id === conversationId)?.title || "";

  const loadConversations = async (botId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("bot_conversations")
      .select("id, title, created_at")
      .eq("bot_id", botId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setConversations((data as ConvSummary[]) || []);
  };

  const loadMessages = async (convId: string) => {
    const { data: msgs } = await supabase
      .from("bot_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (msgs) {
      setMessages(
        msgs.map((m: { id: string; role: string; content: string; created_at: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          created_at: m.created_at,
        })),
      );
    } else {
      setMessages([]);
    }
  };

  const openChat = async (bot: BotRow) => {
    setActiveBot(bot);
    setChatInput("");
    setHeaderTitleEditing(false);
    if (!user) return;

    await loadConversations(bot.id);

    const { data: convs } = await supabase
      .from("bot_conversations")
      .select("id, title, created_at")
      .eq("bot_id", bot.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    let convId: string;
    if (convs && convs.length > 0) {
      convId = convs[0].id;
    } else {
      const tenantId = await resolveWritableTenantId(user.id, bot.tenant_id);
      if (!tenantId) {
        toast({ title: "No se encontró una cuenta accesible", variant: "destructive" });
        return;
      }
      const { data: newConv } = await supabase
        .from("bot_conversations")
        .insert({
          bot_id: bot.id,
          user_id: user.id,
          tenant_id: tenantId,
          title: `Chat · ${bot.name}`,
        })
        .select("id")
        .single();
      if (!newConv) return;
      convId = newConv.id;
      await loadConversations(bot.id);
    }
    setConversationId(convId);
    await loadMessages(convId);
  };

  const startNewConversation = async () => {
    if (!activeBot || !user) return;
    const tenantId = await resolveWritableTenantId(user.id, activeBot.tenant_id);
    if (!tenantId) {
      toast({ title: "No se encontró una cuenta accesible", variant: "destructive" });
      return;
    }
    const { data: newConv, error } = await supabase
      .from("bot_conversations")
      .insert({
        bot_id: activeBot.id,
        user_id: user.id,
        tenant_id: tenantId,
        title: "Nueva conversación",
      })
      .select("id, title, created_at")
      .single();
    if (error || !newConv) {
      toast({ title: "No se pudo crear la sesión", variant: "destructive" });
      return;
    }
    setConversationId(newConv.id);
    setMessages([]);
    await loadConversations(activeBot.id);
    setShowSessionDialog(false);
    toast({ title: "Nueva conversación" });
  };

  const openConversation = async (c: ConvSummary) => {
    setConversationId(c.id);
    setShowSessionDialog(false);
    setEditingListConvId(null);
    await loadMessages(c.id);
  };

  const persistConvTitle = async (convId: string, raw: string) => {
    const title = raw.trim() || "Sin título";
    const { error } = await supabase.from("bot_conversations").update({ title }).eq("id", convId);
    if (error) {
      toast({ title: "No se pudo guardar el título", description: error.message, variant: "destructive" });
      return false;
    }
    setConversations((prev) => prev.map((x) => (x.id === convId ? { ...x, title } : x)));
    return true;
  };

  const saveListConvTitle = async (cid: string) => {
    const ok = await persistConvTitle(cid, listTitleDraft);
    if (ok) {
      setEditingListConvId(null);
      if (showSessionDialog) void loadConversations(activeBot!.id);
    }
  };

  const filteredSessions = conversations.filter((c) => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return true;
    return (c.title || "").toLowerCase().includes(q);
  });

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading || !activeBot || !conversationId) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    const { data: savedUser } = await supabase
      .from("bot_messages")
      .insert({ conversation_id: conversationId, role: "user", content: text })
      .select("id, role, content, created_at")
      .single();

    if (savedUser) setMessages((prev) => [...prev, savedUser as ChatMsg]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const cfg = getBotConfig(activeBot);
      const prior = messages.map((m) => ({ role: m.role, content: m.content }));
      const allMsgs = [...prior, { role: "user" as const, content: text }];

      if (prior.length === 0 && savedUser) {
        const short = text.slice(0, 72);
        await persistConvTitle(conversationId, short);
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          messages: allMsgs,
          botId: activeBot.id,
          mode: "bot",
          dataSource: cfg.dataSource,
          webhookUrl: cfg.webhookUrl,
        }),
      });

      let reply: string;
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error" }));
        reply = `⚠️ ${(err as { error?: string }).error || "Error de conexión"}`;
      } else {
        const ct = resp.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await resp.json();
          reply = (data as { reply?: string }).reply || (data as { error?: string }).error || "Sin respuesta";
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
              let line = buf.slice(0, ni);
              buf = buf.slice(ni + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") break;
              try {
                const p = JSON.parse(json);
                const c = p.choices?.[0]?.delta?.content;
                if (c) acc += c;
              } catch {
                /* ignore */
              }
            }
          }
          reply = acc || "Sin respuesta";
        } else {
          reply = "Sin respuesta";
        }
      }

      const { data: savedAss } = await supabase
        .from("bot_messages")
        .insert({ conversation_id: conversationId, role: "assistant", content: reply })
        .select("id, role, content, created_at")
        .single();

      if (savedAss) setMessages((prev) => [...prev, savedAss as ChatMsg]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      const errContent = `⚠️ Error: ${msg}`;
      await supabase.from("bot_messages").insert({ conversation_id: conversationId, role: "assistant", content: errContent });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: errContent,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, activeBot, conversationId, messages, toast]);

  const handleSave = async (opts?: { closeWizard?: boolean }) => {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) return;
    const tenantId = await resolveWritableTenantId(u.id, editBot?.tenant_id ?? null);
    if (!tenantId) {
      toast({ title: "No se encontró una cuenta accesible", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      channel: form.channel,
      system_prompt: form.system_prompt,
      model: form.model,
      n8n_workflow_id: form.n8n_workflow_id || null,
      tenant_id: tenantId,
      config: {
        dataSources: form.dataSources,
        n8n_webhook_url: form.responseMode === "n8n" ? form.n8n_webhook_url : null,
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
    if (opts?.closeWizard) {
      setShowIaWizard(false);
      setWizardStep(1);
      setWizardContext("");
    }
    setForm({
      name: "",
      channel: "web",
      system_prompt: "Eres un asistente inteligente de análisis de datos.",
      model: "gpt-4o-mini",
      n8n_workflow_id: "",
      n8n_webhook_url: "",
      dataSources: ["leads"],
      responseMode: "prompt",
    });
    fetchBots();
  };

  const runWizardGenerate = async () => {
    const ctx = wizardContext.trim();
    if (!ctx) {
      toast({ title: "Describe primero el contexto del bot", variant: "destructive" });
      return;
    }
    setWizardGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mode: "bot_builder", contextDescription: ctx }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Error", description: data.error || resp.statusText, variant: "destructive" });
        return;
      }
      const sp = (data as { system_prompt?: string }).system_prompt || "";
      if (!sp) {
        toast({ title: "Respuesta vacía", variant: "destructive" });
        return;
      }
      setForm((f) => ({ ...f, system_prompt: sp }));
      setWizardStep(2);
      toast({ title: "Prompt generado", description: "Revísalo y completa el nombre antes de crear." });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setWizardGenerating(false);
    }
  };

  const finishWizardCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: "Indica un nombre para el bot", variant: "destructive" });
      return;
    }
    await handleSave({ closeWizard: true });
  };

  const toggleBot = async (bot: BotRow) => {
    await supabase.from("bots").update({ is_active: !bot.is_active }).eq("id", bot.id);
    fetchBots();
  };

  const deleteBot = async (id: string) => {
    await supabase.from("bots").delete().eq("id", id);
    if (activeBot?.id === id) {
      setActiveBot(null);
      setMessages([]);
      setConversationId(null);
      setConversations([]);
    }
    fetchBots();
  };

  const openEdit = (bot: BotRow) => {
    setEditBot(bot);
    const cfg = (bot.config || {}) as Record<string, unknown>;
    setForm({
      name: bot.name,
      channel: bot.channel,
      system_prompt: bot.system_prompt,
      model: bot.model,
      n8n_workflow_id: bot.n8n_workflow_id || "",
      n8n_webhook_url: (cfg.n8n_webhook_url as string) || "",
      dataSources: (cfg.dataSources as string[]) || ["leads"],
      responseMode: (cfg.responseMode as "prompt" | "n8n") || "prompt",
    });
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <div className="sticky top-0 z-20 -mx-6 mb-4 shrink-0 border-b border-border/60 bg-background/95 px-6 py-3 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Chatbots / AI Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Agentes conversacionales vía Edge Function (sin n8n por defecto). Datos tabulares: usa Dashboard IA o Analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin ? (
            <>
              <Button
                onClick={() => {
                  setEditBot(null);
                  setWizardStep(1);
                  setWizardContext("");
                  setForm({
                    name: "",
                    channel: "web",
                    system_prompt: "Eres un asistente inteligente de análisis de datos.",
                    model: "gpt-4o-mini",
                    n8n_workflow_id: "",
                    n8n_webhook_url: "",
                    dataSources: ["leads"],
                    responseMode: "prompt",
                  });
                  setShowIaWizard(true);
                }}
                className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:opacity-95"
              >
                <Sparkles className="h-4 w-4" /> Nuevo bot (IA)
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditBot(null);
                  setForm({
                    name: "",
                    channel: "web",
                    system_prompt: "Eres un asistente inteligente de análisis de datos.",
                    model: "gpt-4o-mini",
                    n8n_workflow_id: "",
                    n8n_webhook_url: "",
                    dataSources: ["leads"],
                    responseMode: "prompt",
                  });
                  setShowForm(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Formulario manual
              </Button>
            </>
          ) : (
            <p className="max-w-md text-xs text-muted-foreground">
              Solo un super administrador puede crear o editar bots aquí. Para solicitar uno nuevo, abre un ticket en{" "}
              <Link to="/app/soporte" className="font-medium text-primary underline underline-offset-2">
                Soporte
              </Link>
              .
            </p>
          )}
        </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4 px-0 pb-0 pt-0 lg:gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
        {/* Lista de bots */}
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1 lg:max-h-full">
          {bots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-10 text-center">
              <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No hay bots configurados</p>
            </div>
          ) : (
            bots.map((bot, i) => {
              const cfg = getBotConfig(bot);
              return (
                <motion.div
                  key={bot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "cursor-pointer rounded-xl border p-3.5 transition-all hover:shadow-md",
                    activeBot?.id === bot.id
                      ? "border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-violet-500/5 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]"
                      : "border-border bg-card hover:border-border/80",
                  )}
                  onClick={() => void openChat(bot)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary shadow-inner ring-1 ring-border dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-950 dark:text-cyan-400 dark:ring-white/10">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{bot.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant={bot.is_active ? "default" : "outline"} className="text-[10px]">
                            {bot.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {cfg.responseMode === "n8n" ? "Webhook" : "IA Edge"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleBot(bot);
                          }}
                        >
                          {bot.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(bot);
                          }}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteBot(bot.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Panel chat: ocupa el alto disponible, scroll interno, tema claro/oscuro, redimensionable */}
        <div
          title="Arrastra el borde inferior para cambiar la altura del chat"
          className={cn(
            "relative flex h-full min-h-[280px] min-w-0 flex-col overflow-hidden rounded-2xl border shadow-xl",
            "max-h-full resize-y",
            "border-border bg-card text-card-foreground",
            "bg-gradient-to-br from-background via-card to-muted/40",
            "dark:border-white/10 dark:bg-[radial-gradient(ellipse_at_top,_rgba(6,182,212,0.1),_transparent_55%),linear-gradient(165deg,_#0c1220_0%,_#0a0f18_50%,_#06080f_100%)]",
            "dark:text-card-foreground",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.04)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40 dark:opacity-60" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl dark:bg-cyan-500/15" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-violet-500/5 blur-3xl dark:bg-violet-600/15" />

          {activeBot ? (
            <>
              <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-black/25">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/25 dark:bg-gradient-to-br dark:from-cyan-500/30 dark:to-violet-600/20 dark:ring-cyan-500/30">
                    <Bot className="h-5 w-5 text-primary dark:text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{activeBot.name}</p>
                    {headerTitleEditing ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Input
                          value={headerTitleDraft}
                          onChange={(e) => setHeaderTitleDraft(e.target.value)}
                          className="h-8 max-w-md border-border bg-background text-xs text-foreground"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && conversationId) {
                              void persistConvTitle(conversationId, headerTitleDraft).then((ok) => {
                                if (ok) setHeaderTitleEditing(false);
                              });
                            }
                            if (e.key === "Escape") setHeaderTitleEditing(false);
                          }}
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          onClick={() => {
                            if (conversationId)
                              void persistConvTitle(conversationId, headerTitleDraft).then((ok) => {
                                if (ok) setHeaderTitleEditing(false);
                              });
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setHeaderTitleEditing(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderTitleDraft(currentConvTitle || "Sin título");
                          setHeaderTitleEditing(true);
                        }}
                        className="mt-0.5 flex max-w-full items-center gap-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground dark:text-cyan-200/80 dark:hover:text-cyan-100"
                      >
                        <span className="truncate">{currentConvTitle || "Sin título"}</span>
                        <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      setSessionSearch("");
                      setShowSessionDialog(true);
                    }}
                  >
                    <History className="mr-1.5 h-3.5 w-3.5" /> Sesiones
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => void startNewConversation()}>
                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Nueva
                  </Button>
                  <Badge variant="secondary" className="text-[10px]">
                    {messages.length} mensajes
                  </Badge>
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
              >
                <div className="space-y-5 pr-1">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-muted ring-1 ring-border dark:from-cyan-500/20 dark:to-violet-600/10 dark:ring-white/10">
                        <Sparkles className="h-8 w-8 text-primary dark:text-cyan-300/80" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Canal listo</p>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        Escribe en lenguaje natural. Este agente es textual; para tableros con KPIs usa Dashboard IA.
                      </p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                      {msg.role === "assistant" && (
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-950 dark:ring-cyan-500/20">
                          <Bot className="h-4 w-4 text-primary dark:text-cyan-400" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border border-border bg-muted/80 text-foreground backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/85 dark:text-slate-100",
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none text-foreground dark:prose-invert [&>p]:mb-2 [&_a]:text-primary dark:[&_a]:text-cyan-400">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border dark:bg-slate-700/80 dark:ring-white/10">
                          <User className="h-4 w-4 text-muted-foreground dark:text-slate-200" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border dark:bg-slate-900 dark:ring-cyan-500/20">
                        <Bot className="h-4 w-4 text-primary dark:text-cyan-400" />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/80 px-4 py-3 dark:border-white/10 dark:bg-slate-900/80">
                        <Loader2 className="h-4 w-4 animate-spin text-primary dark:text-cyan-400" />
                        <span className="text-xs text-muted-foreground">Procesando…</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative z-10 shrink-0 border-t border-border bg-muted/30 p-3 backdrop-blur-md dark:border-white/10 dark:bg-black/30">
                <div className="flex gap-3">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Mensaje a ${activeBot.name}…`}
                    className="min-h-[56px] max-h-[120px] resize-none border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => void sendMessage()}
                    disabled={!chatInput.trim() || chatLoading}
                    className="h-14 w-14 shrink-0 rounded-xl shadow-md"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                <p className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  <GripHorizontal className="h-3 w-3 opacity-70" aria-hidden />
                  Redimensionar: borde inferior del panel
                </p>
              </div>
            </>
          ) : (
              <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-muted ring-1 ring-border dark:from-cyan-500/20 dark:to-violet-600/10 dark:ring-white/10">
                <MessageSquare className="h-10 w-10 text-primary/70 dark:text-cyan-300/60" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">Selecciona un agente</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Los bots usan solo el prompt del sistema y la IA de la Edge Function — sin flujos externos obligatorios.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sesiones */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent className="max-h-[85vh] max-w-lg border-border">
          <DialogHeader>
            <DialogTitle>Sesiones de chat</DialogTitle>
            <DialogDescription>
              Busca por título, abre una conversación anterior o crea una nueva. Misma lógica que el historial de Dashboard
              IA, adaptado a bots.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Search className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Buscar por título…"
              value={sessionSearch}
              onChange={(e) => setSessionSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => void startNewConversation()}>
            <Plus className="mr-2 h-4 w-4" /> Nueva conversación
          </Button>
          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-2">
              {filteredSessions.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-stretch gap-1 rounded-lg border p-2",
                    c.id === conversationId ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  {editingListConvId === c.id ? (
                    <div className="flex flex-1 flex-col gap-2">
                      <Input
                        value={listTitleDraft}
                        onChange={(e) => setListTitleDraft(e.target.value)}
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveListConvTitle(c.id);
                          if (e.key === "Escape") setEditingListConvId(null);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => void saveListConvTitle(c.id)}>
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingListConvId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm"
                        onClick={() => void openConversation(c)}
                      >
                        <p className="truncate font-medium">{c.title || "Sin título"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleString("es-CL", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          setEditingListConvId(c.id);
                          setListTitleDraft(c.title || "");
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No hay sesiones que coincidan</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Wizard super admin */}
      <Dialog
        open={showIaWizard}
        onOpenChange={(o) => {
          setShowIaWizard(o);
          if (!o) setWizardStep(1);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" /> Crear bot con asistente IA
            </DialogTitle>
            <DialogDescription>
              Paso 1: describe el contexto. Paso 2: revisa el system prompt generado y pon nombre al bot. Todo ocurre en la
              Edge Function <code className="text-xs">chat-ai</code>.
            </DialogDescription>
          </DialogHeader>
          {wizardStep === 1 ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">¿Qué debe hacer este bot?</label>
              <Textarea
                value={wizardContext}
                onChange={(e) => setWizardContext(e.target.value)}
                rows={6}
                placeholder="Ej.: Asistente de ventas que explique portabilidad WOM, tono formal, nunca invente cifras de campañas…"
                className="resize-none"
              />
              <Button className="w-full gap-2" onClick={() => void runWizardGenerate()} disabled={wizardGenerating}>
                {wizardGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generar system prompt
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre del bot</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Asistente Porta" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Modelo</label>
                <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">System prompt (editable)</label>
                <Textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  Volver
                </Button>
                <Button onClick={() => void finishWizardCreate()} disabled={!form.name.trim()}>
                  Crear bot
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Formulario manual */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editBot ? "Editar bot" : "Nuevo bot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Canal</label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Prompt del sistema</label>
              <Textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={5} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Modelo OpenAI</label>
              <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">Respuesta por defecto</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Las respuestas usan la función <strong>chat-ai</strong> en modo texto (sin herramientas SQL automáticas para
                no mezclar con analytics).
              </p>
            </div>

            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-left text-sm hover:bg-muted/50">
                <ChevronDown className="h-4 w-4" />
                Opcional: webhook externo (legacy)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3 px-0.5">
                <p className="text-[11px] text-muted-foreground">
                  Si configuras URL, las peticiones irán primero al webhook. Vacío = solo IA Edge.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["prompt", "n8n"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm({ ...form, responseMode: mode })}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition-colors",
                        form.responseMode === mode ? "border-primary bg-primary/10" : "border-border bg-muted/50",
                      )}
                    >
                      {mode === "prompt" ? "Solo IA" : "Webhook primero"}
                    </button>
                  ))}
                </div>
                {form.responseMode === "n8n" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Webhook URL</label>
                      <Input
                        value={form.n8n_webhook_url}
                        onChange={(e) => setForm({ ...form, n8n_webhook_url: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Workflow ID</label>
                      <Input
                        value={form.n8n_workflow_id}
                        onChange={(e) => setForm({ ...form, n8n_workflow_id: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={!form.name.trim() || (form.responseMode === "n8n" && !form.n8n_webhook_url.trim())}
            >
              {editBot ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

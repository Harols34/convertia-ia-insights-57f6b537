import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Trash2, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { ResponseRenderer } from "@/components/dashdinamics/ResponseRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { DashMessage, StructuredResponse } from "@/types/dashdinamics";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

const SUGGESTIONS = [
  "Muéstrame un resumen ejecutivo de todos los leads",
  "¿Cuáles son las campañas con mejor conversión?",
  "Analiza el rendimiento por ciudad",
  "¿Qué agentes tienen más ventas cerradas?",
  "Quiero tomar decisiones sobre mis campañas",
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DashDinamicsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load latest session on mount
  useEffect(() => {
    if (!user) return;
    loadLatestSession();
  }, [user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadLatestSession = async () => {
    if (!user) return;
    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
    if (!tenantId) return;

    const { data: sessions } = await supabase
      .from("dashboard_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      setSessionId(session.id);

      // Load individual messages from dashboard_messages
      const { data: msgs } = await supabase
        .from("dashboard_messages")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      if (msgs && msgs.length > 0) {
        const loaded: DashMessage[] = msgs.map((m: any) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          structured: m.structured || undefined,
          ts: new Date(m.created_at).getTime(),
        }));
        setMessages(loaded);
      }
    }
  };

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!user) return null;

    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
    if (!tenantId) return null;

    const { data, error } = await supabase
      .from("dashboard_sessions")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        prompt: "Nueva sesión DashDinamics",
        title: "Nueva sesión",
        status: "active",
        result: {} as any,
      })
      .select("id")
      .single();

    if (error || !data) return null;
    setSessionId(data.id);
    return data.id;
  };

  const persistMessage = async (
    sid: string,
    role: string,
    content: string,
    messageType: string,
    structured?: any
  ) => {
    await supabase.from("dashboard_messages").insert({
      session_id: sid,
      role,
      content,
      message_type: messageType,
      structured: structured || null,
    });
  };

  const updateSessionTitle = async (sid: string, title: string) => {
    await supabase
      .from("dashboard_sessions")
      .update({ title, prompt: title } as any)
      .eq("id", sid);
  };

  const handleSend = useCallback(async (text?: string) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isLoading) return;
    if (!text) setInput("");

    const sid = await ensureSession();
    if (!sid) {
      toast({ title: "Error", description: "No se pudo crear la sesión", variant: "destructive" });
      return;
    }

    // Update session title with first message
    if (messages.length === 0) {
      updateSessionTitle(sid, trimmed.slice(0, 80));
    }

    const userMsg: DashMessage = { id: generateId(), role: "user", content: trimmed, ts: Date.now() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setIsLoading(true);

    // Persist user message
    await persistMessage(sid, "user", trimmed, "user_message");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: allMsgs.map(m => ({ role: m.role, content: m.content })),
          mode: "dashdinamics",
          dataSource: "leads",
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error de conexión" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      const structured: StructuredResponse = data.reply || data;

      const assistantMsg: DashMessage = {
        id: generateId(),
        role: "assistant",
        content: structured.assistant_message || "",
        structured,
        ts: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Persist assistant message with full structured data
      await persistMessage(
        sid,
        "assistant",
        structured.assistant_message || "",
        structured.response_mode || "dashboard",
        structured
      );
    } catch (e: any) {
      console.error("DashDinamics error:", e);
      const errMsg: DashMessage = {
        id: generateId(),
        role: "assistant",
        content: `⚠️ Error: ${e.message}`,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);

      // Persist error
      await persistMessage(sid, "assistant", `⚠️ Error: ${e.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, sessionId, user]);

  const startNewSession = () => {
    setMessages([]);
    setSessionId(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-sm">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">DashDinamics</h1>
            <p className="text-xs text-muted-foreground">Genera dashboards estratégicos con lenguaje natural</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={startNewSession}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Nueva sesión
          </Button>
          <Button variant="outline" size="sm" onClick={startNewSession} disabled={messages.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpiar
          </Button>
        </div>
      </div>

      <div className="flex-1 border border-border rounded-xl bg-card/30 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 glow-primary">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="font-display font-bold text-lg text-foreground mb-1">¿Qué decisión necesitas tomar?</h2>
                <p className="text-sm text-center max-w-md mb-6">
                  Describe qué quieres analizar y generaré un dashboard estratégico con datos reales.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="text-xs border-border hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all"
                      onClick={() => handleSend(s)}
                    >
                      <Sparkles className="h-3 w-3 mr-1 text-primary" />
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`rounded-xl text-sm ${
                    msg.role === "user"
                      ? "max-w-[70%] bg-primary text-primary-foreground px-4 py-3"
                      : "max-w-[95%] bg-card border border-border p-4"
                  }`}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.structured ? (
                      <ResponseRenderer data={msg.structured} onSendMessage={(t) => handleSend(t)} />
                    ) : (
                      <p className="text-sm text-muted-foreground">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Construyendo dashboard...</span>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border bg-card/50">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Cuáles campañas convierten mejor? / Dame un resumen ejecutivo..."
              className="min-h-[44px] max-h-[120px] resize-none bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading} size="icon" className="flex-shrink-0 h-[44px] w-[44px]">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

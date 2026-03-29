import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Sparkles,
  Search,
  Clock,
  Pencil,
  Check,
  X,
  CalendarDays,
  GripHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { ResponseRenderer } from "@/components/dashdinamics/ResponseRenderer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { dashMessageToApiContent, type DashMessage, type StructuredResponse } from "@/types/dashdinamics";
import { cn } from "@/lib/utils";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;
/** Chats por página: primero los 4 más recientes; al desplazar se cargan más. */
const HISTORY_PAGE_SIZE = 4;

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

interface SessionSummary {
  id: string;
  title: string;
  created_at: string;
}

export default function DashDinamicsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [debouncedHistoryKeyword, setDebouncedHistoryKeyword] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const historyListRef = useRef<HTMLDivElement>(null);

  const [headerTitleEditing, setHeaderTitleEditing] = useState(false);
  const [headerTitleDraft, setHeaderTitleDraft] = useState("");

  const [editingListSessionId, setEditingListSessionId] = useState<string | null>(null);
  const [listTitleDraft, setListTitleDraft] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedHistoryKeyword(historyKeyword.trim()), 350);
    return () => clearTimeout(t);
  }, [historyKeyword]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const persistSessionTitle = useCallback(
    async (sid: string, rawTitle: string, opts?: { forceCurrent?: boolean }): Promise<boolean> => {
      const title = rawTitle.trim() || "Sin título";
      const { error } = await supabase
        .from("dashboard_sessions")
        .update({ title, prompt: title } as Record<string, unknown>)
        .eq("id", sid);
      if (error) {
        console.error(error);
        toast({ title: "No se pudo guardar el título", description: error.message, variant: "destructive" });
        return false;
      }
      if (opts?.forceCurrent || sessionId === sid) setCurrentSessionTitle(title);
      setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title } : s)));
      return true;
    },
    [sessionId, toast],
  );

  const refreshHistory = useCallback(async () => {
    if (!user) return;
    setSessionsLoading(true);
    setHasMoreHistory(false);
    const { data, error } = await supabase.rpc("search_dashboard_sessions", {
      _search_text: debouncedHistoryKeyword || null,
      _date_from: historyDateFrom || null,
      _date_to: historyDateTo || null,
      _limit: HISTORY_PAGE_SIZE,
      _offset: 0,
    });

    if (error) {
      console.error(error);
      toast({
        title: "Historial",
        description:
          error.message?.includes("search_dashboard_sessions") || error.code === "PGRST202"
            ? "Aplica la migración SQL search_dashboard_sessions en Supabase o revisa la función RPC."
            : error.message,
        variant: "destructive",
      });
      setSessions([]);
      setSessionsLoading(false);
      return;
    }

    const rows = (data || []) as SessionSummary[];
    setSessions(rows);
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    setSessionsLoading(false);
  }, [user, debouncedHistoryKeyword, historyDateFrom, historyDateTo, toast]);

  const loadMoreHistory = useCallback(async () => {
    if (!user || sessionsLoading || sessionsLoadingMore || !hasMoreHistory) return;
    setSessionsLoadingMore(true);
    const offset = sessions.length;
    const { data, error } = await supabase.rpc("search_dashboard_sessions", {
      _search_text: debouncedHistoryKeyword || null,
      _date_from: historyDateFrom || null,
      _date_to: historyDateTo || null,
      _limit: HISTORY_PAGE_SIZE,
      _offset: offset,
    });

    if (error) {
      console.error(error);
      setSessionsLoadingMore(false);
      return;
    }

    const rows = (data || []) as SessionSummary[];
    setSessions((prev) => [...prev, ...rows]);
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    setSessionsLoadingMore(false);
  }, [
    user,
    sessions.length,
    sessionsLoading,
    sessionsLoadingMore,
    hasMoreHistory,
    debouncedHistoryKeyword,
    historyDateFrom,
    historyDateTo,
  ]);

  useEffect(() => {
    if (!showHistory) return;
    void refreshHistory();
  }, [showHistory, debouncedHistoryKeyword, historyDateFrom, historyDateTo, refreshHistory]);

  const onHistoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (sessionsLoading || sessionsLoadingMore || !hasMoreHistory) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      void loadMoreHistory();
    }
  };

  const clearHistoryFilters = () => {
    setHistoryKeyword("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
  };

  useEffect(() => {
    if (!user) return;
    loadLatestSession();
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadLatestSession = async () => {
    if (!user) return;

    const { data: sessionsData } = await supabase
      .from("dashboard_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    if (sessionsData && sessionsData.length > 0) {
      const session = sessionsData[0];
      setSessionId(session.id);
      setCurrentSessionTitle(session.title || "");
      await loadSessionMessages(session.id);
    }
  };

  const loadSessionMessages = async (sid: string) => {
    const { data: msgs } = await supabase
      .from("dashboard_messages")
      .select("*")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });

    if (msgs && msgs.length > 0) {
      const loaded: DashMessage[] = msgs.map((m: Record<string, unknown>) => {
        const st = m.structured;
        const isUserApiOverlay =
          m.role === "user" &&
          st &&
          typeof st === "object" &&
          "api_content" in (st as object) &&
          typeof (st as { api_content?: unknown }).api_content === "string" &&
          !("response_mode" in (st as object));
        return {
          id: m.id as string,
          role: m.role as "user" | "assistant",
          content: m.content as string,
          ...(isUserApiOverlay
            ? { contentForModel: String((st as { api_content: string }).api_content) }
            : {}),
          structured:
            m.role === "assistant" && st
              ? (st as StructuredResponse)
              : isUserApiOverlay
                ? undefined
                : (st as StructuredResponse) || undefined,
          ts: new Date(m.created_at as string).getTime(),
        };
      });
      setMessages(loaded);
    } else {
      setMessages([]);
    }
  };

  const openSession = async (session: SessionSummary) => {
    setSessionId(session.id);
    setCurrentSessionTitle(session.title || "");
    setHeaderTitleEditing(false);
    setEditingListSessionId(null);
    await loadSessionMessages(session.id);
    setShowHistory(false);
  };

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!user) return null;

    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
    if (!tenantId) return null;

    const { data, error } = await supabase
      .from("dashboard_sessions")
      .insert([{
        tenant_id: tenantId as string,
        user_id: user.id,
        prompt: "Nueva sesión Dashboard IA",
        title: "Nueva sesión",
        status: "active",
      }])
      .select("id")
      .single();

    if (error || !data) return null;
    setSessionId(data.id);
    setCurrentSessionTitle("Nueva sesión");
    return data.id;
  };

  const persistMessage = async (
    sid: string,
    role: string,
    content: string,
    messageType: string,
    structured?: StructuredResponse | null,
    apiContentForModel?: string,
  ) => {
    const row: Record<string, unknown> = {
      session_id: sid,
      role,
      content,
      message_type: messageType,
    };
    if (role === "user" && apiContentForModel && apiContentForModel.trim() !== content.trim()) {
      row.structured = { api_content: apiContentForModel };
    } else {
      row.structured = structured ?? null;
    }
    await supabase.from("dashboard_messages").insert(row as never);
  };

  const fetchDashReply = useCallback(async (apiMessages: { role: string; content: string }[]): Promise<StructuredResponse> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const body: Record<string, unknown> = {
      messages: apiMessages,
      mode: "dashdinamics",
      dataSource: "leads",
    };
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error de conexión" }));
      throw new Error(err.error || `Error ${resp.status}`);
    }
    const data = await resp.json();
    return (data.reply || data) as StructuredResponse;
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const trimmed = (text || input).trim();
      if (!trimmed || isLoading) return;
      if (!text) setInput("");

      const sid = await ensureSession();
      if (!sid) {
        toast({ title: "Error", description: "No se pudo crear la sesión", variant: "destructive" });
        return;
      }

      if (messages.length === 0) {
        const t = trimmed.slice(0, 80);
        await persistSessionTitle(sid, t, { forceCurrent: true });
      }

      const userMsg: DashMessage = { id: generateId(), role: "user", content: trimmed, ts: Date.now() };
      const allMsgs = [...messages, userMsg];
      setMessages(allMsgs);
      setIsLoading(true);

      await persistMessage(sid, "user", trimmed, "user_message");

      try {
        const structured = await fetchDashReply(
          allMsgs.map((m) => ({ role: m.role, content: dashMessageToApiContent(m) })),
        );

        const assistantMsg: DashMessage = {
          id: generateId(),
          role: "assistant",
          content: structured.assistant_message || "",
          structured,
          ts: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        await persistMessage(
          sid,
          "assistant",
          structured.assistant_message || "",
          structured.response_mode || "dashboard",
          structured,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error";
        console.error("DashDinamics error:", e);
        const errMsg: DashMessage = { id: generateId(), role: "assistant", content: `⚠️ Error: ${msg}`, ts: Date.now() };
        setMessages((prev) => [...prev, errMsg]);
        await persistMessage(sid, "assistant", `⚠️ Error: ${msg}`, "error");
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, fetchDashReply, toast, persistSessionTitle],
  );

  const handleRegenerateLastDashboard = useCallback(async () => {
    if (isLoading) return;
    const lastIdx = messages.length - 1;
    if (lastIdx < 0 || messages[lastIdx].role !== "assistant") return;

    let userIdx = lastIdx - 1;
    while (userIdx >= 0 && messages[userIdx].role !== "user") userIdx--;
    if (userIdx < 0) {
      toast({
        title: "No se puede regenerar",
        description: "No hay una pregunta tuya previa a esta respuesta.",
        variant: "destructive",
      });
      return;
    }

    let sid = sessionId;
    if (!sid) {
      sid = await ensureSession();
    }
    if (!sid) {
      toast({ title: "Error", description: "No hay sesión activa", variant: "destructive" });
      return;
    }

    const context = messages
      .slice(0, userIdx + 1)
      .map((m) => ({ role: m.role, content: dashMessageToApiContent(m) }));
    setIsLoading(true);

    try {
      const structured = await fetchDashReply(context);

      const assistantMsg: DashMessage = {
        id: generateId(),
        role: "assistant",
        content: structured.assistant_message || "",
        structured,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev.slice(0, lastIdx), assistantMsg]);

      const { data: lastAssistantRow } = await supabase
        .from("dashboard_messages")
        .select("id")
        .eq("session_id", sid)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAssistantRow?.id) {
        await supabase.from("dashboard_messages").delete().eq("id", lastAssistantRow.id);
      }

      await persistMessage(
        sid,
        "assistant",
        structured.assistant_message || "",
        structured.response_mode || "dashboard",
        structured,
      );

      toast({ title: "Dashboard regenerado", description: "Se volvió a generar con la misma consulta." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error";
      console.error("Regenerate error:", e);
      toast({ title: "Error al regenerar", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, sessionId, fetchDashReply, toast]);

  const startNewSession = () => {
    setMessages([]);
    setSessionId(null);
    setCurrentSessionTitle("");
    setHeaderTitleEditing(false);
  };

  const saveListTitle = async (sid: string) => {
    const ok = await persistSessionTitle(sid, listTitleDraft);
    if (ok) {
      toast({ title: "Título guardado" });
      setEditingListSessionId(null);
      if (showHistory) void refreshHistory();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-sm">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold tracking-tight">Dashboard IA</h1>
            <p className="text-xs text-muted-foreground">Genera dashboards estratégicos con lenguaje natural</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Historial
          </Button>
          <Button variant="outline" size="sm" onClick={startNewSession} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Nueva sesión
          </Button>
          <Button variant="outline" size="sm" onClick={startNewSession} disabled={messages.length === 0} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Limpiar
          </Button>
        </div>
      </div>

      {sessionId && (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-0.5">
          {headerTitleEditing ? (
            <>
              <span className="text-xs text-muted-foreground shrink-0">Título del chat</span>
              <Input
                className="h-8 max-w-md text-sm"
                value={headerTitleDraft}
                onChange={(e) => setHeaderTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void persistSessionTitle(sessionId, headerTitleDraft).then((ok) => {
                      if (ok) {
                        setHeaderTitleEditing(false);
                        if (showHistory) void refreshHistory();
                      }
                    });
                  }
                  if (e.key === "Escape") setHeaderTitleEditing(false);
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8"
                onClick={() =>
                  void persistSessionTitle(sessionId, headerTitleDraft).then((ok) => {
                    if (ok) {
                      setHeaderTitleEditing(false);
                      if (showHistory) void refreshHistory();
                    }
                  })
                }
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setHeaderTitleEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground shrink-0">Chat:</span>
              <span className="text-sm font-semibold text-foreground truncate max-w-[min(100%,24rem)]">
                {currentSessionTitle || "Sin título"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  setHeaderTitleDraft(currentSessionTitle);
                  setHeaderTitleEditing(true);
                }}
                title="Editar título"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent
          className={cn(
            "flex w-[min(42rem,calc(100vw-1.5rem))] max-w-[min(96vw,1400px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1400px)]",
            "h-[min(58vh,560px)] min-h-[280px] max-h-[90vh] min-w-[min(100%,280px)]",
            "resize",
          )}
          title="Arrastra la esquina inferior derecha para cambiar el tamaño de la ventana"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 pr-14 text-left">
            <DialogTitle>Historial de chats</DialogTitle>
            <DialogDescription>
              Carga inicial: {HISTORY_PAGE_SIZE} conversaciones más recientes. Usa el desplazamiento de la lista para traer
              más; la barra de búsqueda y los filtros de fecha acotan resultados. Fechas según día en Chile.
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 space-y-3 border-b border-border bg-muted/10 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={historyKeyword}
                onChange={(e) => setHistoryKeyword(e.target.value)}
                placeholder="Palabras en título, prompt o mensajes del chat…"
                className="h-9 min-w-[160px] flex-1 text-sm"
              />
              <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
              </div>
              <Input
                type="date"
                value={historyDateFrom}
                onChange={(e) => setHistoryDateFrom(e.target.value)}
                className="h-9 w-[140px] text-xs"
                title="Desde (Chile)"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="date"
                value={historyDateTo}
                onChange={(e) => setHistoryDateTo(e.target.value)}
                className="h-9 w-[140px] text-xs"
                title="Hasta (Chile)"
              />
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={clearHistoryFilters}>
                Limpiar filtros
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-2 sm:px-6">
            <div
              ref={historyListRef}
              onScroll={onHistoryScroll}
              className="mx-auto min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border/60 bg-muted/20 pr-1"
            >
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">No hay sesiones con estos criterios</p>
              ) : (
                <div className="space-y-1 p-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-stretch gap-1 rounded-lg border border-transparent transition-colors",
                        sessionId === s.id ? "border-primary/20 bg-primary/5" : "hover:bg-muted/80",
                      )}
                    >
                      <button type="button" onClick={() => openSession(s)} className="min-w-0 flex-1 p-3 text-left">
                        <p className="truncate text-sm font-medium">{s.title || "Sin título"}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("es-CL", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </button>
                      <div className="flex items-center pr-1">
                        {editingListSessionId === s.id ? (
                          <div className="flex min-w-[140px] flex-col gap-1 py-2 pr-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              className="h-7 text-xs"
                              value={listTitleDraft}
                              onChange={(e) => setListTitleDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveListTitle(s.id);
                                if (e.key === "Escape") setEditingListSessionId(null);
                              }}
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => void saveListTitle(s.id)}
                              >
                                Guardar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => setEditingListSessionId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Renombrar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingListSessionId(s.id);
                              setListTitleDraft(s.title || "");
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {sessionsLoadingMore && (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!hasMoreHistory && sessions.length > 0 && !sessionsLoading && (
                    <p className="py-2 text-center text-[10px] text-muted-foreground">No hay más resultados</p>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground select-none">
              <GripHorizontal className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              Redimensionar: esquina inferior derecha
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
                  Escribe qué quieres analizar (periodo, métrica, desglose). Generamos el tablero con datos reales en un solo
                  paso.
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
              {messages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl text-sm ${
                      msg.role === "user"
                        ? "max-w-[70%] bg-primary text-primary-foreground px-4 py-3"
                        : "max-w-[95%] bg-card border border-border p-5"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.structured ? (
                      <ResponseRenderer
                        data={msg.structured}
                        onSendMessage={(t) => handleSend(t)}
                        onRegenerateDashboard={
                          idx === messages.length - 1 && msg.structured?.response_mode === "dashboard"
                            ? handleRegenerateLastDashboard
                            : undefined
                        }
                        isRegenerating={isLoading}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-secondary-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Generando respuesta…</span>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Cuáles campañas convierten mejor? / Dame un resumen ejecutivo..."
              className="min-h-[56px] max-h-[140px] resize-none bg-background text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="flex-shrink-0 h-14 w-14 rounded-xl"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

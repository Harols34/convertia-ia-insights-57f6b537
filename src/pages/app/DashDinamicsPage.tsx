import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicChart } from "@/components/app/DynamicChart";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

function getStorageKey(userId: string) {
  return `dashdinamics_history_${userId}`;
}

function loadHistory(userId: string): ChatMsg[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(userId: string, msgs: ChatMsg[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(msgs));
}

function parseChartBlocks(text: string): { textParts: string[]; charts: (Record<string, unknown> | null)[] } {
  const parts = text.split(/<CHART_CONFIG>/gi);
  const textParts: string[] = [];
  const charts: (Record<string, unknown> | null)[] = [];

  parts.forEach((part, i) => {
    if (i === 0) {
      textParts.push(part);
      charts.push(null);
      return;
    }
    const endIdx = part.search(/<\/CHART_CONFIG>/gi);
    if (endIdx === -1) {
      textParts.push(part);
      charts.push(null);
      return;
    }
    const jsonStr = part.slice(0, endIdx).trim();
    const after = part.slice(endIdx + "</CHART_CONFIG>".length);
    try {
      charts.push(JSON.parse(jsonStr));
      textParts.push(after);
    } catch {
      textParts.push(part);
      charts.push(null);
    }
  });
  return { textParts, charts };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;

export default function DashDinamicsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";

  const [messages, setMessages] = useState<ChatMsg[]>(() => loadHistory(userId));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory(userId));
  }, [userId]);

  useEffect(() => {
    saveHistory(userId, messages);
  }, [messages, userId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const userMsg: ChatMsg = { role: "user", content: trimmed, ts: Date.now() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsLoading(true);

    try {
      const { supabase } = await import("@/integrations/supabase/client");
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

      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await resp.json();
        const reply = data.reply || data.error || "Sin respuesta";
        setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No hay stream");

      let assistantSoFar = "";
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.ts === 0) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar, ts: 0 }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Finalize the streaming message with a real timestamp
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.ts === 0) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, ts: Date.now() } : m));
        }
        return prev;
      });
    } catch (e: any) {
      console.error("DashDinamics error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${e.message}`, ts: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(getStorageKey(userId));
  };

  const renderMessage = (msg: ChatMsg) => {
    if (msg.role === "user") {
      return <p className="whitespace-pre-wrap">{msg.content}</p>;
    }
    const { textParts, charts } = parseChartBlocks(msg.content);
    return (
      <div className="space-y-2">
        {textParts.map((txt, i) => (
          <div key={i}>
            {charts[i] && <DynamicChart config={charts[i]!} />}
            {txt.trim() && (
              <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2">
                <ReactMarkdown>{txt}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-display font-bold">DashDinamics</h1>
            <p className="text-xs text-muted-foreground">Genera dashboards con lenguaje natural usando datos reales</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={clearHistory} disabled={messages.length === 0}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpiar historial
        </Button>
      </div>

      <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
                <p className="font-display font-semibold text-base mb-1">¿Qué dashboard necesitas?</p>
                <p className="text-sm text-center max-w-md">Escribe en lenguaje natural qué métricas o gráficos deseas generar. Los datos provienen de tu base de leads real.</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={`${msg.ts}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {renderMessage(msg)}
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
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: ¿Cuántas ventas por ciudad hay? Muéstrame un gráfico..."
              className="min-h-[44px] max-h-[120px] resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon" className="flex-shrink-0 h-[44px] w-[44px]">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

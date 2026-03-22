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

const MOCK_RESPONSE = (userMsg: string): string => {
  return `Aquí tienes el análisis solicitado:

He procesado tu solicitud: **"${userMsg}"**

<CHART_CONFIG>
{
  "title": { "text": "Métricas de Usuario", "left": "center", "textStyle": { "color": "#e0e0e0" } },
  "tooltip": { "trigger": "axis" },
  "xAxis": { "data": ["Ene", "Feb", "Mar", "Abr", "May", "Jun"], "axisLabel": { "color": "#aaa" } },
  "yAxis": { "axisLabel": { "color": "#aaa" }, "splitLine": { "lineStyle": { "color": "#333" } } },
  "series": [{
    "name": "Interacciones",
    "type": "bar",
    "data": [${Array.from({ length: 6 }, () => Math.floor(Math.random() * 300 + 50)).join(",")}],
    "itemStyle": { "color": "#008080", "borderRadius": [4,4,0,0] }
  }]
}
</CHART_CONFIG>

Este dashboard muestra datos exclusivos de tu perfil. Puedes expandir el gráfico para verlo en detalle.`;
};

export default function DashDinamicsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";

  const [messages, setMessages] = useState<ChatMsg[]>(() => loadHistory(userId));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reload history when user changes
  useEffect(() => {
    setMessages(loadHistory(userId));
  }, [userId]);

  // Persist on change
  useEffect(() => {
    saveHistory(userId, messages);
  }, [messages, userId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const userMsg: ChatMsg = { role: "user", content: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response with delay
    setTimeout(() => {
      const assistantMsg: ChatMsg = { role: "assistant", content: MOCK_RESPONSE(trimmed), ts: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1200);
  }, [input, isLoading]);

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-display font-bold">DashDinamics</h1>
            <p className="text-xs text-muted-foreground">Genera dashboards con lenguaje natural</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={clearHistory} disabled={messages.length === 0}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpiar historial
        </Button>
      </div>

      {/* Chat area */}
      <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
                <p className="font-display font-semibold text-base mb-1">¿Qué dashboard necesitas?</p>
                <p className="text-sm text-center max-w-md">Escribe en lenguaje natural qué métricas o gráficos deseas generar. Los datos son exclusivos de tu sesión.</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={msg.ts + "-" + i}
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

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe el dashboard que necesitas..."
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

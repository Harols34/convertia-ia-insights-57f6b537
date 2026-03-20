import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, Save, History, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChatWindow } from "@/components/app/ChatWindow";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DATA_SOURCES = [
  { value: "leads", label: "Leads", description: "Datos de marketing, gestiones y negocios", icon: "📊" },
  { value: "exports", label: "Exportaciones", description: "Historial de archivos generados", icon: "📁" },
  { value: "audit_logs", label: "Auditoría", description: "Eventos y actividad del sistema", icon: "🔍" },
];

const SUGGESTIONS: Record<string, string[]> = {
  leads: [
    "Muéstrame un resumen ejecutivo de todos los leads",
    "¿Cuáles son las campañas con mayor volumen de leads?",
    "Analiza la distribución de leads por ciudad y resultado de gestión",
    "¿Cuáles son los agentes con más negocios cerrados?",
    "Compara el rendimiento por campaña MKT en una tabla",
  ],
  exports: [
    "¿Cuántas exportaciones se han generado?",
    "¿Qué módulo genera más exportaciones?",
  ],
  audit_logs: [
    "Muéstrame los eventos más recientes del sistema",
    "¿Cuáles son las acciones más frecuentes?",
  ],
};

export default function DashboardsIAPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useStreamChat();
  const { toast } = useToast();
  const [dataSource, setDataSource] = useState("leads");

  const handleSend = (text: string) => {
    sendMessage(text, { mode: "analytics", dataSource });
  };

  const saveSession = async () => {
    if (messages.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

    const firstUserMsg = messages.find((m) => m.role === "user");
    await supabase.from("dashboard_sessions").insert({
      tenant_id: tenantId,
      user_id: user.id,
      prompt: firstUserMsg?.content || "Sin prompt",
      title: firstUserMsg?.content?.slice(0, 80) || "Sin título",
      result: { messages, dataSource },
    });
    toast({ title: "Sesión guardada", description: "Puedes encontrarla en tu historial." });
  };

  const currentSuggestions = SUGGESTIONS[dataSource] || SUGGESTIONS.leads;
  const currentSource = DATA_SOURCES.find((s) => s.value === dataSource);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboards con IA</h1>
          <p className="text-sm text-muted-foreground mt-1">Genera análisis inteligentes con lenguaje natural</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearMessages} disabled={messages.length === 0}>
            <History className="h-4 w-4 mr-2" /> Limpiar
          </Button>
          <Button variant="outline" onClick={saveSession} disabled={messages.length === 0}>
            <Save className="h-4 w-4 mr-2" /> Guardar Sesión
          </Button>
        </div>
      </div>

      {/* Data Source Selector */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
        <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">Fuente de datos:</span>
        <Select value={dataSource} onValueChange={(v) => { setDataSource(v); clearMessages(); }}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_SOURCES.map((src) => (
              <SelectItem key={src.value} value={src.value}>
                <span className="flex items-center gap-2">
                  <span>{src.icon}</span>
                  <span>{src.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentSource && (
          <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
            {currentSource.description}
          </Badge>
        )}
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Brain className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
            <h2 className="font-display font-semibold mb-1">¿Qué deseas analizar?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Consultando: <strong>{currentSource?.label}</strong> — {currentSource?.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {currentSuggestions.map((s) => (
                <Button key={s} variant="secondary" size="sm" className="text-xs" onClick={() => handleSend(s)}>
                  <Sparkles className="h-3 w-3 mr-1" /> {s.slice(0, 55)}{s.length > 55 ? "…" : ""}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Chat */}
      <div className="h-[550px]">
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          placeholder={`Pregunta sobre ${currentSource?.label || "datos"}...`}
        />
      </div>
    </div>
  );
}

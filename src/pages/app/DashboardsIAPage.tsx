import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, Save, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/app/ChatWindow";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUGGESTIONS = [
  "Muéstrame un resumen ejecutivo de todos los leads",
  "¿Cuáles son las campañas con mayor volumen de leads?",
  "Analiza la distribución de leads por ciudad y resultado de gestión",
  "¿Cuáles son los agentes con más negocios cerrados?",
  "Compara el rendimiento por campaña MKT en una tabla",
];

export default function DashboardsIAPage() {
  const { messages, isLoading, sendMessage, clearMessages } = useStreamChat();
  const { toast } = useToast();

  const handleSend = (text: string) => {
    sendMessage(text, { mode: "analytics", dataSource: "leads" });
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
      result: { messages },
    });
    toast({ title: "Sesión guardada", description: "Puedes encontrarla en tu historial." });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboards con IA</h1>
          <p className="text-sm text-muted-foreground mt-1">Genera análisis inteligentes sobre tus leads con lenguaje natural</p>
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

      {messages.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Brain className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
            <h2 className="font-display font-semibold mb-1">¿Qué deseas analizar?</h2>
            <p className="text-sm text-muted-foreground mb-4">Escribe en lenguaje natural qué métricas o análisis necesitas sobre tus leads</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="secondary" size="sm" className="text-xs" onClick={() => handleSend(s)}>
                  <Sparkles className="h-3 w-3 mr-1" /> {s.slice(0, 55)}{s.length > 55 ? "…" : ""}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <div className="h-[550px]">
        <ChatWindow
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          placeholder="Pregunta sobre tus leads..."
        />
      </div>
    </div>
  );
}

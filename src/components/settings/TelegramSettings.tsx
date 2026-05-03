import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Copy, Trash2, RefreshCw, Loader2, CheckCircle2, MessageCircle, Bot, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const BOT_USERNAME = "Convertiabot"; // displayed in instructions

export function TelegramSettings() {
  const qc = useQueryClient();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedExpiry, setGeneratedExpiry] = useState<Date | null>(null);
  const [mode, setMode] = useState<"auto" | "text" | "dashboard">("auto");
  const [ttlValue, setTtlValue] = useState<number>(30);
  const [ttlUnit, setTtlUnit] = useState<"minutes" | "hours" | "days">("minutes");

  const ttlSeconds = (() => {
    const v = Math.max(1, Math.floor(ttlValue || 1));
    const mult = ttlUnit === "minutes" ? 60 : ttlUnit === "hours" ? 3600 : 86400;
    return Math.min(v * mult, 2592000); // cap 30 days
  })();
  const expiresHumanLabel = (() => {
    const totalMin = Math.round(ttlSeconds / 60);
    if (totalMin < 60) return `${totalMin} min`;
    if (totalMin < 1440) return `${Math.round(totalMin / 60)} h`;
    return `${Math.round(totalMin / 1440)} d`;
  })();

  // existing links for current user
  const { data: links, isLoading } = useQuery({
    queryKey: ["telegram-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_user_links")
        .select("*")
        .eq("is_active", true)
        .order("linked_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: tenantId, error: te } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
      if (te) throw te;
      const { data, error } = await supabase.rpc("generate_telegram_link_code", {
        _user_id: user.id,
        _tenant_id: tenantId,
        _bot_id: null,
        _mode: mode,
        _ttl_seconds: ttlSeconds,
      } as any);
      if (error) throw error;
      return data as string;
    },
    onSuccess: (code) => {
      setGeneratedCode(code);
      setGeneratedExpiry(new Date(Date.now() + ttlSeconds * 1000));
      toast.success(`Código generado. Válido por ${expiresHumanLabel}.`);
    },
    onError: (e: any) => toast.error(`Error: ${e.message}`),
  });

  const unlink = useMutation({
    mutationFn: async (chatId: number) => {
      const { error } = await supabase
        .from("telegram_user_links")
        .update({ is_active: false })
        .eq("chat_id", chatId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-links"] });
      toast.success("Chat desvinculado");
    },
  });

  const updateMode = useMutation({
    mutationFn: async ({ chatId, newMode }: { chatId: number; newMode: string }) => {
      const { error } = await supabase
        .from("telegram_user_links")
        .update({ mode: newMode })
        .eq("chat_id", chatId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-links"] });
      toast.success("Modo actualizado");
    },
  });

  const startCommand = generatedCode ? `/start ${generatedCode}` : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Conectar a Telegram</CardTitle>
          </div>
          <CardDescription>
            Convierte tu bot <strong>@{BOT_USERNAME}</strong> en un asistente personal: pídele KPIs,
            análisis y dashboards en lenguaje natural desde cualquier dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Modo de respuesta del bot</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🪄 Automático (detecta intención)</SelectItem>
                  <SelectItem value="text">💬 Solo texto conversacional</SelectItem>
                  <SelectItem value="dashboard">📊 Generador de dashboards (KPIs/insights)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Validez del código
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={ttlValue}
                  onChange={(e) => setTtlValue(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <Select value={ttlUnit} onValueChange={(v: any) => setTtlUnit(v)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Equivale a <strong>{expiresHumanLabel}</strong> · máx. 30 días
              </p>
            </div>
          </div>

          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="w-full gap-2"
            size="lg"
          >
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Generar código de vinculación
          </Button>

          {generatedCode && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Tu código de vinculación</span>
                <Badge variant="outline" className="ml-auto">
                  {generatedExpiry
                    ? `expira ${generatedExpiry.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}`
                    : `válido ${expiresHumanLabel}`}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-2xl font-mono tracking-widest text-center">
                  {generatedCode}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(generatedCode); toast.success("Copiado"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>
                  Abre Telegram y busca <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer" className="text-primary underline">@{BOT_USERNAME}</a>
                </li>
                <li>Envíale este mensaje exactamente:</li>
              </ol>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-sm font-mono">
                  {startCommand}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(startCommand); toast.success("Copiado"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button asChild size="sm" className="gap-1.5">
                  <a href={`https://t.me/${BOT_USERNAME}?start=${generatedCode}`} target="_blank" rel="noreferrer">
                    <Send className="h-3.5 w-3.5" /> Abrir
                  </a>
                </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Chats vinculados</CardTitle>
          </div>
          <CardDescription>Gestiona los chats de Telegram conectados a tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
            </div>
          ) : !links || links.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Aún no tienes chats vinculados. Genera un código arriba para comenzar.
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((l: any) => (
                <div key={l.chat_id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Send className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {l.telegram_first_name || l.telegram_username || `Chat ${l.chat_id}`}
                      {l.telegram_username && <span className="text-muted-foreground"> · @{l.telegram_username}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vinculado {new Date(l.linked_at).toLocaleDateString("es-CL")}
                      {l.last_message_at && ` · Último: ${new Date(l.last_message_at).toLocaleString("es-CL")}`}
                    </div>
                  </div>
                  <Select
                    value={l.mode}
                    onValueChange={(v) => updateMode.mutate({ chatId: l.chat_id, newMode: v })}
                  >
                    <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="text">Solo texto</SelectItem>
                      <SelectItem value="dashboard">Dashboards</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { if (confirm("¿Desvincular este chat?")) unlink.mutate(l.chat_id); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

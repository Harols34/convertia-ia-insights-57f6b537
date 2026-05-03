import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Settings, Save, Palette, Globe, Bell, Shield, Sliders, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface SettingItem {
  key: string;
  value: any;
  category: string;
}

const DEFAULT_SETTINGS: SettingItem[] = [
  { key: "app_name", value: "Converti-IA Insights", category: "branding" },
  { key: "primary_color", value: "#008080", category: "branding" },
  { key: "logo_url", value: "", category: "branding" },
  { key: "language", value: "es", category: "general" },
  { key: "timezone", value: "America/Mexico_City", category: "general" },
  { key: "max_leads_per_query", value: 1000, category: "limits" },
  { key: "enable_notifications", value: true, category: "notifications" },
  { key: "enable_audit_logs", value: true, category: "security" },
  { key: "session_timeout_minutes", value: 60, category: "security" },
  { key: "allow_csv_export", value: true, category: "general" },
  { key: "ai_model", value: "gpt-4o-mini", category: "ai" },
  { key: "max_chat_history", value: 50, category: "ai" },
];

export default function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, any>>({});

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*");
      return data || [];
    },
  });

  useEffect(() => {
    const merged: Record<string, any> = {};
    DEFAULT_SETTINGS.forEach(s => { merged[s.key] = s.value; });
    savedSettings?.forEach((s: any) => { merged[s.key] = typeof s.value === "object" && s.value?.v !== undefined ? s.value.v : s.value; });
    setSettings(merged);
  }, [savedSettings]);

  const saveMutation = useMutation({
    mutationFn: async (items: Record<string, any>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

      for (const [key, value] of Object.entries(items)) {
        const cat = DEFAULT_SETTINGS.find(s => s.key === key)?.category || "general";
        await supabase.from("system_settings").upsert({
          tenant_id: tenantId,
          key,
          value: { v: value },
          category: cat,
          updated_by: user.id,
        }, { onConflict: "tenant_id,key" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Configuración guardada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Configuración</h1>
          <p className="text-muted-foreground text-sm mt-1">Parámetros generales, branding y ajustes del sistema</p>
        </div>
        <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar cambios
        </Button>
      </div>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branding"><Palette className="h-3.5 w-3.5 mr-1.5" />Branding</TabsTrigger>
          <TabsTrigger value="general"><Globe className="h-3.5 w-3.5 mr-1.5" />General</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-3.5 w-3.5 mr-1.5" />Seguridad</TabsTrigger>
          <TabsTrigger value="ai"><Sliders className="h-3.5 w-3.5 mr-1.5" />IA</TabsTrigger>
          <TabsTrigger value="telegram"><Send className="h-3.5 w-3.5 mr-1.5" />Telegram</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Identidad visual</CardTitle><CardDescription>Personaliza la apariencia de la plataforma</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Nombre de la app</Label><Input value={settings.app_name || ""} onChange={(e) => updateSetting("app_name", e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Color primario</Label>
                <div className="flex gap-2">
                  <input type="color" value={settings.primary_color || "#008080"} onChange={(e) => updateSetting("primary_color", e.target.value)} className="h-10 w-10 rounded cursor-pointer border border-input" />
                  <Input value={settings.primary_color || ""} onChange={(e) => updateSetting("primary_color", e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2"><Label>URL del logo</Label><Input value={settings.logo_url || ""} onChange={(e) => updateSetting("logo_url", e.target.value)} placeholder="https://..." /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Preferencias generales</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={settings.language || "es"} onValueChange={(v) => updateSetting("language", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zona horaria</Label>
                <Select value={settings.timezone || "America/Mexico_City"} onValueChange={(v) => updateSetting("timezone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["America/Mexico_City", "America/Bogota", "America/Lima", "America/Buenos_Aires", "America/Santiago", "UTC"].map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div><Label>Permitir exportación CSV</Label><p className="text-xs text-muted-foreground">Habilita la descarga de datos en formato CSV</p></div>
                <Switch checked={settings.allow_csv_export ?? true} onCheckedChange={(v) => updateSetting("allow_csv_export", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Seguridad</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div><Label>Auditoría de eventos</Label><p className="text-xs text-muted-foreground">Registra todas las acciones sensibles</p></div>
                <Switch checked={settings.enable_audit_logs ?? true} onCheckedChange={(v) => updateSetting("enable_audit_logs", v)} />
              </div>
              <div className="space-y-2">
                <Label>Timeout de sesión (minutos)</Label>
                <Input type="number" value={settings.session_timeout_minutes || 60} onChange={(e) => updateSetting("session_timeout_minutes", parseInt(e.target.value) || 60)} />
              </div>
              <div className="space-y-2">
                <Label>Máximo de leads por consulta</Label>
                <Input type="number" value={settings.max_leads_per_query || 1000} onChange={(e) => updateSetting("max_leads_per_query", parseInt(e.target.value) || 1000)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Inteligencia Artificial</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modelo de IA</Label>
                <Select value={settings.ai_model || "gpt-4o-mini"} onValueChange={(v) => updateSetting("ai_model", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Máximo mensajes en historial de chat</Label>
                <Input type="number" value={settings.max_chat_history || 50} onChange={(e) => updateSetting("max_chat_history", parseInt(e.target.value) || 50)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram" className="space-y-4">
          <TelegramSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

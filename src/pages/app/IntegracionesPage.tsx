import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Plug, Plus, Database, Check, X, Pencil, BarChart3, FileBarChart, Bot, GitBranch, Layers, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface DataSourceForm {
  table_name: string;
  display_name: string;
  description: string;
  category: string;
  is_active: boolean;
  allow_dashboards: boolean;
  allow_reports: boolean;
  allow_chatbots: boolean;
  allow_joins: boolean;
  allow_cross_analysis: boolean;
  priority: number;
}

const emptyForm: DataSourceForm = {
  table_name: "", display_name: "", description: "", category: "general",
  is_active: false, allow_dashboards: false, allow_reports: false,
  allow_chatbots: false, allow_joins: false, allow_cross_analysis: false, priority: 0,
};

const categories = ["general", "comercial", "financiero", "marketing", "operaciones", "rrhh"];

export default function IntegracionesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DataSourceForm>(emptyForm);

  const { data: sources, isLoading } = useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_data_sources")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: DataSourceForm & { id?: string }) => {
      const payload = { ...f };
      delete (payload as any).id;
      if (editingId) {
        const { error } = await supabase.from("tenant_data_sources").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenant_data_sources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-sources"] });
      toast.success(editingId ? "Fuente actualizada" : "Fuente registrada");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("tenant_data_sources").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["data-sources"] }),
  });

  const openEdit = (src: any) => {
    setEditingId(src.id);
    setForm({
      table_name: src.table_name, display_name: src.display_name,
      description: src.description || "", category: src.category || "general",
      is_active: src.is_active, allow_dashboards: src.allow_dashboards,
      allow_reports: src.allow_reports, allow_chatbots: src.allow_chatbots,
      allow_joins: src.allow_joins, allow_cross_analysis: src.allow_cross_analysis,
      priority: src.priority || 0,
    });
    setShowForm(true);
  };

  const filtered = sources?.filter(s =>
    s.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.table_name?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = sources?.filter(s => s.is_active).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Integraciones – Fuentes de Datos</h1>
          <p className="text-muted-foreground text-sm mt-1">Controla qué tablas están habilitadas para dashboards, reportes y chatbots</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Registrar tabla
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total tablas", value: sources?.length ?? 0, icon: Database },
          { label: "Activas", value: activeCount, icon: Check },
          { label: "Dashboards", value: sources?.filter(s => s.allow_dashboards).length ?? 0, icon: BarChart3 },
          { label: "Chatbots", value: sources?.filter(s => s.allow_chatbots).length ?? 0, icon: Bot },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar tabla..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabla</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Dashboards</TableHead>
                  <TableHead className="text-center">Reportes</TableHead>
                  <TableHead className="text-center">Chatbots</TableHead>
                  <TableHead className="text-center">Joins</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered && filtered.length > 0 ? (
                  filtered.map((src) => (
                    <TableRow key={src.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{src.display_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{src.table_name}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{src.category}</Badge></TableCell>
                      <TableCell>
                        <Switch
                          checked={src.is_active}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: src.id, field: "is_active", value: v })}
                        />
                      </TableCell>
                      {["allow_dashboards", "allow_reports", "allow_chatbots", "allow_joins"].map((field) => (
                        <TableCell key={field} className="text-center">
                          <Switch
                            checked={(src as any)[field]}
                            onCheckedChange={(v) => toggleMutation.mutate({ id: src.id, field, value: v })}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(src)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Database className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground">No hay tablas registradas</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar fuente de datos" : "Registrar nueva tabla"}</DialogTitle>
            <DialogDescription>Define las propiedades y permisos de la tabla</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre de tabla *</Label>
                <Input value={form.table_name} onChange={(e) => setForm({ ...form, table_name: e.target.value })} placeholder="leads" disabled={!!editingId} />
              </div>
              <div className="space-y-2">
                <Label>Nombre visible *</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Leads" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "is_active", label: "Activa" },
                { key: "allow_dashboards", label: "Dashboards" },
                { key: "allow_reports", label: "Reportes" },
                { key: "allow_chatbots", label: "Chatbots" },
                { key: "allow_joins", label: "Joins" },
                { key: "allow_cross_analysis", label: "Análisis cruzado" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label className="text-sm">{label}</Label>
                  <Switch checked={(form as any)[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.table_name.trim() || !form.display_name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : editingId ? "Actualizar" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

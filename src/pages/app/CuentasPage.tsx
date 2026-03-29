import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Building2, Plus, Upload, Search, ToggleLeft, ToggleRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const COUNTRIES = [
  "Argentina", "Bolivia", "Brasil", "Chile", "Colombia", "Costa Rica", "Cuba",
  "Ecuador", "El Salvador", "España", "Estados Unidos", "Guatemala", "Honduras",
  "México", "Nicaragua", "Panamá", "Paraguay", "Perú", "Puerto Rico",
  "República Dominicana", "Uruguay", "Venezuela",
];

interface TenantForm {
  name: string;
  country: string;
  primary_color: string;
}

const emptyForm: TenantForm = {
  name: "",
  country: "México",
  primary_color: "#0ea5e9",
};

export default function CuentasPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [bulkText, setBulkText] = useState("");

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (t: TenantForm) => {
      const slug = t.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { error } = await supabase.from("tenants").insert({
        name: t.name,
        slug,
        primary_color: t.primary_color,
        country: t.country,
        plan: "growth",
        language: "es",
        timezone: "America/Mexico_City",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Cuenta creada exitosamente");
      setShowCreate(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message || "Error al crear cuenta"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TenantForm> }) => {
      const updateData: any = { ...data };
      if (data.name) {
        updateData.slug = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      }
      const { error } = await supabase.from("tenants").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Cuenta actualizada");
      setEditingId(null);
      setForm(emptyForm);
      setShowCreate(false);
    },
    onError: (e: any) => toast.error(e.message || "Error al actualizar"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("tenants").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Estado actualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Cuenta eliminada definitivamente");
    },
    onError: (e: any) => toast.error(e.message || "Error al eliminar"),
  });

  const bulkMutation = useMutation({
    mutationFn: async (rows: { name: string; country: string; color: string }[]) => {
      const inserts = rows.map((r) => ({
        name: r.name,
        slug: r.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        country: r.country || "México",
        primary_color: r.color || "#0ea5e9",
        plan: "growth",
        language: "es",
        timezone: "America/Mexico_City",
      }));
      const { error } = await supabase.from("tenants").insert(inserts as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`${vars.length} cuentas creadas`);
      setShowBulk(false);
      setBulkText("");
    },
    onError: (e: any) => toast.error(e.message || "Error en creación masiva"),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleBulkSubmit = () => {
    const lines = bulkText.trim().split("\n").filter(Boolean);
    if (lines.length === 0) { toast.error("Ingresa al menos una línea"); return; }
    const rows = lines.map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      return { name: parts[0] || "", country: parts[1] || "México", color: parts[2] || "#0ea5e9" };
    });
    if (rows.some((r) => !r.name)) { toast.error("Algunas líneas no tienen nombre"); return; }
    bulkMutation.mutate(rows);
  };

  const openEdit = (tenant: any) => {
    setEditingId(tenant.id);
    setForm({
      name: tenant.name,
      country: tenant.country || "México",
      primary_color: tenant.primary_color || "#0ea5e9",
    });
    setShowCreate(true);
  };

  const filtered = tenants?.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Cuentas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona las cuentas de la plataforma</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4 mr-2" /> Masiva
          </Button>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nueva cuenta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{tenants?.length ?? "—"}</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ToggleRight className="h-5 w-5 text-emerald-500" /></div>
          <div><p className="text-sm text-muted-foreground">Activas</p><p className="text-2xl font-bold">{tenants?.filter((t) => t.is_active).length ?? "—"}</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><ToggleLeft className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-sm text-muted-foreground">Inactivas</p><p className="text-2xl font-bold">{tenants?.filter((t) => !t.is_active).length ?? "—"}</p></div>
        </div></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cuenta..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Color</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}</TableRow>
              )) : filtered && filtered.length > 0 ? filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: t.primary_color || "#0ea5e9" }} />
                  </TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(t as any).country || "—"}</TableCell>
                  <TableCell><Badge variant={t.is_active ? "default" : "destructive"}>{t.is_active ? "Activa" : "Inactiva"}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("es")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleMutation.mutate({ id: t.id, is_active: !t.is_active })}>
                        {t.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-destructive" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm(`¿Eliminar "${t.name}"?`)) deleteMutation.mutate(t.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No se encontraron cuentas</p>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </motion.div>

      {/* Create/Edit Dialog — simplified: name, country, color */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
            <DialogDescription>{editingId ? "Modifica los datos de la cuenta" : "Solo necesitas nombre, país y color"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="space-y-2">
              <Label>Nombre de la cuenta *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mi Empresa S.A." autoFocus />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar país" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-10 w-10 rounded-lg cursor-pointer border border-input p-0.5"
                />
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="flex-1 font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Guardando…" : editingId ? "Actualizar" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Creación masiva</DialogTitle>
            <DialogDescription>Una cuenta por línea: <code className="text-xs bg-muted px-1 rounded">nombre, país, color</code></DialogDescription>
          </DialogHeader>
          <Textarea rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={`Empresa Alpha, México, #0ea5e9\nEmpresa Beta, Colombia\nEmpresa Gamma`} className="font-mono text-sm" />
          <p className="text-xs text-muted-foreground">Solo el nombre es obligatorio.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulk(false)}>Cancelar</Button>
            <Button onClick={handleBulkSubmit} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Creando…" : `Crear ${bulkText.trim().split("\n").filter(Boolean).length} cuentas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

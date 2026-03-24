import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Building2, Plus, Upload, Search, ToggleLeft, ToggleRight, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TenantForm {
  name: string;
  slug: string;
  plan: string;
  primary_color: string;
  language: string;
  timezone: string;
}

const emptyForm: TenantForm = {
  name: "",
  slug: "",
  plan: "growth",
  primary_color: "#0ea5e9",
  language: "es",
  timezone: "America/Mexico_City",
};

const plans = ["starter", "growth", "enterprise"];
const timezones = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Buenos_Aires",
  "America/Santiago",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
];

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
    mutationFn: async (tenant: TenantForm) => {
      const { error } = await supabase.from("tenants").insert({
        name: tenant.name,
        slug: tenant.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        plan: tenant.plan,
        primary_color: tenant.primary_color,
        language: tenant.language,
        timezone: tenant.timezone,
      });
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
      const { error } = await supabase.from("tenants").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Cuenta actualizada");
      setEditingId(null);
      setForm(emptyForm);
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
    onError: (e: any) => toast.error(e.message || "Error al cambiar estado"),
  });

  const bulkMutation = useMutation({
    mutationFn: async (rows: TenantForm[]) => {
      const inserts = rows.map((r) => ({
        name: r.name,
        slug: r.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        plan: r.plan || "growth",
        primary_color: r.primary_color || "#0ea5e9",
        language: r.language || "es",
        timezone: r.timezone || "America/Mexico_City",
      }));
      const { error } = await supabase.from("tenants").insert(inserts);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`${vars.length} cuentas creadas exitosamente`);
      setShowBulk(false);
      setBulkText("");
    },
    onError: (e: any) => toast.error(e.message || "Error en creación masiva"),
  });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nombre y slug son obligatorios");
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
    if (lines.length === 0) {
      toast.error("Ingresa al menos una línea");
      return;
    }
    const rows: TenantForm[] = lines.map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      return {
        name: parts[0] || "",
        slug: parts[1] || parts[0]?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "",
        plan: parts[2] || "growth",
        primary_color: parts[3] || "#0ea5e9",
        language: parts[4] || "es",
        timezone: parts[5] || "America/Mexico_City",
      };
    });
    const invalid = rows.filter((r) => !r.name);
    if (invalid.length > 0) {
      toast.error("Algunas líneas no tienen nombre");
      return;
    }
    bulkMutation.mutate(rows);
  };

  const openEdit = (tenant: any) => {
    setEditingId(tenant.id);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      primary_color: tenant.primary_color || "#0ea5e9",
      language: tenant.language || "es",
      timezone: tenant.timezone || "America/Mexico_City",
    });
    setShowCreate(true);
  };

  const filtered = tenants?.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Cuentas (Tenants)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona las empresas/cuentas de la plataforma
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Creación masiva
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setShowCreate(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva cuenta
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total cuentas</p>
                <p className="text-2xl font-bold">{tenants?.length ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ToggleRight className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Activas</p>
                <p className="text-2xl font-bold">{tenants?.filter((t) => t.is_active).length ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ToggleLeft className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactivas</p>
                <p className="text-2xl font-bold">{tenants?.filter((t) => !t.is_active).length ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered && filtered.length > 0 ? (
                  filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{t.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{t.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? "default" : "destructive"}>
                          {t.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("es")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                         <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleMutation.mutate({ id: t.id, is_active: !t.is_active })}
                          >
                             {t.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => { if (window.confirm(`¿Eliminar definitivamente la cuenta "${t.name}"? Esta acción no se puede deshacer.`)) deleteMutation.mutate(t.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground">No se encontraron cuentas</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifica los datos de la cuenta" : "Completa los datos para crear una nueva cuenta"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mi Empresa S.A." />
              </div>
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="mi-empresa"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">Inglés</SelectItem>
                    <SelectItem value="pt">Portugués</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="h-10 w-10 rounded cursor-pointer border border-input"
                  />
                  <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zona horaria</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Guardando..." : editingId ? "Actualizar" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Creación masiva de cuentas</DialogTitle>
            <DialogDescription>
              Ingresa una cuenta por línea. Formato: <code className="text-xs bg-muted px-1 py-0.5 rounded">nombre, slug, plan, color, idioma, timezone</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={8}
              placeholder={`Empresa Alpha, empresa-alpha, growth, #0ea5e9, es, America/Mexico_City\nEmpresa Beta, empresa-beta, enterprise\nEmpresa Gamma, empresa-gamma`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Solo el nombre es obligatorio. Si omites campos, se usarán los valores por defecto (growth, #0ea5e9, es, America/Mexico_City).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulk(false)}>Cancelar</Button>
            <Button onClick={handleBulkSubmit} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Creando..." : `Crear ${bulkText.trim().split("\n").filter(Boolean).length} cuentas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

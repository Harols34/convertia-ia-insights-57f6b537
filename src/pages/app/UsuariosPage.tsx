import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Users, Plus, Search, Pencil, ToggleLeft, ToggleRight, Upload, Loader2, Building2 } from "lucide-react";
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
import { Constants } from "@/integrations/supabase/types";
import { useIsSuperAdmin } from "@/hooks/use-app-access";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const ROLES = Constants.public.Enums.app_role;

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "viewer" as string });
  const [bulkText, setBulkText] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["users-profiles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
      const { data, error } = await supabase.from("profiles").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name, slug").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: extraTenantIdsForEdit = [], isLoading: loadingExtraAccess } = useQuery({
    queryKey: ["user-tenant-access-edit", editingUser?.id],
    enabled: !!editingUser?.id && !!isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_tenant_access").select("tenant_id").eq("user_id", editingUser!.id);
      if (error) throw error;
      return (data || []).map((r) => r.tenant_id);
    },
  });

  const [tenantSelection, setTenantSelection] = useState<string[]>([]);
  const [primaryTenantId, setPrimaryTenantId] = useState<string>("");

  useEffect(() => {
    if (!editingUser || !isSuperAdmin) {
      setTenantSelection([]);
      setPrimaryTenantId("");
      return;
    }
    setTenantSelection([editingUser.tenant_id]);
    setPrimaryTenantId(editingUser.tenant_id);
  }, [editingUser?.id, isSuperAdmin]);

  useEffect(() => {
    if (!editingUser || !isSuperAdmin || loadingExtraAccess) return;
    const merged = Array.from(new Set([editingUser.tenant_id, ...extraTenantIdsForEdit]));
    setTenantSelection(merged);
    setPrimaryTenantId(editingUser.tenant_id);
  }, [editingUser?.id, editingUser?.tenant_id, extraTenantIdsForEdit, loadingExtraAccess, isSuperAdmin]);

  const getRolesForUser = (userId: string) => {
    return userRoles?.filter(r => r.user_id === userId).map(r => r.role) || [];
  };

  const createUserMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email: f.email, password: f.password, full_name: f.full_name,
          tenant_id: tenantId, role: f.role,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Error al crear usuario");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles-all"] });
      toast.success("Usuario creado exitosamente");
      setShowCreate(false);
      setForm({ email: "", password: "", full_name: "", role: "viewer" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-profiles"] });
      toast.success("Estado actualizado");
    },
  });

  const saveUserTenantAccessMutation = useMutation({
    mutationFn: async ({
      userId,
      primary,
      selected,
    }: {
      userId: string;
      primary: string;
      selected: string[];
    }) => {
      if (!selected.includes(primary)) throw new Error("La cuenta principal debe estar entre las seleccionadas");
      const { error: eProfile } = await supabase.from("profiles").update({ tenant_id: primary }).eq("id", userId);
      if (eProfile) throw eProfile;
      const { error: eDel } = await supabase.from("user_tenant_access").delete().eq("user_id", userId);
      if (eDel) throw eDel;
      const extras = selected.filter((id) => id !== primary);
      if (extras.length > 0) {
        const { error: eIns } = await supabase.from("user_tenant_access").insert(
          extras.map((tenant_id) => ({ user_id: userId, tenant_id })),
        );
        if (eIns) throw eIns;
      }
    },
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["users-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-tenant-access-edit", v.userId] });
      queryClient.invalidateQueries({ queryKey: ["user-tenant-access-list"] });
      setEditingUser((u: { id: string; tenant_id: string; full_name?: string } | null) =>
        u && u.id === v.userId ? { ...u, tenant_id: v.primary } : u,
      );
      toast.success("Acceso a cuentas actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTenantInSelection = (tid: string, checked: boolean) => {
    setTenantSelection((prev) => {
      if (checked) {
        if (prev.includes(tid)) return prev;
        const next = [...prev, tid];
        if (!primaryTenantId || !next.includes(primaryTenantId)) setPrimaryTenantId(tid);
        return next;
      }
      if (prev.length <= 1) {
        toast.error("Debe quedar al menos una cuenta con acceso");
        return prev;
      }
      const next = prev.filter((id) => id !== tid);
      if (tid === primaryTenantId) {
        setPrimaryTenantId(next[0] ?? "");
      }
      return next;
    });
  };

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Delete existing roles, then insert new one
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles-all"] });
      toast.success("Rol actualizado");
      setEditingUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (lines: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });

      const results = [];
      for (const line of lines) {
        const [email, password, fullName, role] = line.split(",").map(s => s.trim());
        if (!email || !password) continue;
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ email, password, full_name: fullName || email, tenant_id: tenantId, role: role || "viewer" }),
        });
        results.push(await resp.json());
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["users-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles-all"] });
      toast.success(`${results.length} usuarios procesados`);
      setShowBulk(false);
      setBulkText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = profiles?.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.id?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Usuarios</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona usuarios, roles y accesos del tenant</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="h-4 w-4 mr-2" /> Creación masiva
          </Button>
          <Button onClick={() => { setForm({ email: "", password: "", full_name: "", role: "viewer" }); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo usuario
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{profiles?.length ?? 0}</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ToggleRight className="h-5 w-5 text-emerald-500" /></div>
          <div><p className="text-sm text-muted-foreground">Activos</p><p className="text-2xl font-bold">{profiles?.filter(p => p.is_active).length ?? 0}</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center"><ToggleLeft className="h-5 w-5 text-red-500" /></div>
          <div><p className="text-sm text-muted-foreground">Inactivos</p><p className="text-2xl font-bold">{profiles?.filter(p => !p.is_active).length ?? 0}</p></div>
        </div></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar usuario..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}</TableRow>
              )) : filtered && filtered.length > 0 ? filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><p className="font-medium">{p.full_name}</p><p className="text-xs text-muted-foreground font-mono">{p.id.slice(0, 8)}...</p></TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {getRolesForUser(p.id).map(r => <Badge key={r} variant="secondary" className="text-xs capitalize">{r}</Badge>)}
                      {getRolesForUser(p.id).length === 0 && <Badge variant="outline" className="text-xs">Sin rol</Badge>}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={p.is_active ? "default" : "destructive"}>{p.is_active ? "Activo" : "Inactivo"}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString("es")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Editar usuario" onClick={() => setEditingUser(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}>
                        {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No se encontraron usuarios</p>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </motion.div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>Crea un nuevo usuario para este tenant</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Contraseña *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nombre completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={() => createUserMutation.mutate(form)} disabled={!form.email || !form.password || createUserMutation.isPending}>
              {createUserMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Creación masiva de usuarios</DialogTitle>
            <DialogDescription>Un usuario por línea: <code className="text-xs bg-muted px-1 rounded">email, contraseña, nombre, rol</code></DialogDescription>
          </DialogHeader>
          <Textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="user@email.com, Pass123!, Juan Pérez, viewer" className="font-mono text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulk(false)}>Cancelar</Button>
            <Button onClick={() => bulkCreateMutation.mutate(bulkText.trim().split("\n").filter(Boolean))} disabled={!bulkText.trim() || bulkCreateMutation.isPending}>
              {bulkCreateMutation.isPending ? "Procesando..." : "Crear usuarios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user: role + cuentas (multi) */}
      <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar usuario – {editingUser?.full_name}</DialogTitle>
            <DialogDescription>
              Rol del sistema y, si aplica, en qué cuentas (tenants) puede trabajar el usuario.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Rol</Label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={getRolesForUser(editingUser?.id || "").includes(r) ? "default" : "outline"}
                      className="capitalize"
                      onClick={() => editingUser && updateRoleMutation.mutate({ userId: editingUser.id, role: r })}
                      disabled={updateRoleMutation.isPending}
                    >
                      {r.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {isSuperAdmin ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    Cuentas con acceso
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marca una o varias cuentas. La <strong>cuenta principal</strong> es la del perfil (<code className="text-[10px] bg-muted px-1 rounded">profiles.tenant_id</code>); el resto se guardan como acceso adicional para el selector de cuenta.
                  </p>
                  {loadingExtraAccess && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Cargando accesos actuales…
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs">Cuenta principal</Label>
                    <Select
                      value={primaryTenantId}
                      onValueChange={(v) => setPrimaryTenantId(v)}
                      disabled={
                        tenantSelection.length === 0 ||
                        saveUserTenantAccessMutation.isPending ||
                        loadingExtraAccess
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Elegir cuenta principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenantSelection.map((id) => {
                          const t = tenants?.find((x) => x.id === id);
                          return (
                            <SelectItem key={id} value={id}>
                              {t?.name ?? id.slice(0, 8) + "…"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <Label className="text-xs text-muted-foreground">Incluir acceso a</Label>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {(tenants || []).map((t) => {
                        const checked = tenantSelection.includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleTenantInSelection(t.id, v === true)}
                              disabled={saveUserTenantAccessMutation.isPending || loadingExtraAccess}
                            />
                            <span className="text-sm flex-1">{t.name}</span>
                            {t.id === primaryTenantId && (
                              <Badge variant="secondary" className="text-[10px]">Principal</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      saveUserTenantAccessMutation.isPending ||
                      loadingExtraAccess ||
                      !editingUser ||
                      tenantSelection.length === 0 ||
                      !primaryTenantId
                    }
                    onClick={() =>
                      editingUser &&
                      saveUserTenantAccessMutation.mutate({
                        userId: editingUser.id,
                        primary: primaryTenantId,
                        selected: tenantSelection,
                      })
                    }
                  >
                    {saveUserTenantAccessMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando cuentas…
                      </>
                    ) : (
                      "Guardar acceso a cuentas"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Cuenta del perfil</p>
                  <p>
                    Este usuario pertenece a:{" "}
                    <strong>{tenants?.find((x) => x.id === editingUser?.tenant_id)?.name ?? "—"}</strong>
                  </p>
                  <p className="text-xs">
                    Para asignar acceso a varias cuentas, hace falta un super administrador.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Users, Plus, Search, Pencil, ToggleLeft, ToggleRight, Upload, ShieldCheck, Loader2 } from "lucide-react";
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

const ROLES = Constants.public.Enums.app_role;

export default function UsuariosPage() {
  const queryClient = useQueryClient();
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
      const { data } = await supabase.from("tenants").select("id, name");
      return data || [];
    },
  });

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
                      <Button size="icon" variant="ghost" onClick={() => setEditingUser(p)}>
                        <ShieldCheck className="h-4 w-4" />
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

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar rol – {editingUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Seleccionar rol</Label>
            {ROLES.map((r) => (
              <Button
                key={r}
                variant={getRolesForUser(editingUser?.id || "").includes(r) ? "default" : "outline"}
                className="mr-2 mb-2 capitalize"
                onClick={() => editingUser && updateRoleMutation.mutate({ userId: editingUser.id, role: r })}
                disabled={updateRoleMutation.isPending}
              >
                {r}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

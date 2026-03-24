import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ShieldCheck, Plus, Search, Pencil, Trash2, Users, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";

const SYSTEM_ROLES = Constants.public.Enums.app_role;

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [customForm, setCustomForm] = useState({ name: "", description: "" });

  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  const { data: permissions } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("permissions").select("*, modules(name, slug)");
      return data || [];
    },
  });

  const { data: rolePermissions } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("role_permissions").select("*");
      return data || [];
    },
  });

  const { data: customRoles, isLoading: loadingCustom } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
      const { data } = await supabase.from("custom_roles").select("*").eq("tenant_id", tenantId).order("created_at");
      return data || [];
    },
  });

  const { data: customRolePerms } = useQuery({
    queryKey: ["custom-role-permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_role_permissions").select("*");
      return data || [];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-count"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      return data || [];
    },
  });

  const createCustomRole = useMutation({
    mutationFn: async (f: { name: string; description: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
      const { error } = await supabase.from("custom_roles").insert({ name: f.name, description: f.description, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Rol personalizado creado");
      setShowCustomForm(false);
      setCustomForm({ name: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getPermissionsForRole = (role: string) =>
    rolePermissions?.filter(rp => rp.role === role).map(rp => rp.permission_id) || [];

  const getUserCountForRole = (role: string) =>
    userRoles?.filter(ur => ur.role === role).length || 0;

  const permissionsByModule = modules?.map(mod => ({
    module: mod,
    perms: permissions?.filter(p => p.module_id === mod.id) || [],
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Roles y Permisos</h1>
          <p className="text-muted-foreground text-sm mt-1">Configura roles del sistema y permisos granulares por módulo</p>
        </div>
        <Button onClick={() => { setCustomForm({ name: "", description: "" }); setShowCustomForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo rol personalizado
        </Button>
      </div>

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">Roles del Sistema</TabsTrigger>
          <TabsTrigger value="custom">Roles Personalizados</TabsTrigger>
          <TabsTrigger value="matrix">Matriz de Permisos</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SYSTEM_ROLES.map((role) => (
              <motion.div key={role} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm capitalize flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />{role.replace("_", " ")}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />{getUserCountForRole(role)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {getPermissionsForRole(role).length} permisos asignados
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {permissions?.filter(p => getPermissionsForRole(role).includes(p.id)).slice(0, 5).map(p => (
                        <Badge key={p.id} variant="outline" className="text-[10px]">{p.action}</Badge>
                      ))}
                      {getPermissionsForRole(role).length > 5 && (
                        <Badge variant="outline" className="text-[10px]">+{getPermissionsForRole(role).length - 5} más</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {loadingCustom ? (
            <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : customRoles && customRoles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customRoles.map((cr) => (
                <Card key={cr.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cr.name}</p>
                        <p className="text-xs text-muted-foreground">{cr.description || "Sin descripción"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {customRolePerms?.filter(p => p.custom_role_id === cr.id).length || 0} permisos
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="py-12 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No hay roles personalizados</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10">Módulo / Acción</TableHead>
                  {SYSTEM_ROLES.map(r => (
                    <TableHead key={r} className="text-center capitalize text-xs">{r.replace("_", " ")}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissionsByModule.map(({ module: mod, perms }) => (
                  perms.map((perm) => (
                    <TableRow key={perm.id}>
                      <TableCell className="sticky left-0 bg-card z-10">
                        <div>
                          <span className="text-xs text-muted-foreground">{mod.name}</span>
                          <p className="text-sm font-medium">{perm.action}</p>
                        </div>
                      </TableCell>
                      {SYSTEM_ROLES.map(role => (
                        <TableCell key={role} className="text-center">
                          {getPermissionsForRole(role).includes(perm.id) ? (
                            <Badge variant="default" className="text-[10px]">✓</Badge>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ))}
                {permissionsByModule.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={SYSTEM_ROLES.length + 1} className="text-center py-8 text-muted-foreground">
                      No hay permisos configurados aún
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCustomForm} onOpenChange={setShowCustomForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo rol personalizado</DialogTitle>
            <DialogDescription>Crea un rol específico para tu organización</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Nombre *</Label><Input value={customForm.name} onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })} placeholder="Supervisor de ventas" /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={customForm.description} onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomForm(false)}>Cancelar</Button>
            <Button onClick={() => createCustomRole.mutate(customForm)} disabled={!customForm.name.trim() || createCustomRole.isPending}>
              {createCustomRole.isPending ? "Creando..." : "Crear rol"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

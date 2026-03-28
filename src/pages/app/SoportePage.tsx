import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { HelpCircle, Plus, Search, MessageSquare, Clock, AlertTriangle, CheckCircle, Loader2, Send } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Abierto", variant: "destructive" },
  in_progress: { label: "En progreso", variant: "default" },
  resolved: { label: "Resuelto", variant: "secondary" },
  closed: { label: "Cerrado", variant: "outline" },
};

const priorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Baja", variant: "outline" },
  medium: { label: "Media", variant: "secondary" },
  high: { label: "Alta", variant: "default" },
  critical: { label: "Crítica", variant: "destructive" },
};

export default function SoportePage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const location = useLocation();
  const [accessNotice, setAccessNotice] = useState<{ from?: string; module?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });
  const [comment, setComment] = useState("");

  useEffect(() => {
    const st = location.state as { accessDenied?: boolean; from?: string; module?: string } | undefined;
    if (st?.accessDenied) {
      setAccessNotice({ from: st.from, module: st.module });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "todos") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["ticket-comments", selectedTicket?.id],
    enabled: !!selectedTicket,
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const createTicket = useMutation({
    mutationFn: async (f: typeof form) => {
      if (!user) throw new Error("No autenticado");
      const { data: tenantId } = await supabase.rpc("get_user_tenant", { _user_id: user.id });
      const { error } = await supabase.from("support_tickets").insert({
        tenant_id: tenantId, user_id: user.id,
        title: f.title, description: f.description, priority: f.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Ticket creado");
      setShowCreate(false);
      setForm({ title: "", description: "", priority: "medium" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("Estado actualizado");
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: string; content: string }) => {
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId, user_id: user.id, content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
      setComment("");
      toast.success("Comentario agregado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = tickets?.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = tickets?.filter(t => t.status === "open").length ?? 0;
  const inProgressCount = tickets?.filter(t => t.status === "in_progress").length ?? 0;

  return (
    <div className="space-y-6">
      {accessNotice && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin acceso a ese módulo</AlertTitle>
          <AlertDescription className="text-sm space-y-3">
            <p>
              {accessNotice.module
                ? `No tienes permiso para ver el módulo «${accessNotice.module}».`
                : "No tienes permiso para acceder a esa sección."}{" "}
              Si necesitas acceso, crea un ticket aquí o contacta a tu administrador.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/app">Ir al inicio</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAccessNotice(null)}>
                Cerrar aviso
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Soporte</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestiona tickets de soporte y solicitudes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm({
                title: "Solicitud: alta o cambio de bot (IA / manual)",
                description:
                  "Describe el uso previsto del bot, canal (web, etc.) y si necesitas integración con datos concretos. Un administrador revisará la solicitud.",
                priority: "medium",
              });
              setShowCreate(true);
            }}
          >
            Plantilla: bots
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm({
                title: "Solicitud: acceso a módulo o cuenta adicional",
                description:
                  "Indica qué módulos o cuentas (tenants) necesitas y el motivo. Tu administrador o soporte podrá ajustar roles y permisos.",
                priority: "medium",
              });
              setShowCreate(true);
            }}
          >
            Plantilla: permisos
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo ticket
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: tickets?.length ?? 0, icon: HelpCircle, color: "bg-primary/10 text-primary" },
          { label: "Abiertos", value: openCount, icon: AlertTriangle, color: "bg-red-500/10 text-red-500" },
          { label: "En progreso", value: inProgressCount, icon: Clock, color: "bg-amber-500/10 text-amber-500" },
          { label: "Resueltos", value: tickets?.filter(t => t.status === "resolved" || t.status === "closed").length ?? 0, icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-500" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-6"><div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
          </div></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar ticket..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
              )) : filtered && filtered.length > 0 ? filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedTicket(t)}>
                  <TableCell><p className="font-medium">{t.title}</p><p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p></TableCell>
                  <TableCell><Badge variant={statusConfig[t.status]?.variant || "outline"}>{statusConfig[t.status]?.label || t.status}</Badge></TableCell>
                  <TableCell><Badge variant={priorityConfig[t.priority]?.variant || "outline"}>{priorityConfig[t.priority]?.label || t.priority}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("es")}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedTicket(t); }}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center py-12">
                  <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No hay tickets</p>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </motion.div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo ticket de soporte</DialogTitle><DialogDescription>Describe tu solicitud o problema</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={() => createTicket.mutate(form)} disabled={!form.title.trim() || createTicket.isPending}>
              {createTicket.isPending ? "Creando..." : "Crear ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => { if (!o) setSelectedTicket(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{selectedTicket?.title}</DialogTitle></DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={statusConfig[selectedTicket.status]?.variant}>{statusConfig[selectedTicket.status]?.label}</Badge>
                <Badge variant={priorityConfig[selectedTicket.priority]?.variant}>{priorityConfig[selectedTicket.priority]?.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>

              <div className="flex gap-2">
                <Label className="text-sm">Cambiar estado:</Label>
                <Select value={selectedTicket.status} onValueChange={(v) => { updateStatus.mutate({ id: selectedTicket.id, status: v }); setSelectedTicket({ ...selectedTicket, status: v }); }}>
                  <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="border-t border-border pt-3">
                <Label className="text-sm font-medium">Comentarios</Label>
                <ScrollArea className="h-[200px] mt-2">
                  <div className="space-y-2">
                    {comments && comments.length > 0 ? comments.map((c: any) => (
                      <div key={c.id} className="rounded-lg bg-muted p-3">
                        <p className="text-sm">{c.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString("es")}</p>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">Sin comentarios</p>}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 mt-3">
                  <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Agregar comentario..." className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) addComment.mutate({ ticketId: selectedTicket.id, content: comment }); }}
                  />
                  <Button size="icon" onClick={() => comment.trim() && addComment.mutate({ ticketId: selectedTicket.id, content: comment })} disabled={!comment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

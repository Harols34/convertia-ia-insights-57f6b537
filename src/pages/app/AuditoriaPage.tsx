import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ScrollText, Search, Filter, Eye, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MODULES = ["todos", "auth", "users", "bots", "dashdinamics", "integraciones", "cuentas", "roles", "configuracion", "reportes"];
const ACTIONS = ["todos", "login", "logout", "create", "update", "delete", "toggle", "export", "error"];

export default function AuditoriaPage() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("todos");
  const [actionFilter, setActionFilter] = useState("todos");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", moduleFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (moduleFilter !== "todos") query = query.eq("module", moduleFilter);
      if (actionFilter !== "todos") query = query.eq("action", actionFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = logs?.filter(l =>
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.module?.toLowerCase().includes(search.toLowerCase()) ||
    l.user_id?.includes(search)
  );

  const actionColor = (action: string) => {
    if (action.includes("delete")) return "destructive";
    if (action.includes("create")) return "default";
    if (action.includes("login")) return "secondary";
    return "outline";
  };

  const exportCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ["Fecha", "Módulo", "Acción", "Usuario", "IP", "Detalle"];
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleString("es"),
      l.module || "",
      l.action,
      l.user_id || "",
      l.ip_address || "",
      JSON.stringify(l.detail || {}),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Auditoría y Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro de eventos, acciones y cambios en la plataforma</p>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!filtered?.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ScrollText className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Total registros</p><p className="text-2xl font-bold">{logs?.length ?? 0}</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Calendar className="h-5 w-5 text-amber-500" /></div>
          <div><p className="text-sm text-muted-foreground">Hoy</p><p className="text-2xl font-bold">{logs?.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length ?? 0}</p></div>
        </div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center"><Filter className="h-5 w-5 text-red-500" /></div>
          <div><p className="text-sm text-muted-foreground">Módulos</p><p className="text-2xl font-bold">{new Set(logs?.map(l => l.module)).size}</p></div>
        </div></CardContent></Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>{MODULES.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Acción" /></SelectTrigger>
          <SelectContent>{ACTIONS.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>IP</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
              )) : filtered && filtered.length > 0 ? filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("es")}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs capitalize">{log.module || "—"}</Badge></TableCell>
                  <TableCell><Badge variant={actionColor(log.action)} className="text-xs">{log.action}</Badge></TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{log.user_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ip_address || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setSelectedLog(log)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <ScrollText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">No se encontraron registros</p>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </motion.div>

      <Dialog open={!!selectedLog} onOpenChange={(o) => { if (!o) setSelectedLog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Detalle del evento</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Fecha:</span> <span className="font-medium">{new Date(selectedLog.created_at).toLocaleString("es")}</span></div>
                <div><span className="text-muted-foreground">Módulo:</span> <Badge variant="secondary" className="capitalize">{selectedLog.module}</Badge></div>
                <div><span className="text-muted-foreground">Acción:</span> <Badge variant={actionColor(selectedLog.action)}>{selectedLog.action}</Badge></div>
                <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{selectedLog.ip_address || "—"}</span></div>
              </div>
              <div><span className="text-muted-foreground">Usuario ID:</span> <span className="font-mono text-xs">{selectedLog.user_id || "—"}</span></div>
              <div>
                <span className="text-muted-foreground">Detalle:</span>
                <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-60">{JSON.stringify(selectedLog.detail, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

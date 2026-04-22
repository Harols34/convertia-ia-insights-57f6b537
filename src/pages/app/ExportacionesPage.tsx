import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, FileSpreadsheet, FileText, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { resolveWritableTenantId } from "@/lib/accessible-tenant";

interface ExportRow {
  id: string;
  export_type: string;
  source_module: string;
  file_name: string;
  created_at: string;
  metadata: any;
}

export default function ExportacionesPage() {
  const { user } = useAuth();
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("exports").select("*").order("created_at", { ascending: false }).limit(100);
      setExports((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const quickExport = async (type: "csv" | "xlsx") => {
    const { data, error } = await supabase.rpc("accessible_leads_report_page", {
      _page: 1,
      _page_size: 200,
      _search: null,
      _cliente: null,
      _bpo: null,
    });
    if (error) {
      toast({ title: "No se pudo preparar la exportación", description: error.message, variant: "destructive" });
      return;
    }
    const leads = (data as any[]) ?? [];
    if (!leads || leads.length === 0) {
      toast({ title: "Sin datos", description: "No hay leads para exportar", variant: "destructive" });
      return;
    }

    const headers = ["cliente", "id_lead", "campana_mkt", "bpo", "ciudad", "result_prim_gestion", "result_negocio", "fch_creacion"];
    const csv = [headers.join(","), ...leads.map((l: any) => headers.map((h) => `"${l[h] || ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = `exportacion_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    if (user) {
      const tenantId = await resolveWritableTenantId(user.id);
      if (tenantId) {
        await supabase.from("exports").insert({
          tenant_id: tenantId,
          user_id: user.id,
          export_type: type,
          source_module: "exportaciones",
          file_name: fileName,
          metadata: { total_rows: leads.length, scope: "first_200" },
        });
        const { data: updated } = await supabase.from("exports").select("*").order("created_at", { ascending: false }).limit(100);
        setExports((updated as any[]) || []);
      }
    }

    toast({ title: "Exportación generada", description: `${leads.length} registros exportados` });
  };

  const typeIcon: Record<string, typeof FileText> = {
    csv: FileSpreadsheet,
    xlsx: FileSpreadsheet,
    pdf: FileText,
    pptx: FileText,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Exportaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Exporta datos y consulta el historial de descargas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => quickExport("csv")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button onClick={() => quickExport("xlsx")}>
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
        </div>
      </div>

      {/* History */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="font-display font-semibold text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Historial de Exportaciones
            </h2>
          </div>
          {exports.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Download className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay exportaciones registradas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((e) => {
                  const Icon = typeIcon[e.export_type] || FileText;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{e.file_name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase">{e.export_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.source_module || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{e.metadata?.total_rows || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("es")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </motion.div>
    </div>
  );
}

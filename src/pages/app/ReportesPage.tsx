import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileBarChart, Loader2, Filter, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/app/LeadsTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { resolveWritableTenantId } from "@/lib/accessible-tenant";

type LeadReportRow = {
  id: string;
  cliente?: string | null;
  id_lead?: string | null;
  campana_mkt?: string | null;
  bpo?: string | null;
  ciudad?: string | null;
  result_prim_gestion?: string | null;
  result_negocio?: string | null;
  fch_creacion?: string | null;
  total_count?: number | null;
};

export default function ReportesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeadReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ cliente?: string; bpo?: string }>({});
  const [filterOpts, setFilterOpts] = useState<{ clientes: string[]; bpos: string[] }>({ clientes: [], bpos: [] });
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("accessible_leads_report_filters");
      if (error) {
        toast({ title: "No se pudieron cargar los filtros", description: error.message, variant: "destructive" });
        return;
      }
      const payload = (data ?? {}) as { clientes?: string[]; bpos?: string[] };
      setFilterOpts({
        clientes: Array.isArray(payload.clientes) ? payload.clientes : [],
        bpos: Array.isArray(payload.bpos) ? payload.bpos : [],
      });
    })();
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("accessible_leads_report_page", {
        _page: page,
        _page_size: 25,
        _search: null,
        _cliente: filters.cliente ?? null,
        _bpo: filters.bpo ?? null,
      });
      if (cancelled) return;
      if (error) {
        setRows([]);
        setTotalRows(0);
        toast({ title: "No se pudieron cargar los reportes", description: error.message, variant: "destructive" });
      } else {
        const nextRows = ((data as LeadReportRow[] | null) ?? []);
        setRows(nextRows);
        setTotalRows(nextRows[0]?.total_count ?? 0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, page, toast]);

  const exportCSV = async () => {
    if (rows.length === 0) return;
    const headers = ["cliente", "id_lead", "campana_mkt", "bpo", "ciudad", "result_prim_gestion", "result_negocio", "fch_creacion"];
    const csv = [headers.join(","), ...rows.map((l) => headers.map((h) => `"${String((l as Record<string, unknown>)[h] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Log export
    if (user) {
      const tenantId = await resolveWritableTenantId(user.id);
      if (tenantId) {
        await supabase.from("exports").insert({
        tenant_id: tenantId,
        user_id: user.id,
        export_type: "csv",
        source_module: "reportes",
        file_name: `reporte_leads_${new Date().toISOString().slice(0, 10)}.csv`,
        metadata: { total_rows: rows.length, filters, scope: "page" },
      });
      }
    }

    toast({ title: "Exportación completada", description: `${rows.length} registros exportados a CSV` });
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground mt-1">Genera y consulta reportes de leads con filtros avanzados</p>
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.cliente || "all"} onValueChange={(v) => { setPage(1); setFilters({ ...filters, cliente: v === "all" ? undefined : v }); }}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterOpts.clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.bpo || "all"} onValueChange={(v) => { setPage(1); setFilters({ ...filters, bpo: v === "all" ? undefined : v }); }}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="BPO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterOpts.bpos.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex gap-6 text-sm">
            <div><span className="text-muted-foreground">Total filtrado:</span> <strong>{totalRows.toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">Página:</span> <strong>{page}</strong></div>
            <div><span className="text-muted-foreground">Registros visibles:</span> <strong>{rows.length}</strong></div>
          </div>
        </div>
        <LeadsTable leads={rows} pageSize={25} />
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Mostrando {(rows.length > 0 ? ((page - 1) * 25) + 1 : 0).toLocaleString("es")}–{Math.min(page * 25, totalRows).toLocaleString("es")} de {totalRows.toLocaleString("es")}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page * 25 >= totalRows || loading} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileBarChart, Loader2, Filter, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/app/LeadsTable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { fetchAllIntegrationRows } from "@/components/integraciones/fetch-integration-table";
import { resolveWritableTenantId } from "@/lib/accessible-tenant";

export default function ReportesPage() {
  const { user } = useAuth();
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ cliente?: string; bpo?: string }>({});
  const [filterOpts, setFilterOpts] = useState<{ clientes: string[]; bpos: string[] }>({ clientes: [], bpos: [] });
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const rows = (await fetchAllIntegrationRows(supabase, "leads")) as any[];
        if (cancelled) return;
        setAllLeads(rows);
        setFilterOpts({
          clientes: [...new Set(rows.map((l) => l.cliente).filter(Boolean))] as string[],
          bpos: [...new Set(rows.map((l) => l.bpo).filter(Boolean))] as string[],
        });
      } catch (error) {
        if (!cancelled) {
          setAllLeads([]);
          toast({ title: "No se pudieron cargar los reportes", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetch();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const leads = useMemo(
    () =>
      allLeads.filter((lead) => {
        if (filters.cliente && lead.cliente !== filters.cliente) return false;
        if (filters.bpo && lead.bpo !== filters.bpo) return false;
        return true;
      }),
    [allLeads, filters],
  );

  const exportCSV = async () => {
    if (leads.length === 0) return;
    const headers = ["cliente", "id_lead", "campana_mkt", "bpo", "ciudad", "result_prim_gestion", "result_negocio", "fch_creacion"];
    const csv = [
      headers.join(","),
      ...leads.map((l) => headers.map((h) => `"${String(l[h] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
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
        metadata: { total_rows: leads.length, filters },
      });
      }
    }

    toast({ title: "Exportación completada", description: `${leads.length} registros exportados a CSV` });
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
          <Select value={filters.cliente || "all"} onValueChange={(v) => setFilters({ ...filters, cliente: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterOpts.clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.bpo || "all"} onValueChange={(v) => setFilters({ ...filters, bpo: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="BPO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filterOpts.bpos.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportCSV} disabled={leads.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex gap-6 text-sm">
            <div><span className="text-muted-foreground">Total registros:</span> <strong>{leads.length.toLocaleString()}</strong></div>
            <div><span className="text-muted-foreground">Con negocio:</span> <strong>{leads.filter((l) => l.result_negocio).length}</strong></div>
            <div><span className="text-muted-foreground">Con gestión:</span> <strong>{leads.filter((l) => l.result_prim_gestion).length}</strong></div>
          </div>
        </div>
        <LeadsTable leads={leads} />
      </motion.div>
    </div>
  );
}

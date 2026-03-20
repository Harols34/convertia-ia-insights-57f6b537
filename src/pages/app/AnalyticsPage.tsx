import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Filter, Loader2, TrendingUp, Users, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadsBarChart, LeadsPieChart } from "@/components/app/LeadsChart";
import { LeadsTable } from "@/components/app/LeadsTable";
import { supabase } from "@/integrations/supabase/client";

interface AnalyticsData {
  total: number;
  conNegocio: number;
  conGestion: number;
  tasaGestion: string;
  tasaNegocio: string;
  porCliente: { name: string; value: number }[];
  porCampanaMkt: { name: string; value: number }[];
  porBpo: { name: string; value: number }[];
  porResultNegocio: { name: string; value: number }[];
  porCiudad: { name: string; value: number }[];
  porResultPrimGestion: { name: string; value: number }[];
  porCategoriaMkt: { name: string; value: number }[];
  filterOptions: { clientes: string[]; campanas: string[]; bpos: string[] };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ cliente?: string; campana_mkt?: string; bpo?: string }>({});

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ filters }),
    });
    const result = await res.json();
    setData(result);

    // Fetch raw leads for table
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
    if (filters.cliente) query = query.eq("cliente", filters.cliente);
    if (filters.campana_mkt) query = query.eq("campana_mkt", filters.campana_mkt);
    if (filters.bpo) query = query.eq("bpo", filters.bpo);
    const { data: leadsData } = await query;
    setLeads(leadsData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filters]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: "Total Leads", value: data.total.toLocaleString(), icon: Users },
    { label: "Con Gestión", value: data.conGestion.toLocaleString(), icon: MessageSquare },
    { label: "Tasa Gestión", value: `${data.tasaGestion}%`, icon: BarChart3 },
    { label: "Tasa Negocio", value: `${data.tasaNegocio}%`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Analytics Conversacional</h1>
          <p className="text-sm text-muted-foreground mt-1">Análisis de leads y gestiones en todos tus canales</p>
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filters.cliente || "all"} onValueChange={(v) => setFilters({ ...filters, cliente: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {data.filterOptions.clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.bpo || "all"} onValueChange={(v) => setFilters({ ...filters, bpo: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="BPO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los BPO</SelectItem>
              {data.filterOptions.bpos.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className="text-2xl font-mono font-bold">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <LeadsBarChart data={data.porCliente} title="Leads por Cliente" />
        <LeadsPieChart data={data.porBpo} title="Distribución por BPO" />
        <LeadsBarChart data={data.porCampanaMkt} title="Leads por Campaña MKT" />
        <LeadsPieChart data={data.porResultNegocio} title="Resultados de Negocio" />
        <LeadsBarChart data={data.porCiudad} title="Leads por Ciudad" />
        <LeadsPieChart data={data.porCategoriaMkt} title="Categoría MKT" />
      </div>

      {/* Table */}
      <LeadsTable leads={leads} />
    </div>
  );
}

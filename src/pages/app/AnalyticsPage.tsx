import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Filter, Loader2, TrendingUp, Users, BarChart3, Calendar, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [showFilters, setShowFilters] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ filters }),
    });
    const result = await res.json();
    if (result.error) { setLoading(false); return; }
    setData(result);

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
    { label: "Total Leads", value: data.total.toLocaleString(), icon: Users, accent: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-500" },
    { label: "Con Gestión", value: data.conGestion.toLocaleString(), icon: MessageSquare, accent: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-500" },
    { label: "Tasa Gestión", value: `${data.tasaGestion}%`, icon: BarChart3, accent: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-500" },
    { label: "Tasa Negocio", value: `${data.tasaNegocio}%`, icon: TrendingUp, accent: "from-violet-500/20 to-violet-600/5", iconColor: "text-violet-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <SlidersHorizontal className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard Dinámicos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Análisis interactivo de leads y gestiones</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-3 p-4 rounded-xl border border-border bg-card/50">
          <Select value={filters.cliente || "all"} onValueChange={(v) => setFilters({ ...filters, cliente: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {data.filterOptions.clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.bpo || "all"} onValueChange={(v) => setFilters({ ...filters, bpo: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="BPO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los BPO</SelectItem>
              {data.filterOptions.bpos.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filters.cliente || filters.bpo || filters.campana_mkt) && (
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={() => setFilters({})}>Limpiar</Button>
          )}
        </motion.div>
      )}

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="relative overflow-hidden p-5 rounded-xl border border-border bg-card group hover:shadow-lg transition-all">
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/50">
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
              </div>
              <p className="text-3xl font-display font-bold tracking-tight">{kpi.value}</p>
            </div>
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

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, MessageSquare, BarChart3, ArrowUpRight, Loader2, Filter, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LeadsBarChart, LeadsPieChart } from "@/components/app/LeadsChart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LeadStats {
  total: number;
  conGestion: number;
  conNegocio: number;
  ventas: number;
  tasaGestion: string;
  tasaNegocio: string;
  tasaConversion: string;
  porCliente: { name: string; value: number }[];
  porCampanaMkt: { name: string; value: number }[];
  porCiudad: { name: string; value: number }[];
  porResultNegocio: { name: string; value: number }[];
  porResultPrimGestion: { name: string; value: number }[];
  filterOptions: { clientes: string[]; campanas: string[]; ciudades: string[] };
}

function countBy(arr: any[], key: string): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  arr.forEach((item) => {
    const val = item[key];
    if (val) map[val] = (map[val] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function unique(arr: any[], key: string): string[] {
  return [...new Set(arr.map(i => i[key]).filter(Boolean))].sort() as string[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [filters, setFilters] = useState<{ cliente?: string; campana?: string; ciudad?: string; desde?: string; hasta?: string }>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(1000);
      if (filters.cliente) query = query.eq("cliente", filters.cliente);
      if (filters.campana) query = query.eq("campana_mkt", filters.campana);
      if (filters.ciudad) query = query.eq("ciudad", filters.ciudad);
      if (filters.desde) query = query.gte("fch_creacion", filters.desde);
      if (filters.hasta) query = query.lte("fch_creacion", filters.hasta);

      const { data: leads } = await query;

      if (leads && leads.length > 0) {
        const total = leads.length;
        const conGestion = leads.filter((l) => l.result_prim_gestion && l.result_prim_gestion !== "").length;
        const conNegocio = leads.filter((l) => l.result_negocio && l.result_negocio !== "").length;
        const ventas = leads.filter((l) => l.es_venta).length;

        setStats({
          total, conGestion, conNegocio, ventas,
          tasaGestion: total > 0 ? ((conGestion / total) * 100).toFixed(1) : "0",
          tasaNegocio: total > 0 ? ((conNegocio / total) * 100).toFixed(1) : "0",
          tasaConversion: total > 0 ? ((ventas / total) * 100).toFixed(1) : "0",
          porCliente: countBy(leads, "cliente"),
          porCampanaMkt: countBy(leads, "campana_mkt"),
          porCiudad: countBy(leads, "ciudad"),
          porResultNegocio: countBy(leads, "result_negocio"),
          porResultPrimGestion: countBy(leads, "result_prim_gestion"),
          filterOptions: {
            clientes: unique(leads, "cliente"),
            campanas: unique(leads, "campana_mkt"),
            ciudades: unique(leads, "ciudad"),
          },
        });
      } else {
        setStats(null);
      }

      const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5);
      setActivity(logs || []);
      setLoading(false);
    };
    loadData();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: "Total Leads", value: stats?.total?.toLocaleString() || "0", icon: Users, accent: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-500" },
    { label: "Con Gestión", value: stats?.conGestion?.toLocaleString() || "0", icon: MessageSquare, accent: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-500" },
    { label: "Tasa Conversión", value: `${stats?.tasaConversion || 0}%`, icon: TrendingUp, accent: "from-violet-500/20 to-violet-600/5", iconColor: "text-violet-500" },
    { label: "Tasa Negocio", value: `${stats?.tasaNegocio || 0}%`, icon: BarChart3, accent: "from-amber-500/20 to-amber-600/5", iconColor: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Resumen ejecutivo de la operación</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </Button>
      </div>

      {/* Filters bar */}
      {showFilters && stats && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-3 p-4 rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Input type="date" value={filters.desde || ""} onChange={(e) => setFilters({ ...filters, desde: e.target.value || undefined })} className="h-9 w-[150px] text-xs" placeholder="Desde" />
            <span className="text-xs text-muted-foreground">—</span>
            <Input type="date" value={filters.hasta || ""} onChange={(e) => setFilters({ ...filters, hasta: e.target.value || undefined })} className="h-9 w-[150px] text-xs" placeholder="Hasta" />
          </div>
          <Select value={filters.cliente || "all"} onValueChange={(v) => setFilters({ ...filters, cliente: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {stats.filterOptions.clientes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.campana || "all"} onValueChange={(v) => setFilters({ ...filters, campana: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Campaña" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las campañas</SelectItem>
              {stats.filterOptions.campanas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.ciudad || "all"} onValueChange={(v) => setFilters({ ...filters, ciudad: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Ciudad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ciudades</SelectItem>
              {stats.filterOptions.ciudades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filters.cliente || filters.campana || filters.ciudad || filters.desde || filters.hasta) && (
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={() => setFilters({})}>Limpiar</Button>
          )}
        </motion.div>
      )}

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`relative overflow-hidden p-5 rounded-xl border border-border bg-card hover:shadow-lg transition-all group`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/50">
                  <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                </div>
                {stats && stats.total > 0 && (
                  <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                    <ArrowUpRight className="h-3 w-3" />
                  </div>
                )}
              </div>
              <p className="text-3xl font-display font-bold tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      {stats && stats.total > 0 && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <LeadsBarChart data={stats.porCampanaMkt} title="Leads por Campaña MKT" />
            <LeadsPieChart data={stats.porCiudad} title="Distribución por Ciudad" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <LeadsBarChart data={stats.porCliente} title="Leads por Cliente" />
            <LeadsPieChart data={stats.porResultPrimGestion} title="Resultado Primera Gestión" />
          </div>
        </>
      )}

      {!stats || stats.total === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No hay datos de leads disponibles aún</p>
        </div>
      ) : null}

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-5 border-b border-border">
          <h2 className="font-display font-semibold">Actividad Reciente</h2>
        </div>
        <div className="divide-y divide-border">
          {activity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No hay actividad reciente registrada
            </div>
          ) : (
            activity.map((item: any, i: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.module || "Sistema"}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("es")}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

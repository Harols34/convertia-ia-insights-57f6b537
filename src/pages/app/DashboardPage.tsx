import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, MessageSquare, BarChart3, ArrowUpRight, Loader2, MapPin, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LeadsBarChart, LeadsPieChart } from "@/components/app/LeadsChart";

interface LeadStats {
  total: number;
  conGestion: number;
  conNegocio: number;
  tasaGestion: string;
  tasaNegocio: string;
  porCliente: { name: string; value: number }[];
  porCampanaMkt: { name: string; value: number }[];
  porCiudad: { name: string; value: number }[];
  porResultNegocio: { name: string; value: number }[];
  porResultPrimGestion: { name: string; value: number }[];
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      // Fetch leads directly from Supabase (RLS handles tenant filtering)
      const { data: leads } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (leads && leads.length > 0) {
        const total = leads.length;
        const conGestion = leads.filter((l) => l.result_prim_gestion && l.result_prim_gestion !== "").length;
        const conNegocio = leads.filter((l) => l.result_negocio && l.result_negocio !== "").length;

        setStats({
          total,
          conGestion,
          conNegocio,
          tasaGestion: total > 0 ? ((conGestion / total) * 100).toFixed(1) : "0",
          tasaNegocio: total > 0 ? ((conNegocio / total) * 100).toFixed(1) : "0",
          porCliente: countBy(leads, "cliente"),
          porCampanaMkt: countBy(leads, "campana_mkt"),
          porCiudad: countBy(leads, "ciudad"),
          porResultNegocio: countBy(leads, "result_negocio"),
          porResultPrimGestion: countBy(leads, "result_prim_gestion"),
        });
      }

      // Fetch recent audit logs
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      setActivity(logs || []);

      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: "Total Leads", value: stats?.total?.toLocaleString() || "0", icon: Users, color: "text-blue-500" },
    { label: "Con Gestión", value: stats?.conGestion?.toLocaleString() || "0", icon: MessageSquare, color: "text-emerald-500" },
    { label: "Tasa Gestión", value: `${stats?.tasaGestion || 0}%`, icon: BarChart3, color: "text-amber-500" },
    { label: "Tasa Negocio", value: `${stats?.tasaNegocio || 0}%`, icon: TrendingUp, color: "text-violet-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard Ejecutivo</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen general de la operación basado en datos de leads</p>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              {stats && stats.total > 0 && (
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              )}
            </div>
            <p className="text-2xl font-mono font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
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
          <p className="text-xs text-muted-foreground mt-1">Los datos se cargarán automáticamente cuando se ingesten desde n8n</p>
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

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, MessageSquare, BarChart3, ArrowUpRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LeadsBarChart } from "@/components/app/LeadsChart";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Fetch analytics
      const res = await window.fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.error) setStats(data);

      // Fetch recent audit logs
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      setActivity(logs || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = stats
    ? [
        { label: "Total Leads", value: stats.total?.toLocaleString() || "0", icon: Users },
        { label: "Con Gestión", value: stats.conGestion?.toLocaleString() || "0", icon: MessageSquare },
        { label: "Tasa Gestión", value: `${stats.tasaGestion || 0}%`, icon: BarChart3 },
        { label: "Tasa Negocio", value: `${stats.tasaNegocio || 0}%`, icon: TrendingUp },
      ]
    : [
        { label: "Total Leads", value: "0", icon: Users },
        { label: "Con Gestión", value: "0", icon: MessageSquare },
        { label: "Tasa Gestión", value: "0%", icon: BarChart3 },
        { label: "Tasa Negocio", value: "0%", icon: TrendingUp },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard Ejecutivo</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen general de la operación</p>
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
                <kpi.icon className="h-4 w-4 text-primary" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-2xl font-mono font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      {stats && (
        <div className="grid md:grid-cols-2 gap-4">
          <LeadsBarChart data={stats.porCliente || []} title="Leads por Cliente" />
          <LeadsBarChart data={stats.porBpo || []} title="Leads por BPO" />
        </div>
      )}

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

import { motion } from "framer-motion";
import { TrendingUp, Users, MessageSquare, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

const kpis = [
  { label: "Conversiones Totales", value: "12,847", change: "+14.2%", up: true, icon: TrendingUp },
  { label: "Usuarios Activos", value: "3,291", change: "+8.7%", up: true, icon: Users },
  { label: "Conversaciones IA", value: "48,523", change: "+22.1%", up: true, icon: MessageSquare },
  { label: "Tasa de Resolución", value: "94.6%", change: "-1.3%", up: false, icon: BarChart3 },
];

const recentActivity = [
  { action: "Dashboard generado", detail: "Reporte Q1 - Ventas por canal", time: "Hace 5 min", user: "María G." },
  { action: "Exportación completada", detail: "KPIs Ejecutivos - PDF", time: "Hace 12 min", user: "Carlos R." },
  { action: "Bot actualizado", detail: "Asistente WhatsApp - Producción", time: "Hace 25 min", user: "Ana L." },
  { action: "Integración sincronizada", detail: "Google Sheets - CRM Principal", time: "Hace 1h", user: "Pedro M." },
  { action: "Nuevo usuario creado", detail: "operador@empresa.com", time: "Hace 2h", user: "Admin" },
];

export default function DashboardPage() {
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
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${kpi.up ? "text-success" : "text-destructive"}`}>
                {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {kpi.change}
              </span>
            </div>
            <p className="text-2xl font-mono font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-5 border-b border-border">
          <h2 className="font-display font-semibold">Actividad Reciente</h2>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.action}</p>
                <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xs text-muted-foreground">{item.time}</p>
                <p className="text-xs text-primary">{item.user}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

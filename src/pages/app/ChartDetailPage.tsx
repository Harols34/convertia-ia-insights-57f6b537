import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DynamicChart } from "@/components/app/DynamicChart";
import { KpiGrid } from "@/components/dashdinamics/KpiGrid";
import { InsightList } from "@/components/dashdinamics/InsightList";
import type { DashboardData } from "@/types/dashdinamics";

export default function ChartDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as any;
  const chartConfig = state?.chartConfig as Record<string, unknown> | undefined;
  const title = state?.title as string | undefined;
  const dashboard = state?.dashboard as DashboardData | undefined;

  if (!chartConfig && !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
        <p className="mb-4">No se encontró configuración de gráfico.</p>
        <Button variant="outline" onClick={() => navigate("/app/dashdinamics")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al chat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/dashdinamics")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver al chat
        </Button>
      </div>

      {/* Dashboard header */}
      {dashboard && (
        <div className="space-y-1">
          <h1 className="text-2xl font-display font-bold">{dashboard.title}</h1>
          {dashboard.subtitle && <p className="text-sm text-muted-foreground">{dashboard.subtitle}</p>}
          {dashboard.time_range && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {dashboard.time_range}
            </span>
          )}
        </div>
      )}

      {/* KPIs */}
      {dashboard?.kpis && dashboard.kpis.length > 0 && <KpiGrid kpis={dashboard.kpis} />}

      {/* Main chart expanded */}
      {chartConfig && (
        <div className="border border-border rounded-xl bg-card p-6">
          {title && <h2 className="text-lg font-display font-semibold mb-4">{title}</h2>}
          <DynamicChart config={chartConfig} allowExpand={false} height={500} showTypeSwitch />
        </div>
      )}

      {/* All charts if full dashboard */}
      {dashboard?.charts && !chartConfig && dashboard.charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboard.charts.map((chart) => (
            <div key={chart.id} className="border border-border rounded-xl bg-card p-4">
              <h3 className="text-sm font-display font-semibold mb-2">{chart.title}</h3>
              <DynamicChart config={chart.config} allowExpand={false} height={350} showTypeSwitch />
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {dashboard?.insights && dashboard.insights.length > 0 && (
        <div className="border border-border rounded-xl bg-card p-4">
          <InsightList insights={dashboard.insights} />
        </div>
      )}

      {/* Next steps */}
      {dashboard?.recommended_next_steps && dashboard.recommended_next_steps.length > 0 && (
        <div className="border border-border rounded-xl bg-card p-4 space-y-2">
          <h3 className="text-sm font-display font-semibold">Próximos pasos recomendados</h3>
          <ul className="space-y-1.5">
            {dashboard.recommended_next_steps.map((step, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">→</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

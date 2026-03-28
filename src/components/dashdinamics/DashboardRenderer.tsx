import { DashboardData } from "@/types/dashdinamics";
import { KpiGrid } from "./KpiGrid";
import { InsightList } from "./InsightList";
import { DynamicChart } from "@/components/app/DynamicChart";
import { ArrowRight, Expand, Target, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DashboardRendererProps {
  message: string;
  dashboard: DashboardData;
  decisionGoal?: string | null;
  onRefine?: (prompt: string) => void;
  /** Solo en el último mensaje del asistente: vuelve a llamar al modelo con la misma pregunta */
  onRegenerateDashboard?: () => void;
  isRegenerating?: boolean;
}

export function DashboardRenderer({
  message,
  dashboard,
  decisionGoal,
  onRefine,
  onRegenerateDashboard,
  isRegenerating,
}: DashboardRendererProps) {
  const navigate = useNavigate();
  const nextSteps = Array.isArray(dashboard.recommended_next_steps)
    ? dashboard.recommended_next_steps.map(String)
    : typeof dashboard.recommended_next_steps === "string" && dashboard.recommended_next_steps.trim()
      ? [dashboard.recommended_next_steps.trim()]
      : dashboard.recommended_next_steps && typeof dashboard.recommended_next_steps === "object"
        ? Object.values(dashboard.recommended_next_steps as Record<string, unknown>).map(String)
        : [];
  const kpis = Array.isArray(dashboard.kpis) ? dashboard.kpis : [];
  const charts = Array.isArray(dashboard.charts) ? dashboard.charts : [];
  const tables = Array.isArray(dashboard.tables) ? dashboard.tables : [];
  const insights = Array.isArray(dashboard.insights) ? dashboard.insights : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0 flex-1">
          <h3 className="text-lg font-display font-bold tracking-tight">{dashboard.title ?? "Dashboard"}</h3>
          {dashboard.subtitle && <p className="text-xs text-muted-foreground">{dashboard.subtitle}</p>}
          {dashboard.time_range && (
            <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
              {dashboard.time_range}
            </span>
          )}
        </div>
        {onRegenerateDashboard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={onRegenerateDashboard}
            disabled={isRegenerating}
            title="Reintenta la generación si algún gráfico quedó vacío"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
            Regenerar
          </Button>
        )}
      </div>

      {/* Brief message */}
      {message && <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>}

      {/* Decision goal */}
      {decisionGoal && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <Target className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="font-medium">Objetivo: {decisionGoal}</span>
        </div>
      )}

      {/* KPIs */}
      {kpis.length > 0 && <KpiGrid kpis={kpis} />}

      {/* Charts */}
      {charts.length > 0 && (
        <div className={`grid gap-4 ${charts.length > 1 ? "md:grid-cols-2" : ""}`}>
          {charts.map((chart, chartIndex) => (
            <div key={chart.id ? `${chart.id}-${chartIndex}` : `chart-${chartIndex}`} className="relative">
              <div className="flex items-center justify-between mb-2 px-1">
                <h4 className="text-xs font-display font-semibold text-muted-foreground">{chart.title}</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigate("/app/dashdinamics/detail", { 
                    state: { chartConfig: chart.config, title: chart.title, dashboard } 
                  })}
                >
                  <Expand className="h-3.5 w-3.5" />
                </Button>
              </div>
              {chart.rationale && (
                <p className="text-[10px] text-muted-foreground mb-1 px-1 leading-snug">{chart.rationale}</p>
              )}
              <DynamicChart config={chart.config} allowExpand={false} showTypeSwitch />
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      {tables.length > 0 && (
        <div className="space-y-3">
          {tables.map((table, i) => {
            const headers = Array.isArray(table.headers) ? table.headers : [];
            const rows = Array.isArray(table.rows) ? table.rows : [];
            const tableKey = table.title ? `${table.title}-${i}` : `table-${i}`;
            return (
            <div key={tableKey} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50">
                <h4 className="text-xs font-display font-semibold">{table.title ?? "Tabla"}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {headers.map((h, j) => (
                        <th key={j} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{String(h ?? "")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(headers.length, 1)} className="px-4 py-3 text-muted-foreground">
                          Sin filas
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, j) => {
                        const cells = Array.isArray(row) ? row : [];
                        return (
                      <tr key={j} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        {cells.map((cell, k) => (
                          <td key={k} className="px-4 py-2.5">{cell != null ? String(cell) : "—"}</td>
                        ))}
                      </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && <InsightList insights={insights} />}

      {/* Next steps */}
      {nextSteps.length > 0 && (
        <div className="space-y-2.5">
          <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Próximos pasos</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {nextSteps.map((step, i) => (
              <button
                key={i}
                onClick={() => onRefine?.(step)}
                className="flex items-center gap-2.5 w-full text-left text-xs text-muted-foreground hover:text-primary transition-all group p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5"
              >
                <ArrowRight className="h-3.5 w-3.5 text-primary opacity-60 group-hover:opacity-100 flex-shrink-0" />
                <span className="leading-relaxed">{step}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

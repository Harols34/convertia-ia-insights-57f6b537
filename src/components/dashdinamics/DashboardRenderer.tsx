import { DashboardData } from "@/types/dashdinamics";
import { KpiGrid } from "./KpiGrid";
import { InsightList } from "./InsightList";
import { DynamicChart } from "@/components/app/DynamicChart";
import { ArrowRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DashboardRendererProps {
  message: string;
  dashboard: DashboardData;
  decisionGoal?: string | null;
  onRefine?: (prompt: string) => void;
}

export function DashboardRenderer({ message, dashboard, decisionGoal, onRefine }: DashboardRendererProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-display font-bold">{dashboard.title}</h3>
        {dashboard.subtitle && <p className="text-xs text-muted-foreground">{dashboard.subtitle}</p>}
        {dashboard.time_range && (
          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {dashboard.time_range}
          </span>
        )}
      </div>

      {/* Brief message */}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {/* KPIs */}
      {dashboard.kpis && dashboard.kpis.length > 0 && <KpiGrid kpis={dashboard.kpis} />}

      {/* Charts */}
      {dashboard.charts && dashboard.charts.length > 0 && (
        <div className={`grid gap-3 ${dashboard.charts.length > 1 ? "md:grid-cols-2" : ""}`}>
          {dashboard.charts.map((chart) => (
            <div key={chart.id} className="relative">
              <div className="flex items-center justify-between mb-1 px-1">
                <h4 className="text-xs font-display font-semibold text-muted-foreground">{chart.title}</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigate("/app/dashdinamics/detail", { 
                    state: { chartConfig: chart.config, title: chart.title, dashboard } 
                  })}
                >
                  <Expand className="h-3 w-3" />
                </Button>
              </div>
              <DynamicChart config={chart.config} allowExpand={false} />
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      {dashboard.tables && dashboard.tables.length > 0 && (
        <div className="space-y-3">
          {dashboard.tables.map((table, i) => (
            <div key={i} className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50">
                <h4 className="text-xs font-display font-semibold">{table.title}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {table.headers.map((h, j) => (
                        <th key={j} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, j) => (
                      <tr key={j} className="border-b border-border/50 last:border-0">
                        {row.map((cell, k) => (
                          <td key={k} className="px-3 py-2">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {dashboard.insights && dashboard.insights.length > 0 && <InsightList insights={dashboard.insights} />}

      {/* Next steps */}
      {dashboard.recommended_next_steps && dashboard.recommended_next_steps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Próximos pasos</h4>
          <div className="space-y-1.5">
            {dashboard.recommended_next_steps.map((step, i) => (
              <button
                key={i}
                onClick={() => onRefine?.(step)}
                className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground hover:text-primary transition-colors group p-2 rounded-lg hover:bg-primary/5"
              >
                <ArrowRight className="h-3 w-3 text-primary opacity-60 group-hover:opacity-100" />
                <span>{step}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Decision goal */}
      {decisionGoal && (
        <div className="text-[10px] text-muted-foreground/60 pt-2 border-t border-border/50 italic">
          🎯 Objetivo de decisión: {decisionGoal}
        </div>
      )}
    </div>
  );
}

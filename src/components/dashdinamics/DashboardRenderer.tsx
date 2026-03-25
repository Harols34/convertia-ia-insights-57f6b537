import { DashboardData } from "@/types/dashdinamics";
import { KpiGrid } from "./KpiGrid";
import { InsightList } from "./InsightList";
import { DynamicChart } from "@/components/app/DynamicChart";
import { ArrowRight, Expand, Target } from "lucide-react";
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
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1.5">
        <h3 className="text-lg font-display font-bold tracking-tight">{dashboard.title}</h3>
        {dashboard.subtitle && <p className="text-xs text-muted-foreground">{dashboard.subtitle}</p>}
        {dashboard.time_range && (
          <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
            {dashboard.time_range}
          </span>
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
      {dashboard.kpis && dashboard.kpis.length > 0 && <KpiGrid kpis={dashboard.kpis} />}

      {/* Charts */}
      {dashboard.charts && dashboard.charts.length > 0 && (
        <div className={`grid gap-4 ${dashboard.charts.length > 1 ? "md:grid-cols-2" : ""}`}>
          {dashboard.charts.map((chart) => (
            <div key={chart.id} className="relative">
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
              <DynamicChart config={chart.config} allowExpand={false} />
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      {dashboard.tables && dashboard.tables.length > 0 && (
        <div className="space-y-3">
          {dashboard.tables.map((table, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50">
                <h4 className="text-xs font-display font-semibold">{table.title}</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {table.headers.map((h, j) => (
                        <th key={j} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, j) => (
                      <tr key={j} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-2.5">{cell}</td>
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
        <div className="space-y-2.5">
          <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Próximos pasos</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {dashboard.recommended_next_steps.map((step, i) => (
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

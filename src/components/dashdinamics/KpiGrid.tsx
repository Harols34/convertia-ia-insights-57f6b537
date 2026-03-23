import { DashKpi } from "@/types/dashdinamics";
import { TrendingUp, TrendingDown, Minus, Users, Target, DollarSign, BarChart3, Activity } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  TrendingUp, Users, Target, DollarSign, BarChart: BarChart3, Activity,
};

export function KpiGrid({ kpis }: { kpis: DashKpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => {
        const Icon = iconMap[kpi.icon || "BarChart"] || BarChart3;
        const TrendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;
        const trendColor = kpi.trend === "up" ? "text-emerald-400" : kpi.trend === "down" ? "text-red-400" : "text-muted-foreground";

        return (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground font-medium truncate">{kpi.label}</span>
            </div>
            <p className="text-2xl font-display font-bold tracking-tight">{kpi.value}</p>
            {kpi.change && (
              <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                <span>{kpi.change}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

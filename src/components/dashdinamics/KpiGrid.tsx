import { DashKpi } from "@/types/dashdinamics";
import { TrendingUp, TrendingDown, Minus, Users, Target, DollarSign, BarChart3, Activity } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  TrendingUp, Users, Target, DollarSign, BarChart: BarChart3, Activity,
};

export function KpiGrid({ kpis }: { kpis: DashKpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, i) => {
        const Icon = iconMap[kpi.icon || "BarChart"] || BarChart3;
        const TrendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;
        const trendColor = kpi.trend === "up" ? "text-emerald-500" : kpi.trend === "down" ? "text-red-500" : "text-muted-foreground";
        const trendBg = kpi.trend === "up" ? "bg-emerald-500/10" : kpi.trend === "down" ? "bg-red-500/10" : "bg-muted/50";

        return (
          <div key={i} className="relative overflow-hidden rounded-xl border border-border bg-card p-4 space-y-2 group hover:shadow-md transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                {kpi.change && (
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trendBg} ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" />
                    <span>{kpi.change}</span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-display font-bold tracking-tight mt-3">{kpi.value}</p>
              <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

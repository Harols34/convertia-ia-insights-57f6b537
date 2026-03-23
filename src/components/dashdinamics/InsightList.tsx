import { DashInsight } from "@/types/dashdinamics";
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from "lucide-react";

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  alert: AlertCircle,
};

const colorMap = {
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  info: "border-blue-500/30 bg-blue-500/5 text-blue-400",
  alert: "border-red-500/30 bg-red-500/5 text-red-400",
};

export function InsightList({ insights }: { insights: DashInsight[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Insights</h4>
      <div className="grid gap-2 md:grid-cols-2">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type] || Info;
          return (
            <div key={i} className={`flex gap-3 p-3 rounded-lg border ${colorMap[insight.type] || colorMap.info}`}>
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

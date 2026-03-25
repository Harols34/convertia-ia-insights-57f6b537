import { DashInsight } from "@/types/dashdinamics";
import { CheckCircle2, AlertTriangle, Info, AlertCircle } from "lucide-react";

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  alert: AlertCircle,
};

const colorMap = {
  success: "border-emerald-500/30 bg-emerald-500/10",
  warning: "border-amber-500/30 bg-amber-500/10",
  info: "border-blue-500/30 bg-blue-500/10",
  alert: "border-red-500/30 bg-red-500/10",
};

const iconColorMap = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  alert: "text-red-500",
};

export function InsightList({ insights }: { insights: DashInsight[] }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <Info className="h-3.5 w-3.5" /> Insights
      </h4>
      <div className="grid gap-2 md:grid-cols-2">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type] || Info;
          return (
            <div key={i} className={`flex gap-3 p-4 rounded-xl border ${colorMap[insight.type] || colorMap.info} transition-all hover:shadow-sm`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[insight.type]}`}>
                <Icon className={`h-4 w-4 ${iconColorMap[insight.type] || iconColorMap.info}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

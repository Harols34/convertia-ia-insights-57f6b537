import { Recommendation } from "@/types/dashdinamics";
import { BarChart3, TrendingUp, Target, Users, Activity, Sparkles, ArrowRight } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  BarChart: BarChart3, TrendingUp, Target, Users, Activity,
};

interface RecommendationCardProps {
  message: string;
  recommendations: Recommendation[];
  onSelect: (label: string) => void;
}

export function RecommendationCard({ message, recommendations, onSelect }: RecommendationCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4.5 w-4.5 text-primary" />
        </div>
        <p className="text-sm text-foreground pt-1.5 leading-relaxed">{message}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 pl-12">
        {recommendations.map((rec) => {
          const Icon = iconMap[rec.icon || "BarChart"] || BarChart3;
          return (
            <div
              key={rec.id}
              className="group rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer hover:shadow-md"
              onClick={() => onSelect(rec.title)}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <h4 className="text-sm font-display font-semibold">{rec.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{rec.description}</p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium group-hover:gap-2.5 transition-all">
                {rec.action_label || "Generar dashboard"} <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

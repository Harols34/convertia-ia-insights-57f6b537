import { Recommendation } from "@/types/dashdinamics";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Target, Users, Activity, Sparkles } from "lucide-react";

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
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm text-foreground pt-1">{message}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 pl-11">
        {recommendations.map((rec) => {
          const Icon = iconMap[rec.icon || "BarChart"] || BarChart3;
          return (
            <div key={rec.id} className="group rounded-xl border border-border bg-card/50 p-4 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer" onClick={() => onSelect(rec.title)}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <h4 className="text-sm font-display font-semibold">{rec.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{rec.description}</p>
              <Button variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">
                {rec.action_label || "Generar dashboard"} →
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

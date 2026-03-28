import { StructuredResponse } from "@/types/dashdinamics";
import { DashboardRenderer } from "./DashboardRenderer";
import { RecommendationCard } from "./RecommendationCard";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponseRendererProps {
  data: StructuredResponse;
  onSendMessage: (text: string) => void;
  onRegenerateDashboard?: () => void;
  isRegenerating?: boolean;
}

export function ResponseRenderer({
  data,
  onSendMessage,
  onRegenerateDashboard,
  isRegenerating,
}: ResponseRendererProps) {
  if (data.response_mode === "recommendation" && data.recommendations?.length) {
    return (
      <RecommendationCard
        message={data.assistant_message}
        recommendations={data.recommendations}
        onSelect={(title) => onSendMessage(`Genera un dashboard de: ${title}`)}
      />
    );
  }

  if (data.response_mode === "dashboard" && data.dashboard) {
    return (
      <DashboardRenderer
        message={data.assistant_message}
        dashboard={data.dashboard}
        decisionGoal={data.decision_goal}
        onRefine={(prompt) => onSendMessage(prompt)}
        onRegenerateDashboard={onRegenerateDashboard}
        isRegenerating={isRegenerating}
      />
    );
  }

  if (data.response_mode === "dashboard" && !data.dashboard) {
    return (
      <div className="space-y-3">
        {onRegenerateDashboard && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onRegenerateDashboard}
            disabled={isRegenerating}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
            Regenerar dashboard
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{data.assistant_message || "Sin datos de dashboard."}</p>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">{data.assistant_message || "Sin respuesta estructurada"}</p>;
}

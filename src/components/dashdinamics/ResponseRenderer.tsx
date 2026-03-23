import { StructuredResponse } from "@/types/dashdinamics";
import { DashboardRenderer } from "./DashboardRenderer";
import { ClarificationCard } from "./ClarificationCard";
import { RecommendationCard } from "./RecommendationCard";

interface ResponseRendererProps {
  data: StructuredResponse;
  onSendMessage: (text: string) => void;
}

export function ResponseRenderer({ data, onSendMessage }: ResponseRendererProps) {
  if (data.response_mode === "clarification" && data.clarifying_questions?.length) {
    return (
      <ClarificationCard
        message={data.assistant_message}
        questions={data.clarifying_questions}
        onAnswer={(answer) => onSendMessage(answer)}
      />
    );
  }

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
      />
    );
  }

  // Fallback
  return <p className="text-sm text-muted-foreground">{data.assistant_message || "Sin respuesta estructurada"}</p>;
}

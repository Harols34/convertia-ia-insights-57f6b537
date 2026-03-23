export interface DashKpi {
  label: string;
  value: string | number;
  change?: string | null;
  trend?: "up" | "down" | "neutral";
  icon?: string;
}

export interface DashChart {
  id: string;
  title: string;
  type: string;
  config: Record<string, unknown>;
}

export interface DashInsight {
  type: "success" | "warning" | "info" | "alert";
  title: string;
  description: string;
}

export interface DashTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface DashboardData {
  title: string;
  subtitle?: string;
  time_range?: string;
  kpis?: DashKpi[];
  charts?: DashChart[];
  insights?: DashInsight[];
  recommended_next_steps?: string[];
  tables?: DashTable[];
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: "single_select" | "multi_select" | "text" | "date_range";
  options?: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  icon?: string;
  action_label?: string;
}

export interface StructuredResponse {
  response_mode: "dashboard" | "clarification" | "recommendation";
  assistant_message: string;
  decision_goal?: string | null;
  dashboard?: DashboardData | null;
  clarifying_questions?: ClarifyingQuestion[];
  recommendations?: Recommendation[];
}

export interface DashMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured?: StructuredResponse | null;
  ts: number;
}

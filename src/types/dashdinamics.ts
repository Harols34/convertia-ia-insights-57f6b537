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
  /** Por qué se eligió este tipo de visualización (opcional, para el usuario) */
  rationale?: string;
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

/** KPIs u otros datos verificados (rellenados por el backend en modo aclaración) */
export interface FactCard {
  id: string;
  label: string;
  value: string | number;
  sublabel?: string;
}

/** Estilo de tablero sugerido; el usuario elige uno antes de generar */
export interface DashboardPreset {
  id: string;
  title: string;
  description: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: "single_select" | "multi_select" | "text" | "date_range";
  options?: string[];
  /** Si true, debe contestarse antes de enviar */
  required?: boolean;
  placeholder?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  icon?: string;
  action_label?: string;
}

export interface StructuredResponse {
  response_mode: "dashboard" | "clarification" | "recommendation" | "chart_picker";
  assistant_message: string;
  decision_goal?: string | null;
  dashboard?: DashboardData | null;
  clarifying_questions?: ClarifyingQuestion[];
  recommendations?: Recommendation[];
  /** Datos reales (p. ej. últimos 7 días) mostrados durante la aclaración */
  fact_cards?: FactCard[];
  dashboard_presets?: DashboardPreset[];
  chart_options?: { id: string; name: string; description?: string }[];
}

export interface DashMessage {
  id: string;
  role: "user" | "assistant";
  /** Texto visible en el chat */
  content: string;
  /** Si existe, se envía a la API en lugar de `content` (instrucciones internas no mostradas) */
  contentForModel?: string;
  structured?: StructuredResponse | null;
  ts: number;
}

/** Contenido efectivo para el modelo */
export function dashMessageToApiContent(m: Pick<DashMessage, "content" | "contentForModel">): string {
  return m.contentForModel ?? m.content;
}

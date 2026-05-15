import type { DateGranularity, PivotMeasureSpec } from "@/lib/pivot-engine";

/** Barra del widget en el tablero (título y visibilidad). */
export interface WidgetChrome {
  /** Título mostrado en el tablero (si falta, se usa el nombre de la vista / BD). */
  title?: string;
  /** false = oculta la barra de título; queda una franja mínima para arrastrar. */
  showHeader?: boolean;
}

/** Personalización visual persistida (gráficos ECharts y tarjetas). */
export interface WidgetAppearance {
  /** Color principal (hex), p. ej. #2563eb */
  primaryColor?: string;
  secondaryColor?: string;
  /** Paleta para series (hex), en orden */
  accentPalette?: string[];
  backgroundColor?: string;
  /** Radio del contenedor del widget en px */
  borderRadiusPx?: number;
  showLegend?: boolean;
  showGridLines?: boolean;
}

/** Control de filtro en el tablero (slicer) — afecta a todos los widgets de la misma tabla. */
export interface BoardFilterWidgetConfig {
  version: 1;
  kind: "board_filter";
  tableName: string;
  displayName: string;
  field: string;
  /** Si el campo es fecha: bucket para chips y cortes (por defecto `month` en UI). */
  fieldDateGranularity?: DateGranularity;
  hiddenDataColumns?: string[];
  chrome?: WidgetChrome;
}

export function isBoardFilterWidgetConfig(c: unknown): c is BoardFilterWidgetConfig {
  return typeof c === "object" && c !== null && (c as BoardFilterWidgetConfig).kind === "board_filter";
}

export type PivotVizType =
  | "table"
  | "pivot_table"
  | "bar"
  | "bar_horizontal"
  | "bar_stacked"
  | "bar_100_stacked"
  | "column_stacked"
  | "column_100_stacked"
  | "line"
  | "area"
  | "area_stacked"
  | "pie"
  | "donut"
  | "treemap"
  | "sunburst"
  | "funnel"
  | "gauge"
  | "card"
  | "card_trend"
  | "card_ring"
  | "heatmap"
  | "scatter"
  | "bubble"
  | "radar"
  | "mixed_line_bar"
  | "waterfall"
  | "ranking_horizontal"
  | "ranking_vertical";

/** Configuración serializable de un widget pivot (se guarda en analytics_board_widgets.config) */
export interface PivotWidgetPersistedConfig {
  version: 1;
  tableName: string;
  displayName: string;
  filterFields: string[];
  rowFields: string[];
  colFields: string[];
  filterSelections: Record<string, string[]>;
  measures: PivotMeasureSpec[];
  viz: PivotVizType;
  chartMeasureId: string;
  dateFields?: string[];
  fieldDateGranularity?: Record<string, DateGranularity>;
  /** Columnas a quitar del payload al recargar el widget */
  hiddenDataColumns?: string[];
  appearance?: WidgetAppearance;
  chrome?: WidgetChrome;
}

export interface BoardWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export const PIVOT_VIZ_OPTIONS: { id: PivotVizType; label: string; group: string; icon?: string }[] = [
  // Indicadores
  { id: "card", label: "Tarjeta KPI", group: "Indicadores" },
  { id: "card_trend", label: "KPI con Tendencia", group: "Indicadores" },
  { id: "card_ring", label: "Progreso Circular", group: "Indicadores" },
  { id: "gauge", label: "Medidor / Velocímetro", group: "Indicadores" },

  // Comparación
  { id: "bar", label: "Barras Verticales", group: "Comparación" },
  { id: "bar_horizontal", label: "Barras Horizontales", group: "Comparación" },
  { id: "bar_stacked", label: "Barras Apiladas", group: "Comparación" },
  { id: "bar_100_stacked", label: "Barras 100% Apiladas", group: "Comparación" },
  { id: "ranking_vertical", label: "Ranking Vertical", group: "Comparación" },
  { id: "ranking_horizontal", label: "Ranking Horizontal", group: "Comparación" },

  // Tiempo
  { id: "line", label: "Líneas de Evolución", group: "Tiempo" },
  { id: "area", label: "Áreas de Tendencia", group: "Tiempo" },
  { id: "area_stacked", label: "Áreas Apiladas", group: "Tiempo" },
  { id: "mixed_line_bar", label: "Barras + Línea", group: "Tiempo" },

  // Composición
  { id: "pie", label: "Gráfico de Tarta", group: "Composición" },
  { id: "donut", label: "Gráfico de Anillo", group: "Composición" },
  { id: "treemap", label: "TreeMap (Jerárquico)", group: "Composición" },
  { id: "sunburst", label: "Sunburst", group: "Composición" },
  { id: "funnel", label: "Embudo de Conversión", group: "Composición" },
  { id: "waterfall", label: "Cascada (Waterfall)", group: "Composición" },

  // Distribución y Avanzado
  { id: "heatmap", label: "Mapa de Calor", group: "Avanzado" },
  { id: "scatter", label: "Dispersión (Scatter)", group: "Avanzado" },
  { id: "bubble", label: "Burbujas", group: "Avanzado" },
  { id: "radar", label: "Radar / Araña", group: "Avanzado" },

  // Tablas
  { id: "table", label: "Tabla de Detalle", group: "Tablas" },
  { id: "pivot_table", label: "Tabla Dinámica", group: "Tablas" },
];

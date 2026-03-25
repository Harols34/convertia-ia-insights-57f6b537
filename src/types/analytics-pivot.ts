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
  | "bar"
  | "bar_horizontal"
  | "bar_stacked"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "radar"
  | "funnel"
  | "gauge"
  | "card"
  | "card_ring"
  | "heatmap"
  | "mixed_line_bar";

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

export const PIVOT_VIZ_OPTIONS: { id: PivotVizType; label: string; group: string }[] = [
  { id: "table", label: "Tabla", group: "Tablas" },
  { id: "card", label: "Tarjeta KPI (número)", group: "Indicadores" },
  { id: "card_ring", label: "Tarjeta circular (progreso)", group: "Indicadores" },
  { id: "gauge", label: "Medidor", group: "Indicadores" },
  { id: "bar", label: "Barras verticales", group: "Barras y líneas" },
  { id: "bar_horizontal", label: "Barras horizontales", group: "Barras y líneas" },
  { id: "bar_stacked", label: "Barras apiladas", group: "Barras y líneas" },
  { id: "mixed_line_bar", label: "Barras + línea", group: "Barras y líneas" },
  { id: "line", label: "Líneas", group: "Barras y líneas" },
  { id: "area", label: "Área", group: "Barras y líneas" },
  { id: "pie", label: "Pastel", group: "Proporción" },
  { id: "donut", label: "Anillo", group: "Proporción" },
  { id: "funnel", label: "Embudo", group: "Proporción" },
  { id: "scatter", label: "Dispersión", group: "Avanzado" },
  { id: "radar", label: "Radar", group: "Avanzado" },
  { id: "heatmap", label: "Mapa de calor", group: "Avanzado" },
];

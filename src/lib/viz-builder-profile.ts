import type { PivotVizType } from "@/types/analytics-pivot";

export interface VizBuilderProfile {
  /** Zona “Filas” (categorías / eje) */
  showRows: boolean;
  /** Zona “Columnas” (series / desglose) */
  showCols: boolean;
  /** Zona “Valores” (medidas) */
  showValues: boolean;
  /** Filtros del widget (no confundir con slicers del tablero) */
  showFilters: boolean;
  /** Granularidad de fechas en filas/cols/filtros */
  showDateGranularity: boolean;
  /** Selector de medida para el gráfico (cuando aplica) */
  showChartMeasurePicker: boolean;
  descripcion: string;
}

const FULL: VizBuilderProfile = {
  showRows: true,
  showCols: true,
  showValues: true,
  showFilters: true,
  showDateGranularity: true,
  showChartMeasurePicker: true,
  descripcion: "Tabla dinámica: filas, columnas, valores y filtros opcionales.",
};

const KPI: VizBuilderProfile = {
  showRows: false,
  showCols: false,
  showValues: true,
  showFilters: true,
  showDateGranularity: true,
  showChartMeasurePicker: true,
  descripcion: "Un número destacado (total de la medida). Opcional: filtros para acotar datos.",
};

const CATEGORY_VALUE: VizBuilderProfile = {
  showRows: true,
  showCols: false,
  showValues: true,
  showFilters: true,
  showDateGranularity: true,
  showChartMeasurePicker: true,
  descripcion: "Una categoría en filas y una medida. Ideal para pastel, embudo o anillo.",
};

const CARTESIAN: VizBuilderProfile = {
  showRows: true,
  showCols: true,
  showValues: true,
  showFilters: true,
  showDateGranularity: true,
  showChartMeasurePicker: true,
  descripcion: "Categorías en filas; columnas opcionales para varias series. Una medida para el gráfico.",
};

const MATRIX: VizBuilderProfile = {
  showRows: true,
  showCols: true,
  showValues: true,
  showFilters: true,
  showDateGranularity: true,
  showChartMeasurePicker: true,
  descripcion: "Matriz filas × columnas con una medida (mapa de calor, radar).",
};

export function getVizBuilderProfile(viz: PivotVizType): VizBuilderProfile {
  switch (viz) {
    case "table":
      return FULL;
    case "card":
    case "card_ring":
    case "gauge":
      return KPI;
    case "pie":
    case "donut":
    case "funnel":
      return CATEGORY_VALUE;
    case "scatter":
      return CATEGORY_VALUE;
    case "heatmap":
    case "radar":
      return MATRIX;
    case "bar":
    case "bar_horizontal":
    case "bar_stacked":
    case "line":
    case "area":
    case "mixed_line_bar":
      return CARTESIAN;
    default:
      return CARTESIAN;
  }
}

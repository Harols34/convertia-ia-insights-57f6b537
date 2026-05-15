/**
 * Dashboard Presets — Pre-configured dashboards for common analysis scenarios.
 * Each preset generates a set of widgets using server-side aggregation.
 */
import type { DashboardWidgetConfig } from "@/stores/dashboard-store";

type PresetWidget = DashboardWidgetConfig & { layout?: { x: number; y: number; w: number; h: number } };

export interface DashboardPreset {
  key: string;
  name: string;
  description: string;
  icon: string;
  widgets: PresetWidget[];
}

export const DASHBOARD_PRESETS: DashboardPreset[] = [
  {
    key: "ejecutivo",
    name: "📊 Dashboard Ejecutivo",
    description: "Visión general de leads, ventas, conversión y tendencias principales",
    icon: "📊",
    widgets: [
      { vizType: "kpi", title: "Total Leads", groupBy: [], measures: [{ agg: "count", alias: "total" }], display: { icon: "Users", format: "number", primaryColor: "#6366f1" }, layout: { x: 0, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Total Ventas", groupBy: [], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], display: { icon: "DollarSign", format: "number", primaryColor: "#22c55e" }, layout: { x: 3, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Tasa de Conversión", groupBy: [], measures: [{ agg: "count", alias: "total" }, { field: "es_venta", agg: "count_true", alias: "ventas" }], display: { icon: "TrendingUp", format: "percent", primaryColor: "#f59e0b" }, layout: { x: 6, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Leads Gestionados", groupBy: [], measures: [{ field: "agente_prim_gestion", agg: "count_not_null", alias: "gestionados" }], display: { icon: "CheckCircle", format: "number", primaryColor: "#8b5cf6" }, layout: { x: 9, y: 0, w: 3, h: 4 } },
      { vizType: "line", title: "Evolución de Leads por Mes", groupBy: ["fch_creacion"], measures: [{ agg: "count", alias: "leads" }], dateGranularity: { fch_creacion: "month" }, orderDir: "asc", limit: 24, layout: { x: 0, y: 4, w: 8, h: 8 } },
      { vizType: "donut", title: "Ventas vs No Ventas", groupBy: ["es_venta"], measures: [{ agg: "count", alias: "total" }], display: { colorPalette: ["#22c55e", "#ef4444"] }, layout: { x: 8, y: 4, w: 4, h: 8 } },
      { vizType: "bar", title: "Top 10 Campañas por Leads", groupBy: ["campana_mkt"], measures: [{ agg: "count", alias: "leads" }], limit: 10, layout: { x: 0, y: 12, w: 6, h: 8 } },
      { vizType: "ranking", title: "Ranking de Agentes por Ventas", groupBy: ["agente_negocio"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], limit: 10, layout: { x: 6, y: 12, w: 6, h: 8 } },
      { vizType: "funnel", title: "Embudo de Conversión", groupBy: [], measures: [{ agg: "count", alias: "leads" }, { field: "agente_prim_gestion", agg: "count_not_null", alias: "gestionados" }, { field: "result_negocio", agg: "count_not_null", alias: "con_negocio" }, { field: "es_venta", agg: "count_true", alias: "ventas" }], layout: { x: 0, y: 20, w: 6, h: 8 } },
      { vizType: "bar_horizontal", title: "Leads por Ciudad (Top 10)", groupBy: ["ciudad"], measures: [{ agg: "count", alias: "leads" }], limit: 10, layout: { x: 6, y: 20, w: 6, h: 8 } },
    ],
  },
  {
    key: "comercial",
    name: "💼 Dashboard Comercial",
    description: "Rendimiento por agente, ventas y gestiones",
    icon: "💼",
    widgets: [
      { vizType: "kpi", title: "Ventas Totales", groupBy: [], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], display: { icon: "DollarSign", format: "number", primaryColor: "#22c55e" }, layout: { x: 0, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Agentes Activos", groupBy: [], measures: [{ field: "agente_prim_gestion", agg: "count_distinct", alias: "agentes" }], display: { icon: "Users", format: "number", primaryColor: "#6366f1" }, layout: { x: 3, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Promedio Días a 1ª Gestión", groupBy: [], measures: [{ agg: "count", alias: "total" }], display: { icon: "Clock", format: "days", primaryColor: "#f59e0b" }, layout: { x: 6, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Tasa de Conversión", groupBy: [], measures: [{ agg: "count", alias: "total" }, { field: "es_venta", agg: "count_true", alias: "ventas" }], display: { icon: "TrendingUp", format: "percent", primaryColor: "#8b5cf6" }, layout: { x: 9, y: 0, w: 3, h: 4 } },
      { vizType: "bar", title: "Ventas por Agente", groupBy: ["agente_negocio"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], limit: 15, layout: { x: 0, y: 4, w: 6, h: 10 } },
      { vizType: "bar", title: "Leads Gestionados por Agente", groupBy: ["agente_prim_gestion"], measures: [{ agg: "count", alias: "leads" }], limit: 15, layout: { x: 6, y: 4, w: 6, h: 10 } },
      { vizType: "pie", title: "Distribución Resultado Primera Gestión", groupBy: ["result_prim_gestion"], measures: [{ agg: "count", alias: "total" }], limit: 10, layout: { x: 0, y: 14, w: 6, h: 8 } },
      { vizType: "ranking", title: "Ranking Agentes Conversión", groupBy: ["agente_negocio"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }, { agg: "count", alias: "leads" }], limit: 10, layout: { x: 6, y: 14, w: 6, h: 8 } },
      { vizType: "line", title: "Tendencia de Ventas por Mes", groupBy: ["fch_negocio"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], dateGranularity: { fch_negocio: "month" }, orderDir: "asc", limit: 24, layout: { x: 0, y: 22, w: 12, h: 8 } },
    ],
  },
  {
    key: "marketing",
    name: "📢 Dashboard Marketing",
    description: "Campañas, keywords, categorías y rendimiento de marketing",
    icon: "📢",
    widgets: [
      { vizType: "kpi", title: "Campañas Activas", groupBy: [], measures: [{ field: "campana_mkt", agg: "count_distinct", alias: "campanas" }], display: { icon: "Megaphone", format: "number", primaryColor: "#6366f1" }, layout: { x: 0, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Keywords Únicos", groupBy: [], measures: [{ field: "keyword", agg: "count_distinct", alias: "keywords" }], display: { icon: "Search", format: "number", primaryColor: "#22c55e" }, layout: { x: 3, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Total Leads", groupBy: [], measures: [{ agg: "count", alias: "total" }], display: { icon: "Users", format: "number", primaryColor: "#f59e0b" }, layout: { x: 6, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Conversión General", groupBy: [], measures: [{ agg: "count", alias: "total" }, { field: "es_venta", agg: "count_true", alias: "ventas" }], display: { icon: "TrendingUp", format: "percent", primaryColor: "#8b5cf6" }, layout: { x: 9, y: 0, w: 3, h: 4 } },
      { vizType: "bar", title: "Leads por Campaña Marketing", groupBy: ["campana_mkt"], measures: [{ agg: "count", alias: "leads" }], limit: 15, layout: { x: 0, y: 4, w: 6, h: 10 } },
      { vizType: "bar", title: "Leads por Keyword", groupBy: ["keyword"], measures: [{ agg: "count", alias: "leads" }], limit: 15, layout: { x: 6, y: 4, w: 6, h: 10 } },
      { vizType: "donut", title: "Distribución por Categoría Marketing", groupBy: ["categoria_mkt"], measures: [{ agg: "count", alias: "leads" }], limit: 10, layout: { x: 0, y: 14, w: 6, h: 8 } },
      { vizType: "ranking", title: "Keywords con Mayor Conversión", groupBy: ["keyword"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], limit: 10, layout: { x: 6, y: 14, w: 6, h: 8 } },
      { vizType: "line", title: "Leads por Campaña MKT por Mes", groupBy: ["fch_creacion"], measures: [{ agg: "count", alias: "leads" }], dateGranularity: { fch_creacion: "month" }, orderDir: "asc", limit: 24, layout: { x: 0, y: 22, w: 12, h: 8 } },
    ],
  },
  {
    key: "operativo",
    name: "⚙️ Dashboard Operativo",
    description: "Gestiones, estados de marcadora, BPO y tiempos de respuesta",
    icon: "⚙️",
    widgets: [
      { vizType: "kpi", title: "Leads Creados", groupBy: [], measures: [{ agg: "count", alias: "total" }], display: { icon: "Plus", format: "number", primaryColor: "#6366f1" }, layout: { x: 0, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Leads Gestionados", groupBy: [], measures: [{ field: "agente_prim_gestion", agg: "count_not_null", alias: "gestionados" }], display: { icon: "CheckCircle", format: "number", primaryColor: "#22c55e" }, layout: { x: 3, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "Sin Gestión", groupBy: [], measures: [{ agg: "count", alias: "total" }], filters: [{ field: "agente_prim_gestion", op: "is_false", values: [] }], display: { icon: "AlertCircle", format: "number", primaryColor: "#ef4444" }, layout: { x: 6, y: 0, w: 3, h: 4 } },
      { vizType: "kpi", title: "BPOs Activos", groupBy: [], measures: [{ field: "bpo", agg: "count_distinct", alias: "bpos" }], display: { icon: "Building", format: "number", primaryColor: "#f59e0b" }, layout: { x: 9, y: 0, w: 3, h: 4 } },
      { vizType: "pie", title: "Resultado de Marcadora", groupBy: ["prim_resultado_marcadora"], measures: [{ agg: "count", alias: "total" }], limit: 10, layout: { x: 0, y: 4, w: 6, h: 8 } },
      { vizType: "bar", title: "Gestión por BPO", groupBy: ["bpo"], measures: [{ agg: "count", alias: "leads" }, { field: "es_venta", agg: "count_true", alias: "ventas" }], limit: 10, layout: { x: 6, y: 4, w: 6, h: 8 } },
      { vizType: "donut", title: "Resultado Última Gestión", groupBy: ["result_ultim_gestion"], measures: [{ agg: "count", alias: "total" }], limit: 10, layout: { x: 0, y: 12, w: 6, h: 8 } },
      { vizType: "bar", title: "Leads por Tipo de Llamada", groupBy: ["tipo_llamada"], measures: [{ agg: "count", alias: "leads" }], limit: 10, layout: { x: 6, y: 12, w: 6, h: 8 } },
      { vizType: "line", title: "Gestiones por Día", groupBy: ["fch_prim_gestion"], measures: [{ agg: "count", alias: "gestiones" }], dateGranularity: { fch_prim_gestion: "day" }, orderDir: "asc", limit: 60, layout: { x: 0, y: 20, w: 12, h: 8 } },
    ],
  },
  {
    key: "geografico",
    name: "🗺️ Dashboard Geográfico",
    description: "Distribución por ciudad, comparativos geográficos",
    icon: "🗺️",
    widgets: [
      { vizType: "kpi", title: "Ciudades con Leads", groupBy: [], measures: [{ field: "ciudad", agg: "count_distinct", alias: "ciudades" }], display: { icon: "MapPin", format: "number", primaryColor: "#6366f1" }, layout: { x: 0, y: 0, w: 4, h: 4 } },
      { vizType: "kpi", title: "Total Leads", groupBy: [], measures: [{ agg: "count", alias: "total" }], display: { icon: "Users", format: "number", primaryColor: "#22c55e" }, layout: { x: 4, y: 0, w: 4, h: 4 } },
      { vizType: "kpi", title: "Total Ventas", groupBy: [], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], display: { icon: "DollarSign", format: "number", primaryColor: "#f59e0b" }, layout: { x: 8, y: 0, w: 4, h: 4 } },
      { vizType: "bar_horizontal", title: "Leads por Ciudad (Top 15)", groupBy: ["ciudad"], measures: [{ agg: "count", alias: "leads" }], limit: 15, layout: { x: 0, y: 4, w: 6, h: 12 } },
      { vizType: "bar_horizontal", title: "Ventas por Ciudad (Top 15)", groupBy: ["ciudad"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }], limit: 15, layout: { x: 6, y: 4, w: 6, h: 12 } },
      { vizType: "ranking", title: "Ranking Ciudades por Conversión", groupBy: ["ciudad"], measures: [{ field: "es_venta", agg: "count_true", alias: "ventas" }, { agg: "count", alias: "leads" }], limit: 10, layout: { x: 0, y: 16, w: 6, h: 8 } },
      { vizType: "donut", title: "Distribución por Ciudad (Top 8)", groupBy: ["ciudad"], measures: [{ agg: "count", alias: "leads" }], limit: 8, layout: { x: 6, y: 16, w: 6, h: 8 } },
    ],
  },
];

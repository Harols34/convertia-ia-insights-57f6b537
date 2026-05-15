import type { PivotWidgetPersistedConfig } from "@/types/analytics-pivot";

export interface DashboardTemplate {
  name: string;
  widgets: Partial<PivotWidgetPersistedConfig>[];
}

export const ANALYTICS_PRESETS: DashboardTemplate[] = [
  {
    name: "Dashboard Ejecutivo",
    widgets: [
      { viz: "card", displayName: "Total Leads", rowFields: ["id_lead"], measures: [{ id: "m1", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m1", layout: { i: "w1", x: 0, y: 0, w: 3, h: 2 } },
      { viz: "card", displayName: "Total Ventas", rowFields: ["es_venta"], measures: [{ id: "m2", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m2", layout: { i: "w2", x: 3, y: 0, w: 3, h: 2 } },
      { viz: "card", displayName: "Conversión", rowFields: ["es_venta"], measures: [{ id: "m3", kind: "field", field: "es_venta", aggregation: "avg", label: "Conv %", showAs: "none" }], chartMeasureId: "m3", layout: { i: "w3", x: 6, y: 0, w: 3, h: 2 } },
      { viz: "line", displayName: "Ventas por Periodo", rowFields: ["fch_creacion"], measures: [{ id: "m4", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m4", layout: { i: "w4", x: 0, y: 2, w: 12, h: 4 } },
      { viz: "ranking_horizontal", displayName: "Ranking de Campañas", rowFields: ["campana_mkt"], measures: [{ id: "m5", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m5", layout: { i: "w5", x: 0, y: 6, w: 6, h: 4 } },
      { viz: "ranking_horizontal", displayName: "Ranking de Agentes", rowFields: ["agente_negocio"], measures: [{ id: "m6", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m6", layout: { i: "w6", x: 6, y: 6, w: 6, h: 4 } },
    ]
  },
  {
    name: "Dashboard Comercial",
    widgets: [
      { viz: "bar", displayName: "Ventas por Agente", rowFields: ["agente_negocio"], measures: [{ id: "m1", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m1", layout: { i: "w1", x: 0, y: 0, w: 12, h: 4 } },
      { viz: "donut", displayName: "Resultados de Gestión", rowFields: ["result_ultim_gestion"], measures: [{ id: "m2", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m2", layout: { i: "w2", x: 0, y: 4, w: 6, h: 4 } },
      { viz: "ranking_vertical", displayName: "Top Agentes", rowFields: ["agente_negocio"], measures: [{ id: "m3", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m3", layout: { i: "w3", x: 6, y: 4, w: 6, h: 4 } },
    ]
  },
  {
    name: "Dashboard Marketing",
    widgets: [
      { viz: "treemap", displayName: "Leads por Campaña", rowFields: ["campana_mkt"], measures: [{ id: "m1", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m1", layout: { i: "w1", x: 0, y: 0, w: 7, h: 4 } },
      { viz: "donut", displayName: "Conversión por Campaña", rowFields: ["campana_mkt"], measures: [{ id: "m2", kind: "field", field: "es_venta", aggregation: "avg", label: "Conv %", showAs: "none" }], chartMeasureId: "m2", layout: { i: "w2", x: 7, y: 0, w: 5, h: 4 } },
      { viz: "area_stacked", displayName: "Evolución por Keyword", rowFields: ["fch_creacion"], colFields: ["keyword"], measures: [{ id: "m3", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m3", layout: { i: "w3", x: 0, y: 4, w: 12, h: 4 } },
    ]
  },
  {
    name: "Dashboard Operativo",
    widgets: [
      { viz: "card", displayName: "Leads Creados", rowFields: ["id_lead"], measures: [{ id: "m1", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m1", layout: { i: "w1", x: 0, y: 0, w: 3, h: 2 } },
      { viz: "card", displayName: "Leads Gestionados", rowFields: ["agente_prim_gestion"], measures: [{ id: "m2", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m2", layout: { i: "w2", x: 3, y: 0, w: 3, h: 2 } },
      { viz: "bar_horizontal", displayName: "Resultados Marcadora", rowFields: ["prim_resultado_marcadora"], measures: [{ id: "m3", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m3", layout: { i: "w3", x: 0, y: 2, w: 6, h: 4 } },
      { viz: "bar_horizontal", displayName: "Gestión por BPO", rowFields: ["bpo"], measures: [{ id: "m4", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m4", layout: { i: "w4", x: 6, y: 2, w: 6, h: 4 } },
    ]
  },
  {
    name: "Dashboard Geográfico",
    widgets: [
      { viz: "bar_horizontal", displayName: "Leads por Ciudad", rowFields: ["ciudad"], measures: [{ id: "m1", kind: "field", field: "id_lead", aggregation: "count", label: "Leads", showAs: "none" }], chartMeasureId: "m1", layout: { i: "w1", x: 0, y: 0, w: 6, h: 8 } },
      { viz: "ranking_vertical", displayName: "Ventas por Ciudad", rowFields: ["ciudad"], measures: [{ id: "m2", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m2", layout: { i: "w2", x: 6, y: 0, w: 6, h: 4 } },
      { viz: "donut", displayName: "Conversión por Ciudad", rowFields: ["ciudad"], measures: [{ id: "m3", kind: "field", field: "es_venta", aggregation: "avg", label: "Conv %", showAs: "none" }], chartMeasureId: "m3", layout: { i: "w3", x: 6, y: 4, w: 6, h: 4 } },
    ]
  },
  {
    name: "Dashboard BPO",
    widgets: [
      { viz: "bar_stacked", displayName: "Ventas por BPO", rowFields: ["bpo"], colFields: ["es_venta"], measures: [{ id: "m1", kind: "field", field: "es_venta", aggregation: "sum", label: "Ventas", showAs: "none" }], chartMeasureId: "m1", layout: { i: "w1", x: 0, y: 0, w: 8, h: 4 } },
      { viz: "card", displayName: "Eficiencia BPO", rowFields: ["bpo"], measures: [{ id: "m2", kind: "field", field: "es_venta", aggregation: "avg", label: "Conv %", showAs: "none" }], chartMeasureId: "m2", layout: { i: "w2", x: 8, y: 0, w: 4, h: 4 } },
    ]
  }
];

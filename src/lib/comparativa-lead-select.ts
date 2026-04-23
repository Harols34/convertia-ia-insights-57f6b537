import { LEADS_DASHBOARD_FILTER_COLUMNS, type LeadRow } from "@/lib/dashboard-leads";

/**
 * Columnas mínimas para filtros + `ComparativaDashboardSection` (evita `select *` en decenas/centenas de MB).
 * Incluye fechas, venta y todo lo filtrable en el panel.
 *
 * Fase D2: si en el futuro las series de comparativa se rellenan vía RPC timeseries, podría bastar un subconjunto
 * aún más pequeño para el cliente; el explorador por dimensión seguirá necesitando filas o un endpoint dedicado.
 */
const extra = new Set<keyof LeadRow>(["fch_creacion", "es_venta"]);
for (const { key } of LEADS_DASHBOARD_FILTER_COLUMNS) {
  extra.add(key);
}

export const COMPARATIVA_LEAD_SELECT_COLUMNS: string[] = [...extra].map(String).sort();

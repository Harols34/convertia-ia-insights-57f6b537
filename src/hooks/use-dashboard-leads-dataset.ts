import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllIntegrationRows } from "@/components/integraciones/fetch-integration-table";
import { normalizeLeadsDatasetForDashboard, type LeadRow } from "@/lib/dashboard-leads";
import { COMPARATIVA_LEAD_SELECT_COLUMNS } from "@/lib/comparativa-lead-select";

export const DASHBOARD_LEADS_QUERY_KEY = ["leads", "comparative-dataset", "v2"] as const;

const STABLE_KEY_SUFFIX = "slim";

type Options = {
  /** Si false, no se descarga nada (evita 1 bloqueo largo al abrir /app). */
  enabled?: boolean;
  onProgress?: (rowsLoaded: number) => void;
  /** Proyección de columnas; por defecto conjunto mínimo para comparativa. */
  selectColumns?: string[];
  /** Tamaño de página HTTP (más reducciones de round-trips con más ancho de banda por request). */
  pageSize?: number;
  /**
   * Filtro de `fch_creacion` en el servidor (mismos criterios `yyyy-MM-dd` que el panel del dashboard).
   * Si ambos faltan, se descargan todos los leads visibles (RLS).
   */
  fchRango?: { desde?: string; hasta?: string };
  /**
   * Alineada con el dashboard ejecutivo (`leadsFiltersQueryKey`); invalida el caché si cambian
   * dimensiones / esVenta aunque el corte en servidor actual solo use fechas.
   */
  panelFiltersKey?: string;
};

/**
 * Descarga el universo de leads (RLS) en cliente **solo con columnas necesarias** para
 * `ComparativaDashboardSection` y filtros; suele ser mucho más liviano que `select *`.
 */
export function useDashboardLeadsDataset(options?: Options) {
  const {
    enabled = true,
    onProgress,
    selectColumns = COMPARATIVA_LEAD_SELECT_COLUMNS,
    pageSize = 5000,
    fchRango,
    panelFiltersKey = "",
  } = options ?? {};
  const colKey = selectColumns.length ? selectColumns.join(",") : "*";
  const fchKey = `${fchRango?.desde ?? ""}\u0000${fchRango?.hasta ?? ""}`;

  return useQuery({
    queryKey: [...DASHBOARD_LEADS_QUERY_KEY, STABLE_KEY_SUFFIX, colKey, pageSize, fchKey] as const,
    enabled,
    queryFn: async () => {
      onProgress?.(0);
      const rango =
        fchRango && (fchRango.desde?.trim() || fchRango.hasta?.trim())
          ? { desde: fchRango.desde?.trim(), hasta: fchRango.hasta?.trim() }
          : undefined;
      const rows = (await fetchAllIntegrationRows(
        supabase,
        "leads",
        (n) => onProgress?.(n),
        undefined,
        selectColumns,
        { column: "fch_creacion", ascending: true },
        pageSize,
        rango,
      )) as LeadRow[];
      const normalized = normalizeLeadsDatasetForDashboard(rows);
      onProgress?.(normalized.length);
      return normalized;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

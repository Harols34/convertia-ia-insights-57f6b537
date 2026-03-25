import type { Database } from "@/integrations/supabase/types";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

/** Columnas filtrables (etiqueta en UI). Excluye ids/timestamps internos. */
export const LEADS_DASHBOARD_FILTER_COLUMNS: { key: keyof LeadRow; label: string }[] = [
  { key: "cliente", label: "Cliente" },
  { key: "campana_mkt", label: "Campaña MKT" },
  { key: "campana_inconcert", label: "Campaña Inconcert" },
  { key: "categoria_mkt", label: "Categoría MKT" },
  { key: "ciudad", label: "Ciudad" },
  { key: "tipo_llamada", label: "Tipo llamada" },
  { key: "agente_prim_gestion", label: "Agente 1ª gestión" },
  { key: "agente_ultim_gestion", label: "Agente últ. gestión" },
  { key: "agente_negocio", label: "Agente negocio" },
  { key: "bpo", label: "BPO" },
  { key: "result_prim_gestion", label: "Resultado 1ª gestión" },
  { key: "result_ultim_gestion", label: "Resultado últ. gestión" },
  { key: "result_negocio", label: "Resultado negocio" },
  { key: "prim_resultado_marcadora", label: "Resultado marcador" },
  { key: "keyword", label: "Keyword" },
  { key: "email", label: "Email" },
  { key: "id_lead", label: "ID lead" },
  { key: "id_llave", label: "ID llave" },
];

/** Valor interno para leads sin dato en columnas filtrables (coincide con `uniqueValuesForColumn`). */
export const LEADS_FILTER_EMPTY_TOKEN = "__vacío__";

const EMPTY_TOKEN = LEADS_FILTER_EMPTY_TOKEN;

export type LeadsDashboardFilters = {
  desde?: string;
  hasta?: string;
  /** all | sí | no */
  esVenta: "all" | "yes" | "no";
  /** Por columna: valores seleccionados (OR dentro de la columna). */
  dimensions: Partial<Record<keyof LeadRow, string[]>>;
};

export const defaultLeadsDashboardFilters = (): LeadsDashboardFilters => ({
  esVenta: "all",
  dimensions: {},
});

function rowScalar(row: LeadRow, key: keyof LeadRow): string {
  const v = row[key];
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function datePartCreacion(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Aplica filtros en memoria sobre el dataset completo. */
export function applyLeadsDashboardFilters(leads: LeadRow[], f: LeadsDashboardFilters): LeadRow[] {
  return leads.filter((row) => {
    if (f.desde) {
      const dp = datePartCreacion(row.fch_creacion);
      if (!dp || dp < f.desde) return false;
    }
    if (f.hasta) {
      const dp = datePartCreacion(row.fch_creacion);
      if (!dp || dp > f.hasta) return false;
    }
    if (f.esVenta === "yes" && !row.es_venta) return false;
    if (f.esVenta === "no" && row.es_venta) return false;

    for (const [col, vals] of Object.entries(f.dimensions) as [keyof LeadRow, string[]][]) {
      if (!vals?.length) continue;
      const raw = rowScalar(row, col);
      const normalized = raw === "" ? EMPTY_TOKEN : raw;
      const allowed = new Set(vals);
      if (!allowed.has(normalized)) return false;
    }
    return true;
  });
}

export function uniqueValuesForColumn(leads: LeadRow[], key: keyof LeadRow, max = 400): string[] {
  const s = new Set<string>();
  for (const row of leads) {
    const v = rowScalar(row, key);
    s.add(v === "" ? EMPTY_TOKEN : v);
  }
  const arr = [...s].sort((a, b) => {
    if (a === EMPTY_TOKEN) return 1;
    if (b === EMPTY_TOKEN) return -1;
    return a.localeCompare(b, "es");
  });
  return arr.slice(0, max);
}

export function formatFilterChipValue(token: string): string {
  if (token === EMPTY_TOKEN) return "(vacío)";
  return token.length > 48 ? `${token.slice(0, 45)}…` : token;
}

/** Comprueba si el lead coincide con un valor de dimensión (mismo criterio que filtros). */
export function rowMatchesDimensionToken(row: LeadRow, column: keyof LeadRow, token: string): boolean {
  const raw = rowScalar(row, column);
  const normalized = raw === "" ? EMPTY_TOKEN : raw;
  return normalized === token;
}

/** Convierte la etiqueta mostrada en gráficos (p. ej. pie) al token guardado en filtros. */
export function filterTokenFromChartLabel(chartLabel: string): string {
  if (chartLabel === "(vacío)") return LEADS_FILTER_EMPTY_TOKEN;
  return chartLabel;
}

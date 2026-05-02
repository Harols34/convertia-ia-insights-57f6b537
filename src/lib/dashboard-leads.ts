import { endOfDay, format, parseISO, startOfMonth, subDays, startOfDay } from "date-fns";
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

/**
 * Rango del **mes en curso** (día 1 → hoy) para el atajo "Mes actual" o cuando el usuario
 * elige un mes explícitamente, no para el reset inicial.
 */
export function getDefaultMonthToDateRange(now: Date = new Date()): { desde: string; hasta: string } {
  return {
    desde: format(startOfMonth(now), "yyyy-MM-dd"),
    hasta: format(endOfDay(now), "yyyy-MM-dd"),
  };
}

/**
 * Días de evolución diaria mostrados en análisis fijo cuando el panel no aplica
 * corte de fechas ni dimensiones: KPIs y rankings usan el histórico completo; la serie
 * temporal se acorta solo a efectos visuales.
 */
export const DASHBOARD_DEFAULT_CHART_DAYS = 15;

/**
 * Barras semanales ISO a mostrar en la misma vista resumida (~15 días calendario).
 */
export const DASHBOARD_DEFAULT_WEEK_BARS = 3;

/**
 * Filtro inicial: sin rango de fechas (el servidor de KPIs/embudo/rankings agrega
 * **todo** el histórico visible bajo RLS). Las fechas/ dimensiones se añaden solo al
 * filtrar con el panel.
 */
export const defaultLeadsDashboardFilters = (): LeadsDashboardFilters => {
  const now = new Date();
  return {
    desde: format(subDays(now, 30), "yyyy-MM-dd"),
    hasta: format(now, "yyyy-MM-dd"),
    esVenta: "all",
    dimensions: {},
  };
};

function rowScalar(row: LeadRow, key: keyof LeadRow): string {
  const v = row[key];
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

/** 
 * Obtiene el valor normalizado para una columna (trata nulos, vacíos y casos especiales como ciudad/cliente).
 */
export function getNormalizedLeadValue(row: LeadRow, key: keyof LeadRow): string {
  let v = rowScalar(row, key);
  if (key === "ciudad" && (v === "" || v === "{\"\",\"\"}")) {
    return "Sin ciudad";
  }
  if (key === "cliente" && v !== "") {
    return v.toLowerCase();
  }
  return v === "" ? LEADS_FILTER_EMPTY_TOKEN : v;
}

/**
 * Pasa un valor de `fch_creacion` (texto, ISO con Z, etc.) al **día calendario local** `yyyy-MM-dd`.
 * Necesario para comparar con "hoy" y con filtros del panel: no usar `slice(0,10)` en timestamps UTC.
 */
export function fchCreacionToLocalYmd(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (!s) return "";
  try {
    // Si ya viene limpio como YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }
    
    // Intentar limpiar separadores raros si detectamos formato YYYY-MM-DD:HH...
    const cleanS = s.includes(":") && s.indexOf(":") === 10 
      ? s.slice(0, 10) + " " + s.slice(11)
      : s;

    let d = new Date(cleanS);
    if (Number.isNaN(d.getTime())) {
      // Fallback: tomar los primeros 10 caracteres si parecen una fecha
      const potentialDate = s.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(potentialDate)) {
        return potentialDate;
      }
      d = parseISO(s);
    }
    
    if (Number.isNaN(d.getTime())) return "";
    return format(d, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

/** Misma semántica que `fchCreacionToLocalYmd` (alias usado en filtros). */
export function datePartCreacion(raw: string | null | undefined): string {
  return fchCreacionToLocalYmd(raw);
}

/**
 * Sobre cada fila recibida de la BD, fija `fch_creacion` al día local ya normalizado
 * (comparables con la fecha actual y con ventanas de gráficos).
 */
export function normalizeLeadRowFchForDashboard<T extends LeadRow>(row: T): T {
  const ymd = fchCreacionToLocalYmd(row.fch_creacion);
  if (!ymd) return row;
  return { ...row, fch_creacion: ymd };
}

/** Aplicar al terminar de descargar el dataset de comparativa (una vez, en el hook). */
export function normalizeLeadsDatasetForDashboard(leads: LeadRow[]): LeadRow[] {
  return leads.map(normalizeLeadRowFchForDashboard);
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
      const normalized = getNormalizedLeadValue(row, col);
      const allowed = new Set(vals);
      if (!allowed.has(normalized)) return false;
    }
    return true;
  });
}

export function uniqueValuesForColumn(leads: LeadRow[], key: keyof LeadRow, max = 400): string[] {
  const s = new Set<string>();
  for (const row of leads) {
    s.add(getNormalizedLeadValue(row, key));
  }
  const arr = [...s].sort((a, b) => {
    if (a === LEADS_FILTER_EMPTY_TOKEN) return 1;
    if (b === LEADS_FILTER_EMPTY_TOKEN) return -1;
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
  return getNormalizedLeadValue(row, column) === token;
}

/** Convierte la etiqueta mostrada en gráficos (p. ej. pie) al token guardado en filtros. */
export function filterTokenFromChartLabel(chartLabel: string): string {
  if (chartLabel === "(vacío)") return LEADS_FILTER_EMPTY_TOKEN;
  return chartLabel;
}

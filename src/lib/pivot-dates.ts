/** Agrupación tipo Power BI / Excel para campos fecha-datetime */

export type DateGranularity = "raw" | "day" | "month" | "year" | "quarter" | "week";

export const DATE_GRANULARITY_LABELS: Record<DateGranularity, string> = {
  raw: "Fecha completa (solo día)",
  day: "Día",
  month: "Mes",
  year: "Año",
  quarter: "Trimestre",
  week: "Semana (ISO)",
};

export function isDateLikeType(dataType: string, udtName: string): boolean {
  const t = `${dataType} ${udtName}`.toLowerCase();
  return (
    t.includes("timestamp") ||
    t.includes("date") ||
    t === "date" ||
    udtName === "date" ||
    udtName === "timestamptz" ||
    udtName === "timestamp"
  );
}

export function parseToDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Muestra fecha “limpia” sin hora cuando aplica (solo parte calendario). */
export function formatDateCleanForDisplay(v: unknown): string {
  const d = parseToDate(v);
  if (!d) return v == null ? "" : String(v);
  return d.toLocaleDateString("es", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function isoWeekYear(d: Date): { y: number; w: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const yStart = new Date(Date.UTC(y, 0, 1));
  const w = Math.ceil(((+t - +yStart) / 86400000 + 1) / 7);
  return { y, w };
}

export function bucketDateValue(v: unknown, g: DateGranularity): string {
  if (g === "raw") return formatDateCleanForDisplay(v);
  const d = parseToDate(v);
  if (!d) return "(sin fecha)";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  switch (g) {
    case "day":
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    case "month":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "year":
      return String(y);
    case "quarter": {
      const q = Math.floor((m - 1) / 3) + 1;
      return `${y}-T${q}`;
    }
    case "week": {
      const { y: wy, w } = isoWeekYear(d);
      return `${wy}-S${String(w).padStart(2, "0")}`;
    }
    default:
      return formatDateCleanForDisplay(v);
  }
}

export function dimensionValueForField(
  row: Record<string, unknown>,
  field: string,
  dateFields: Set<string>,
  granularity: Record<string, DateGranularity>,
): string {
  const v = row[field];
  const g = granularity[field] ?? "raw";
  if (dateFields.has(field)) {
    return bucketDateValue(v, g);
  }
  if (v == null) return "";
  if (v instanceof Date) return formatDateCleanForDisplay(v);
  return String(v);
}

function rowMatchesYearQuarter(dimVal: string, y: number, q: number): boolean {
  const startM = (q - 1) * 3 + 1;
  for (let mi = 0; mi < 3; mi++) {
    const m = startM + mi;
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    if (dimVal === prefix || dimVal.startsWith(prefix + "-")) return true;
  }
  return false;
}

/**
 * ¿`rowVal` (bucket de una vista) coincide con `sel` (valor del slicer u otro widget)?
 * Tolera mes vs día, año vs mes, trimestre `YYYY-Tn`, etc.
 */
export function dateCrossFilterSelectionsMatch(rowVal: string, sel: string): boolean {
  if (rowVal === sel) return true;
  if (rowVal.length > sel.length && rowVal.startsWith(sel + "-")) return true;
  if (sel.length > rowVal.length && sel.startsWith(rowVal + "-")) return true;
  if (/^\d{4}$/.test(sel) && rowVal.startsWith(sel + "-")) return true;
  if (/^\d{4}$/.test(rowVal) && sel.startsWith(rowVal + "-")) return true;

  const mSel = sel.match(/^(\d{4})-T([1-4])$/);
  if (mSel) {
    const y = Number(mSel[1]);
    const q = Number(mSel[2]);
    if (rowMatchesYearQuarter(rowVal, y, q)) return true;
  }
  const mRow = rowVal.match(/^(\d{4})-T([1-4])$/);
  if (mRow) {
    const y = Number(mRow[1]);
    const q = Number(mRow[2]);
    if (rowMatchesYearQuarter(sel, y, q)) return true;
  }
  return false;
}

/** OR entre valores de filtro para un campo fecha (cortes cruzados con distinta granularidad). */
export function dateCrossFilterMatchesRowValue(rowVal: string, filterVals: string[]): boolean {
  for (const sel of filterVals) {
    if (dateCrossFilterSelectionsMatch(rowVal, sel)) return true;
  }
  return false;
}

/** OR para dimensiones no fecha: incluye igualdad numérica 5 vs "5.0". */
export function scalarCrossFilterMatches(rowVal: string, filterVals: string[]): boolean {
  for (const fv of filterVals) {
    if (fv === rowVal) return true;
    const nRow = Number(String(rowVal).replace(",", ".").replace(/\s/g, ""));
    const nFv = Number(String(fv).replace(",", ".").replace(/\s/g, ""));
    if (
      rowVal !== "" &&
      String(fv) !== "" &&
      !Number.isNaN(nRow) &&
      !Number.isNaN(nFv) &&
      nRow === nFv
    ) {
      return true;
    }
  }
  return false;
}

/** Una fila pasa el filtro de dimensión si su valor coincide con la selección (fecha flexible o escalar). */
export function crossFilterDimensionMatches(
  field: string,
  rowVal: string,
  filterVals: string[],
  dateFieldSet: Set<string>,
): boolean {
  if (!filterVals.length) return true;
  if (filterVals.includes(rowVal)) return true;
  if (dateFieldSet.has(field)) return dateCrossFilterMatchesRowValue(rowVal, filterVals);
  return scalarCrossFilterMatches(rowVal, filterVals);
}

/** Etiqueta corta para chips de filtro (evita ISO con hora en campos fecha por mes). */
export function formatDateBucketChipLabel(value: string, gran: DateGranularity): string {
  if (value === "(vacío)") return value;
  if (gran === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [ys, ms] = value.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return value;
    return new Date(y, m - 1, 1).toLocaleDateString("es", { month: "short", year: "numeric" });
  }
  if (gran === "year" && /^\d{4}$/.test(value)) {
    return value;
  }
  if (gran === "quarter" && /^\d{4}-T[1-4]$/.test(value)) {
    return value.replace("-T", " T");
  }
  if (gran === "day" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [ys, ms, ds] = value.split("-").map(Number);
    if (!Number.isFinite(ys) || !Number.isFinite(ms) || !Number.isFinite(ds)) return value;
    return new Date(ys, ms - 1, ds).toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return value;
}

/**
 * Motor tipo tabla dinámica: agregaciones, medidas calculadas y "mostrar valores como".
 */

import {
  crossFilterDimensionMatches,
  dimensionValueForField,
  type DateGranularity,
} from "./pivot-dates";

export type { DateGranularity } from "./pivot-dates";

export const PIVOT_KEY_SEP = "\u0001";

export type AggFn = "sum" | "count" | "avg" | "max" | "min" | "countDistinct";

export type CalcOp = "add" | "subtract" | "multiply" | "divide" | "pctChange";

/** Opciones alineadas con Excel / Power Pivot (subconjunto práctico). */
export type ShowAs =
  | "none"
  | "percentGrand"
  | "percentCol"
  | "percentRow"
  | "percentParentRow"
  | "percentParentCol"
  | "percentParentGrand"
  | "diffPrevRow"
  | "diffPrevCol"
  | "pctDiffPrevRow"
  | "pctDiffPrevCol"
  | "rankAscInRow"
  | "rankDescInRow"
  | "rankAscInCol"
  | "rankDescInCol";

export interface PivotFilter {
  field: string;
  /** Vacío = sin filtro en este campo */
  values: string[];
}

export interface PivotMeasureSpec {
  id: string;
  kind: "field" | "calculated";
  label?: string;
  field?: string;
  aggregation?: AggFn;
  calculated?: { op: CalcOp; leftId: string; rightId: string };
  showAs: ShowAs;
}

export interface PivotConfig {
  rowFields: string[];
  colFields: string[];
  filters: PivotFilter[];
  measures: PivotMeasureSpec[];
  /** Nombres de columnas fecha/timestamp (metadatos) */
  dateFields?: string[];
  /** Agrupación por campo: día, mes, año… (Power BI) */
  fieldDateGranularity?: Record<string, DateGranularity>;
}

export interface PivotGridResult {
  rowKeys: string[];
  colKeys: string[];
  /** rowKey -> colKey -> measureId -> valor mostrado */
  cells: Map<string, Map<string, Map<string, number>>>;
  rowLabels: Map<string, string[]>;
  colLabels: Map<string, string[]>;
}

function cellKey(parts: string[]): string {
  return parts.join(PIVOT_KEY_SEP);
}

function parseKey(k: string): string[] {
  return k.split(PIVOT_KEY_SEP);
}

/** Partes de una clave de fila del pivot (separador interno), alineadas con `rowFields`. */
export function parsePivotRowKeyParts(rowKey: string): string[] {
  return parseKey(rowKey);
}

export function formatPivotLabel(parts: string[]): string {
  return parts.join(" · ");
}

export function toScalarString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const t = v.trim().replace(/\s/g, "").replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type AggBucket = {
  sum: number;
  count: number;
  min: number;
  max: number;
  distinct: Set<string>;
};

function emptyBucket(): AggBucket {
  return {
    sum: 0,
    count: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    distinct: new Set(),
  };
}

function mergeBucket(b: AggBucket, row: Record<string, unknown>, field: string | undefined, agg: AggFn): void {
  const raw = field ? row[field] : undefined;
  const s = raw !== undefined && raw !== null ? toScalarString(raw) : "";
  const n = field ? toNumber(raw) : null;

  switch (agg) {
    case "count":
      b.count += 1;
      break;
    case "countDistinct":
      b.count += 1;
      if (s) b.distinct.add(s);
      break;
    case "sum":
    case "avg":
      if (n != null) {
        b.sum += n;
        b.count += 1;
        b.min = Math.min(b.min, n);
        b.max = Math.max(b.max, n);
      }
      break;
    case "max":
      if (n != null) {
        b.count += 1;
        b.max = Math.max(b.max, n);
      }
      break;
    case "min":
      if (n != null) {
        b.count += 1;
        b.min = Math.min(b.min, n);
      }
      break;
    default:
      break;
  }
}

function bucketToValue(b: AggBucket, agg: AggFn): number {
  switch (agg) {
    case "count":
      return b.count;
    case "countDistinct":
      return b.distinct.size;
    case "sum":
      return b.sum;
    case "avg":
      return b.count > 0 ? b.sum / b.count : 0;
    case "max":
      return b.count > 0 ? b.max : 0;
    case "min":
      return b.count > 0 ? b.min : 0;
    default:
      return 0;
  }
}

function passesFilters(
  row: Record<string, unknown>,
  filters: PivotFilter[],
  dateFieldSet: Set<string>,
  gran: Record<string, DateGranularity>,
): boolean {
  for (const f of filters) {
    if (!f.values.length) continue;
    let val = dimensionValueForField(row, f.field, dateFieldSet, gran);
    if (val === "") val = "(vacío)";
    if (!crossFilterDimensionMatches(f.field, val, f.values, dateFieldSet)) return false;
  }
  return true;
}

function fieldMeasuresFirst(measures: PivotMeasureSpec[]): PivotMeasureSpec[] {
  const field = measures.filter((m) => m.kind === "field");
  const calc = measures.filter((m) => m.kind === "calculated");
  return [...field, ...calc];
}

function evalCalc(op: CalcOp, a: number, b: number): number {
  switch (op) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      return b !== 0 ? a / b : 0;
    case "pctChange":
      return b !== 0 ? ((a - b) / b) * 100 : 0;
    default:
      return 0;
  }
}

/** Agregación base + medidas calculadas (sin showAs). */
export function runPivotAggregation(
  rows: Record<string, unknown>[],
  config: PivotConfig,
): {
  rowKeys: string[];
  colKeys: string[];
  raw: Map<string, Map<string, Map<string, number>>>;
  rowLabels: Map<string, string[]>;
  colLabels: Map<string, string[]>;
} {
  const { rowFields, colFields, filters, measures } = config;
  const orderedMeasures = fieldMeasuresFirst(measures);
  const dateFieldSet = new Set(config.dateFields ?? []);
  const gran = config.fieldDateGranularity ?? {};

  const filtered = rows.filter((r) => passesFilters(r, filters, dateFieldSet, gran));

  const bucketMap = new Map<string, Map<string, Map<string, AggBucket>>>();

  const dimPart = (row: Record<string, unknown>, f: string) => {
    let v = dimensionValueForField(row, f, dateFieldSet, gran);
    if (v === "") v = "(vacío)";
    return v;
  };

  for (const row of filtered) {
    const rp = rowFields.map((f) => dimPart(row, f));
    const cp = colFields.length ? colFields.map((f) => dimPart(row, f)) : ["Σ"];
    const rk = cellKey(rp);
    const ck = cellKey(cp);

    if (!bucketMap.has(rk)) bucketMap.set(rk, new Map());
    const rowMap = bucketMap.get(rk)!;
    if (!rowMap.has(ck)) rowMap.set(ck, new Map());
    const mMap = rowMap.get(ck)!;

    for (const m of orderedMeasures) {
      if (m.kind !== "field" || !m.field || !m.aggregation) continue;
      if (!mMap.has(m.id)) mMap.set(m.id, emptyBucket());
      mergeBucket(mMap.get(m.id)!, row, m.field, m.aggregation);
    }
  }

  const raw = new Map<string, Map<string, Map<string, number>>>();
  const rowKeys = [...bucketMap.keys()].sort();
  const colKeySet = new Set<string>();
  for (const rm of bucketMap.values()) {
    for (const ck of rm.keys()) colKeySet.add(ck);
  }
  const colKeys = [...colKeySet].sort();

  for (const rk of rowKeys) {
    raw.set(rk, new Map());
    const rowMap = bucketMap.get(rk)!;
    for (const ck of colKeys) {
      raw.get(rk)!.set(ck, new Map());
      const src = rowMap.get(ck);
      if (!src) continue;
      const dest = raw.get(rk)!.get(ck)!;
      for (const m of orderedMeasures) {
        if (m.kind !== "field" || !m.field || !m.aggregation) continue;
        const b = src.get(m.id);
        dest.set(m.id, b ? bucketToValue(b, m.aggregation) : 0);
      }
    }
  }

  // Medidas calculadas
  for (const m of orderedMeasures) {
    if (m.kind !== "calculated" || !m.calculated) continue;
    const { op, leftId, rightId } = m.calculated;
    for (const rk of rowKeys) {
      for (const ck of colKeys) {
        const cell = raw.get(rk)!.get(ck)!;
        const a = cell.get(leftId) ?? 0;
        const b = cell.get(rightId) ?? 0;
        cell.set(m.id, evalCalc(op, a, b));
      }
    }
  }

  const rowLabels = new Map<string, string[]>();
  const colLabels = new Map<string, string[]>();
  for (const rk of rowKeys) rowLabels.set(rk, parseKey(rk));
  for (const ck of colKeys) colLabels.set(ck, parseKey(ck));

  return { rowKeys, colKeys, raw, rowLabels, colLabels };
}

function sumMeasureForGrand(raw: Map<string, Map<string, Map<string, number>>>, measureId: string): number {
  let t = 0;
  for (const colMap of raw.values()) {
    for (const cell of colMap.values()) {
      t += cell.get(measureId) ?? 0;
    }
  }
  return t;
}

function sumMeasureForRow(raw: Map<string, Map<string, Map<string, number>>>, rowKey: string, measureId: string): number {
  const colMap = raw.get(rowKey);
  if (!colMap) return 0;
  let t = 0;
  for (const cell of colMap.values()) t += cell.get(measureId) ?? 0;
  return t;
}

function sumMeasureForCol(raw: Map<string, Map<string, Map<string, number>>>, colKey: string, measureId: string): number {
  let t = 0;
  for (const colMap of raw.values()) {
    t += colMap.get(colKey)?.get(measureId) ?? 0;
  }
  return t;
}

/** Suma en subárbol de filas bajo el prefijo de padre (niveles de rowFields). */
export function sumForRowParentPrefix(
  raw: Map<string, Map<string, Map<string, number>>>,
  rowKey: string,
  colKey: string,
  measureId: string,
  rowFieldCount: number,
): number {
  const parts = parseKey(rowKey);
  if (parts.length <= 1) return sumMeasureForRow(raw, rowKey, measureId);
  const parentParts = parts.slice(0, -1);
  const prefix = cellKey(parentParts);
  let t = 0;
  for (const [rk, colMap] of raw) {
    const rp = parseKey(rk);
    if (rp.length !== rowFieldCount) continue;
    const sub = cellKey(rp.slice(0, parentParts.length));
    if (sub !== prefix) continue;
    t += colMap.get(colKey)?.get(measureId) ?? 0;
  }
  return t;
}

/** Subtotal de columnas hermanas bajo el mismo padre, en la fila actual. */
function sumForColParentPrefix(
  raw: Map<string, Map<string, Map<string, number>>>,
  rowKey: string,
  colKey: string,
  measureId: string,
  colFieldCount: number,
): number {
  const parts = parseKey(colKey);
  if (parts.length <= 1) return sumMeasureForCol(raw, colKey, measureId);
  const parentParts = parts.slice(0, -1);
  const prefix = cellKey(parentParts);
  const colMap = raw.get(rowKey);
  if (!colMap) return 0;
  let t = 0;
  for (const [ck, cell] of colMap) {
    const cp = parseKey(ck);
    if (cp.length !== colFieldCount) continue;
    if (cellKey(cp.slice(0, parentParts.length)) !== prefix) continue;
    t += cell.get(measureId) ?? 0;
  }
  return t;
}

export function applyShowAs(
  raw: Map<string, Map<string, Map<string, number>>>,
  rowKeys: string[],
  colKeys: string[],
  measures: PivotMeasureSpec[],
  rowFieldCount: number,
  colFieldCount: number,
): Map<string, Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, Map<string, number>>>();

  for (const rk of rowKeys) {
    out.set(rk, new Map());
    for (const ck of colKeys) {
      out.get(rk)!.set(ck, new Map());
    }
  }

  // Primera pasada: copiar valores base según showAs
  for (const rk of rowKeys) {
    for (const ck of colKeys) {
      const src = raw.get(rk)!.get(ck)!;
      const dst = out.get(rk)!.get(ck)!;
      for (const m of measures) {
        const v = src.get(m.id) ?? 0;
        const show = m.showAs;
        const mid = m.id;

        if (show === "none") {
          dst.set(mid, v);
          continue;
        }

        const grand = sumMeasureForGrand(raw, mid);
        const rowTot = sumMeasureForRow(raw, rk, mid);
        const colTot = sumMeasureForCol(raw, ck, mid);

        if (show === "percentGrand") {
          dst.set(mid, grand !== 0 ? (v / grand) * 100 : 0);
          continue;
        }
        if (show === "percentRow") {
          dst.set(mid, rowTot !== 0 ? (v / rowTot) * 100 : 0);
          continue;
        }
        if (show === "percentCol") {
          dst.set(mid, colTot !== 0 ? (v / colTot) * 100 : 0);
          continue;
        }
        if (show === "percentParentRow") {
          const den = sumForRowParentPrefix(raw, rk, ck, mid, rowFieldCount);
          dst.set(mid, den !== 0 ? (v / den) * 100 : 0);
          continue;
        }
        if (show === "percentParentCol") {
          const den = sumForColParentPrefix(raw, rk, ck, mid, colFieldCount);
          dst.set(mid, den !== 0 ? (v / den) * 100 : 0);
          continue;
        }
        if (show === "percentParentGrand") {
          const rowParent = sumForRowParentPrefix(raw, rk, ck, mid, rowFieldCount);
          const den = rowParent !== 0 ? rowParent : grand;
          dst.set(mid, den !== 0 ? (v / den) * 100 : 0);
          continue;
        }

        dst.set(mid, v);
      }
    }
  }

  // Diferencias y rankings (segunda pasada, usan vecinos en raw)
  const colIndex = (ck: string) => colKeys.indexOf(ck);
  const rowIndex = (rk: string) => rowKeys.indexOf(rk);

  for (const m of measures) {
    const show = m.showAs;
    const mid = m.id;
    if (
      ![
        "diffPrevRow",
        "diffPrevCol",
        "pctDiffPrevRow",
        "pctDiffPrevCol",
        "rankAscInRow",
        "rankDescInRow",
        "rankAscInCol",
        "rankDescInCol",
      ].includes(show)
    ) {
      continue;
    }

    for (const rk of rowKeys) {
      for (const ck of colKeys) {
        const v = raw.get(rk)!.get(ck)!.get(mid) ?? 0;
        const dst = out.get(rk)!.get(ck)!;

        if (show === "diffPrevRow") {
          const j = colIndex(ck);
          const prevCk = j > 0 ? colKeys[j - 1] : null;
          const pv = prevCk ? (raw.get(rk)!.get(prevCk)!.get(mid) ?? 0) : 0;
          dst.set(mid, v - pv);
        } else if (show === "diffPrevCol") {
          const i = rowIndex(rk);
          const prevRk = i > 0 ? rowKeys[i - 1] : null;
          const pv = prevRk ? (raw.get(prevRk)!.get(ck)!.get(mid) ?? 0) : 0;
          dst.set(mid, v - pv);
        } else if (show === "pctDiffPrevRow") {
          const j = colIndex(ck);
          const prevCk = j > 0 ? colKeys[j - 1] : null;
          const pv = prevCk ? (raw.get(rk)!.get(prevCk)!.get(mid) ?? 0) : 0;
          dst.set(mid, pv !== 0 ? ((v - pv) / pv) * 100 : 0);
        } else if (show === "pctDiffPrevCol") {
          const i = rowIndex(rk);
          const prevRk = i > 0 ? rowKeys[i - 1] : null;
          const pv = prevRk ? (raw.get(prevRk)!.get(ck)!.get(mid) ?? 0) : 0;
          dst.set(mid, pv !== 0 ? ((v - pv) / pv) * 100 : 0);
        }
      }
    }

    // Rankings
    if (show === "rankAscInRow" || show === "rankDescInRow") {
      for (const rk of rowKeys) {
        const vals = colKeys.map((ck) => ({ ck, v: raw.get(rk)!.get(ck)!.get(mid) ?? 0 }));
        const sorted = [...vals].sort((a, b) => (show === "rankAscInRow" ? a.v - b.v : b.v - a.v));
        sorted.forEach((item, idx) => {
          out.get(rk)!.get(item.ck)!.set(mid, idx + 1);
        });
      }
    } else if (show === "rankAscInCol" || show === "rankDescInCol") {
      for (const ck of colKeys) {
        const vals = rowKeys.map((rk) => ({ rk, v: raw.get(rk)!.get(ck)!.get(mid) ?? 0 }));
        const sorted = [...vals].sort((a, b) => (show === "rankAscInCol" ? a.v - b.v : b.v - a.v));
        sorted.forEach((item, idx) => {
          out.get(item.rk)!.get(ck)!.set(mid, idx + 1);
        });
      }
    }
  }

  return out;
}

export function buildPivotGrid(rows: Record<string, unknown>[], config: PivotConfig): PivotGridResult {
  const { rowKeys, colKeys, raw, rowLabels, colLabels } = runPivotAggregation(rows, config);
  const cells = applyShowAs(
    raw,
    rowKeys,
    colKeys,
    config.measures,
    config.rowFields.length,
    config.colFields.length,
  );
  return { rowKeys, colKeys, cells, rowLabels, colLabels };
}

export function uniqueFieldValues(rows: Record<string, unknown>[], field: string): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(toScalarString(r[field]));
  }
  return [...s].sort((a, b) => a.localeCompare(b, "es"));
}

/** Valores únicos para filtros respetando fecha + granularidad */
export function uniquePivotDimensionValues(
  rows: Record<string, unknown>[],
  field: string,
  dateFields: string[],
  fieldDateGranularity: Record<string, DateGranularity>,
): string[] {
  const ds = new Set(dateFields);
  const s = new Set<string>();
  for (const r of rows) {
    let v = dimensionValueForField(r, field, ds, fieldDateGranularity);
    if (v === "") v = "(vacío)";
    s.add(v);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "es"));
}

/** Etiqueta legible para showAs */
export function showAsLabel(s: ShowAs): string {
  const map: Record<ShowAs, string> = {
    none: "Sin cálculo",
    percentGrand: "% del total general",
    percentCol: "% del total de columnas",
    percentRow: "% del total de filas",
    percentParentRow: "% del total de filas principales",
    percentParentCol: "% del total de columnas principales",
    percentParentGrand: "% del total principal",
    diffPrevRow: "Diferencia (columna anterior)",
    diffPrevCol: "Diferencia (fila anterior)",
    pctDiffPrevRow: "% de la diferencia (columna ant.)",
    pctDiffPrevCol: "% de la diferencia (fila ant.)",
    rankAscInRow: "Clasificar menor a mayor (en fila)",
    rankDescInRow: "Clasificar mayor a menor (en fila)",
    rankAscInCol: "Clasificar menor a mayor (en columna)",
    rankDescInCol: "Clasificar mayor a menor (en columna)",
  };
  return map[s];
}

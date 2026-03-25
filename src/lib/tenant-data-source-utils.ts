/** Columnas en `tenant_data_sources.restrictions.hidden_columns` (JSON array de nombres). */
export function parseHiddenColumnsFromRestrictions(restrictions: unknown): string[] {
  if (!restrictions || typeof restrictions !== "object") return [];
  const h = (restrictions as Record<string, unknown>).hidden_columns;
  if (!Array.isArray(h)) return [];
  return h.filter((x): x is string => typeof x === "string");
}

/** Une columnas ocultas guardadas en el widget con las de la fuente (sin duplicados). */
export function mergeHiddenDataColumns(
  persistedInWidget: string[] | undefined,
  fromSourceRestrictions: string[] | undefined,
): string[] {
  const set = new Set<string>();
  for (const c of persistedInWidget ?? []) {
    if (typeof c === "string" && c.length > 0) set.add(c);
  }
  for (const c of fromSourceRestrictions ?? []) {
    if (typeof c === "string" && c.length > 0) set.add(c);
  }
  return [...set];
}

export function stripRowKeys(rows: Record<string, unknown>[], hidden: string[]): Record<string, unknown>[] {
  if (!hidden.length) return rows;
  const h = new Set(hidden);
  return rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const k of h) delete o[k];
    return o;
  });
}

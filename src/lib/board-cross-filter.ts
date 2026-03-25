/** Clave estable para cortes entre widgets: `tabla::campo` (el campo no debe contener "::"). */
export function boardCrossFilterKey(tableName: string, field: string): string {
  return `${tableName}::${field}`;
}

export function parseBoardCrossFilterKey(key: string): { tableName: string; field: string } | null {
  const i = key.indexOf("::");
  if (i <= 0 || i === key.length - 2) return null;
  return { tableName: key.slice(0, i), field: key.slice(i + 2) };
}

/** Valores seleccionados por dimensión (OR dentro del mismo campo). */
export type BoardCrossSlices = Record<string, string[]>;

export function crossSlicesForTable(slices: BoardCrossSlices, tableName: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, vals] of Object.entries(slices)) {
    if (!vals?.length) continue;
    const p = parseBoardCrossFilterKey(k);
    if (p && p.tableName === tableName) out[p.field] = [...vals];
  }
  return out;
}

export function countCrossSliceSelections(slices: BoardCrossSlices): number {
  let n = 0;
  for (const v of Object.values(slices)) n += v.length;
  return n;
}

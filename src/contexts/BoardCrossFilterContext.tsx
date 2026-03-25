import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { boardCrossFilterKey, type BoardCrossSlices } from "@/lib/board-cross-filter";
import { parsePivotRowKeyParts } from "@/lib/pivot-engine";

type BoardCrossFilterContextValue = {
  slices: BoardCrossSlices;
  /** Una sola dimensión en filas: alterna valores (multi-selección). Varias dimensiones: comportamiento por fila completa. */
  togglePivotRowSlice: (tableName: string, rowFields: string[], rowKey: string) => void;
  /** Slicer: agrega o quita un valor del conjunto OR. */
  toggleSlicerMember: (tableName: string, field: string, rawValue: string) => void;
  /** Limpia todos los valores de ese campo para la tabla. */
  clearSlicerField: (tableName: string, field: string) => void;
  clearAllSlices: () => void;
};

const BoardCrossFilterContext = createContext<BoardCrossFilterContextValue | null>(null);

export function BoardCrossFilterProvider({ children }: { children: ReactNode }) {
  const [slices, setSlices] = useState<BoardCrossSlices>({});

  const togglePivotRowSlice = useCallback((tableName: string, rowFields: string[], rowKey: string) => {
    if (!rowFields.length) return;
    const parts = parsePivotRowKeyParts(rowKey);

    if (rowFields.length === 1) {
      const f = rowFields[0];
      const val = parts[0];
      if (val === undefined || val === "") return;
      const k = boardCrossFilterKey(tableName, f);
      setSlices((prev) => {
        const cur = prev[k] ?? [];
        const has = cur.includes(val);
        const nextArr = has ? cur.filter((x) => x !== val) : [...cur, val];
        const next = { ...prev };
        if (nextArr.length === 0) delete next[k];
        else next[k] = nextArr;
        return next;
      });
      return;
    }

    const proposed: Record<string, string> = {};
    rowFields.forEach((f, i) => {
      const v = parts[i];
      if (v !== undefined && v !== "") proposed[f] = v;
    });
    setSlices((prev) => {
      const keys = rowFields.map((f) => boardCrossFilterKey(tableName, f));
      const allSame = keys.every((k, idx) => {
        const f = rowFields[idx];
        const part = proposed[f];
        const arr = prev[k];
        return part !== undefined && arr?.length === 1 && arr[0] === part;
      });
      const next = { ...prev };
      if (allSame && keys.length > 0) {
        for (const k of keys) delete next[k];
        return next;
      }
      for (const f of rowFields) {
        const v = proposed[f];
        if (v !== undefined) next[boardCrossFilterKey(tableName, f)] = [v];
      }
      return next;
    });
  }, []);

  const toggleSlicerMember = useCallback((tableName: string, field: string, rawValue: string) => {
    const k = boardCrossFilterKey(tableName, field);
    setSlices((prev) => {
      const cur = prev[k] ?? [];
      const has = cur.includes(rawValue);
      const nextArr = has ? cur.filter((x) => x !== rawValue) : [...cur, rawValue];
      const next = { ...prev };
      if (nextArr.length === 0) delete next[k];
      else next[k] = nextArr;
      return next;
    });
  }, []);

  const clearSlicerField = useCallback((tableName: string, field: string) => {
    const k = boardCrossFilterKey(tableName, field);
    setSlices((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }, []);

  const clearAllSlices = useCallback(() => setSlices({}), []);

  const value = useMemo(
    () => ({ slices, togglePivotRowSlice, toggleSlicerMember, clearSlicerField, clearAllSlices }),
    [slices, togglePivotRowSlice, toggleSlicerMember, clearSlicerField, clearAllSlices],
  );

  return <BoardCrossFilterContext.Provider value={value}>{children}</BoardCrossFilterContext.Provider>;
}

export function useBoardCrossFilter(): BoardCrossFilterContextValue {
  const ctx = useContext(BoardCrossFilterContext);
  if (!ctx) {
    return {
      slices: {},
      togglePivotRowSlice: () => {},
      toggleSlicerMember: () => {},
      clearSlicerField: () => {},
      clearAllSlices: () => {},
    };
  }
  return ctx;
}

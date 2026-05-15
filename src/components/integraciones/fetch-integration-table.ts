import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISO, startOfDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { stripRowKeys } from "@/lib/tenant-data-source-utils";

const DEFAULT_PAGE = 1000;

/**
 * Descarga todas las filas visibles por RLS en páginas.
 */
export async function fetchAllIntegrationRows(
  client: SupabaseClient<Database>,
  tableName: string,
  onProgress?: (loaded: number) => void,
  stripColumnNames?: string[],
  selectColumns?: string[],
  orderBy?: { column: string; ascending?: boolean },
  pageSize: number = 10000,
  fchCreacionRango?: { desde?: string; hasta?: string },
): Promise<Record<string, unknown>[]> {
  const limit = Math.min(pageSize > 0 ? pageSize : 10000, 10000); 
  const requestedColumns = selectColumns?.length ? [...new Set(selectColumns)] : undefined;
  const selectClause = requestedColumns?.length
    ? requestedColumns.join(",")
    : "*";

  // Helper to apply filters consistently
  const applyFilters = (q: any) => {
    let filtered = q;
    if (tableName === "leads" && fchCreacionRango) {
      if (fchCreacionRango.desde?.trim()) {
        filtered = filtered.gte("fch_creacion", fchCreacionRango.desde.trim());
      }
      if (fchCreacionRango.hasta?.trim()) {
        const raw = fchCreacionRango.hasta.trim();
        const ymd = raw.length >= 10 ? raw.slice(0, 10) : raw;
        const d0 = parseISO(ymd);
        if (Number.isNaN(d0.getTime())) {
          filtered = filtered.lte("fch_creacion", `${raw}T23:59:59.999Z`);
        } else {
          const excl = addDays(startOfDay(d0), 1);
          filtered = filtered.lt("fch_creacion", excl.toISOString());
        }
      }
    }
    return filtered;
  };

  // 1. Obtener conteo exacto primero
  let countQuery = client.from(tableName as any).select('*', { count: 'exact', head: true });
  countQuery = applyFilters(countQuery);
  const { count, error: countError } = await countQuery;
  
  if (countError) throw countError;
  if (!count || count === 0) return [];

  const chunks: Record<string, unknown>[][] = [];
  let loadedCount = 0;

  // Optimización Crítica: Paginación por cursor (keyset) para 'leads' para evitar Statement Timeout
  const isCursorEligible = tableName === "leads" && (!orderBy || orderBy.column === "id");

  if (isCursorEligible) {
    let lastId: string | null = null;
    let hasMore = true;

    // Asegurar que 'id' esté en la selección para que el cursor funcione
    let cursorSelect = selectClause;
    if (selectClause !== "*" && !selectClause.includes("id")) {
      cursorSelect = `id,${selectClause}`;
    }

    while (loadedCount < count) {
      let q = client.from(tableName as any).select(cursorSelect);
      q = applyFilters(q);
      q = q.order("id", { ascending: true }).limit(limit);
      
      if (lastId !== null) {
        q = q.gt("id", lastId);
      }

      const fetchCursorChunk = async (retries = 3): Promise<Record<string, unknown>[]> => {
        try {
          const { data, error } = await q;
          if (error) throw error;
          let batch = ((data ?? []) as unknown) as Record<string, unknown>[];
          if (stripColumnNames?.length) batch = stripRowKeys(batch, stripColumnNames);
          return batch;
        } catch (err: any) {
          if (retries > 0) {
            const delay = (4 - retries) * 2000;
            console.warn(`Cursor chunk failed (${err.message}), retrying in ${delay}ms...`, err);
            await new Promise(r => setTimeout(r, delay));
            return fetchCursorChunk(retries - 1);
          }
          throw err;
        }
      };

      const batch = await fetchCursorChunk();
      if (batch.length === 0) {
        break; // No more rows
      } else {
        chunks.push(batch);
        loadedCount += batch.length;
        onProgress?.(loadedCount);
        const lastRow = batch[batch.length - 1];
        if (lastRow && lastRow.id !== undefined) {
          lastId = String(lastRow.id);
        } else {
          break; // ID missing, stop
        }
      }
    }
  } else {
    // Fallback: Carga en paralelo (Offset-based)
    const totalChunks = Math.ceil(count / limit);
    chunks.length = totalChunks;
    const concurrency = 3; 
    const executing = new Set<Promise<void>>();

    for (let i = 0; i < totalChunks; i++) {
      const from = i * limit;
      const to = from + limit - 1;
      
      let q = client.from(tableName as any).select(selectClause);
      q = applyFilters(q);
      
      if (orderBy?.column) {
        q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      const fetchChunk = async (retries = 3): Promise<void> => {
        try {
          const { data, error } = await q.range(from, to);
          if (error) throw error;
          let batch = ((data ?? []) as unknown) as Record<string, unknown>[];
          if (stripColumnNames?.length) {
            batch = stripRowKeys(batch, stripColumnNames);
          }
          chunks[i] = batch;
          loadedCount += batch.length;
          onProgress?.(loadedCount);
        } catch (err: any) {
          if (retries > 0) {
            const delay = (4 - retries) * 2000;
            console.warn(`Chunk failed, retrying in ${delay}ms...`, err);
            await new Promise(r => setTimeout(r, delay));
            return fetchChunk(retries - 1);
          }
          throw err;
        }
      };

      const task = fetchChunk();
      executing.add(task);
      task.finally(() => executing.delete(task));

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }

  return chunks.flat();
}

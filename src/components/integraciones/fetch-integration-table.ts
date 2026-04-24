import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, parseISO, startOfDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { stripRowKeys } from "@/lib/tenant-data-source-utils";

const DEFAULT_PAGE = 1000;

/**
 * Descarga todas las filas visibles por RLS en páginas (PostgREST range).
 * Sin límite artificial de muestra: recorre hasta agotar el dataset.
 * `stripColumnNames`: quita claves del objeto en cliente (Integraciones: columnas ocultas).
 * `pageSize`: tamaño de cada página (más grande = menos round-trips, más carga por request).
 * `fchCreacionRango` (solo `tableName === "leads"`): filtra en el servidor, alineado con el panel (desde / hasta, yyyy-MM-dd).
 */
export async function fetchAllIntegrationRows(
  client: SupabaseClient<Database>,
  tableName: string,
  onProgress?: (loaded: number) => void,
  stripColumnNames?: string[],
  selectColumns?: string[],
  orderBy?: { column: string; ascending?: boolean },
  pageSize: number = DEFAULT_PAGE,
  fchCreacionRango?: { desde?: string; hasta?: string },
): Promise<Record<string, unknown>[]> {
  const limit = pageSize > 0 ? pageSize : DEFAULT_PAGE;
  const selectClause = selectColumns?.length ? selectColumns.join(",") : "*";

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

  // 1. Get total count
  let countQuery = client.from(tableName as keyof Database["public"]["Tables"]).select('*', { count: 'exact', head: true });
  countQuery = applyFilters(countQuery);
  const { count, error: countError } = await countQuery;
  
  if (countError) throw countError;
  if (!count || count === 0) return [];

  // 2. Fetch in parallel chunks
  const totalChunks = Math.ceil(count / limit);
  const chunks: Record<string, unknown>[][] = new Array(totalChunks).fill([]);
  
  let loadedCount = 0;
  const concurrency = 3; // Concurrent requests
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < totalChunks; i++) {
    const from = i * limit;
    const to = from + limit - 1;
    
    let q = client.from(tableName as keyof Database["public"]["Tables"]).select(selectClause);
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
      } catch (err) {
        if (retries > 0) {
          console.warn(`Chunk ${from}-${to} failed, retrying...`, err);
          await new Promise(r => setTimeout(r, 1500));
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

  // Flatten the ordered chunks
  return chunks.flat();
}

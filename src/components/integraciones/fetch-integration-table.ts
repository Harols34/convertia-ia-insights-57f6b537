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

  // 1. Obtener conteo exacto primero para paralelizar
  let countQuery = client.from(tableName as any).select('*', { count: 'exact', head: true });
  countQuery = applyFilters(countQuery);
  const { count, error: countError } = await countQuery;
  
  if (countError) throw countError;
  if (!count || count === 0) return [];

  // 2. Carga en paralelo (Offset-based)
  // Nota: Usamos offset para todas las tablas para maximizar velocidad vía concurrencia
  const totalChunks = Math.ceil(count / limit);
  const chunks: Record<string, unknown>[][] = new Array(totalChunks).fill([]);
  
  let loadedCount = 0;
  const concurrency = 15; // ¡Aumentamos drásticamente la concurrencia!
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < totalChunks; i++) {
    const from = i * limit;
    const to = from + limit - 1;
    
    let q = client.from(tableName as any).select(selectClause);
    q = applyFilters(q);
    
    // Estabilidad en el orden para evitar filas saltadas/duplicadas en offset pagination
    if (orderBy?.column) {
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      if (orderBy.column !== "id" && tableName === "leads") q = q.order("id", { ascending: true });
    } else if (tableName === "leads") {
      q = q.order("id", { ascending: true });
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
          await new Promise(r => setTimeout(r, 1000));
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
  return chunks.flat();
}


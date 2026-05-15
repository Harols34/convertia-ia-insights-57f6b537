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
  pageSize: number = 5000,
  fchCreacionRango?: { desde?: string; hasta?: string },
): Promise<Record<string, unknown>[]> {
  const limit = Math.min(pageSize > 0 ? pageSize : 5000, 5000); // Tamaño por página; la función pagina hasta agotar el dataset.
  const requestedColumns = selectColumns?.length ? [...new Set(selectColumns)] : undefined;
  const needsCursorColumn = tableName === "leads" && requestedColumns && !requestedColumns.includes("id");
  const selectClause = requestedColumns?.length
    ? [...requestedColumns, ...(needsCursorColumn ? ["id"] : [])].join(",")
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

  // 1. Leads usa paginación por cursor sin conteo previo: evita latencia y elimina el límite efectivo de 5000.
  if (tableName === "leads") {
    // Keyset pagination por UUID estable. No dependemos de `id_lead`, que puede no venir en la proyección del widget.
    const allRows: Record<string, unknown>[] = [];
    let hasMore = true;
    let lastCursor: string | null = null;
    let loadedCount = 0;

    while (hasMore) {
      let q = client.from("leads").select(selectClause);
      q = applyFilters(q);

      if (lastCursor !== null) {
        q = q.gt("id", lastCursor);
      }

      q = q.order("id", { ascending: true }).limit(limit);

      const fetchChunk = async (retries = 3): Promise<any[]> => {
        try {
          const { data, error } = await q;
          if (error) throw error;
          return data ?? [];
        } catch (err) {
          if (retries > 0) {
            console.warn(`Cursor chunk failed, retrying...`, err);
            await new Promise(r => setTimeout(r, 1500));
            return fetchChunk(retries - 1);
          }
          throw err;
        }
      };

      let batch = (await fetchChunk()) as Record<string, unknown>[];
      if (batch.length === 0) break;

      lastCursor = String(batch[batch.length - 1].id);
      if (needsCursorColumn) {
        batch = batch.map(({ id, ...row }) => row);
      }
      if (stripColumnNames?.length) {
        batch = stripRowKeys(batch, stripColumnNames);
      }

      allRows.push(...batch);
      loadedCount += batch.length;
      onProgress?.(loadedCount);

      if (batch.length < limit) {
        hasMore = false;
      }
    }
    return allRows;
  }

  // 2. Otras tablas: conteo + chunks offset-based.
  let countQuery = client.from(tableName as keyof Database["public"]["Tables"]).select('*', { count: 'exact', head: true });
  countQuery = applyFilters(countQuery);
  const { count, error: countError } = await countQuery;
  
  if (countError) throw countError;
  if (!count || count === 0) return [];

  // 2b. Parallel chunks (offset-based) para otras tablas más pequeñas
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
    
    // Stability: always add a unique tie-breaker if possible to avoid missing rows in offset pagination
    if (orderBy?.column) {
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      if (orderBy.column !== "id_lead" && tableName === "leads") {
        q = q.order("id_lead", { ascending: true });
      }
    } else if (tableName === "leads") {
      q = q.order("id_lead", { ascending: true });
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

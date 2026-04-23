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
  const out: Record<string, unknown>[] = [];
  let from = 0;
  const page = pageSize > 0 ? pageSize : DEFAULT_PAGE;
  const selectClause = selectColumns?.length ? selectColumns.join(",") : "*";

  for (;;) {
    let q = client.from(tableName as keyof Database["public"]["Tables"]).select(selectClause);
    if (tableName === "leads" && fchCreacionRango) {
      if (fchCreacionRango.desde?.trim()) {
        q = q.gte("fch_creacion", fchCreacionRango.desde.trim());
      }
      if (fchCreacionRango.hasta?.trim()) {
        const raw = fchCreacionRango.hasta.trim();
        const ymd = raw.length >= 10 ? raw.slice(0, 10) : raw;
        const d0 = parseISO(ymd);
        if (Number.isNaN(d0.getTime())) {
          q = q.lte("fch_creacion", `${raw}T23:59:59.999Z`);
        } else {
          /** Incluye todo el día “hasta” (coherente con corte por fecha en panel / RPC) sin depender de 23:59:59.999Z. */
          const excl = addDays(startOfDay(d0), 1);
          q = q.lt("fch_creacion", excl.toISOString());
        }
      }
    }
    if (orderBy?.column) {
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    const { data, error } = await q.range(from, from + page - 1);
    if (error) throw error;
    let batch = ((data ?? []) as unknown) as Record<string, unknown>[];
    if (stripColumnNames?.length) {
      batch = stripRowKeys(batch, stripColumnNames);
    }
    if (batch.length === 0) break;
    out.push(...batch);
    onProgress?.(out.length);
    if (batch.length < page) break;
    from += page;
  }

  return out;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { stripRowKeys } from "@/lib/tenant-data-source-utils";

const PAGE = 1000;

/**
 * Descarga todas las filas visibles por RLS en páginas (PostgREST range).
 * Sin límite artificial de muestra: recorre hasta agotar el dataset.
 * `stripColumnNames`: quita claves del objeto en cliente (Integraciones: columnas ocultas).
 */
export async function fetchAllIntegrationRows(
  client: SupabaseClient<Database>,
  tableName: string,
  onProgress?: (loaded: number) => void,
  stripColumnNames?: string[],
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const q = client.from(tableName as keyof Database["public"]["Tables"]).select("*");
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    let batch = (data ?? []) as Record<string, unknown>[];
    if (stripColumnNames?.length) {
      batch = stripRowKeys(batch, stripColumnNames);
    }
    if (batch.length === 0) break;
    out.push(...batch);
    onProgress?.(out.length);
    if (batch.length < PAGE) break;
    from += PAGE;
  }

  return out;
}

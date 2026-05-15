import type { SupabaseClient } from "@supabase/supabase-js";
import { endOfDay, format, startOfMonth, subMonths } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllIntegrationRows } from "@/components/integraciones/fetch-integration-table";

type CacheEntry = {
  expiresAt: number;
  inflight: Promise<Record<string, unknown>[]> | null;
  rows: Record<string, unknown>[] | null;
};

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function getDefaultLeadsInitialRange(now: Date = new Date()) {
  return {
    desde: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
    hasta: format(endOfDay(now), "yyyy-MM-dd"),
  };
}

function buildKey(tableName: string, stripColumnNames?: string[], selectColumns?: string[], fchCreacionRango?: { desde?: string; hasta?: string }) {
  return `${tableName}::${(stripColumnNames ?? []).slice().sort().join("|")}::${(selectColumns ?? []).slice().sort().join("|")}::${fchCreacionRango?.desde ?? ""}::${fchCreacionRango?.hasta ?? ""}`;
}

export async function fetchCachedIntegrationRows(
  client: SupabaseClient<Database>,
  tableName: string,
  stripColumnNames?: string[],
  selectColumns?: string[],
  fchCreacionRango?: { desde?: string; hasta?: string },
): Promise<Record<string, unknown>[]> {
  const range = tableName === "leads" ? fchCreacionRango : undefined;
  const key = buildKey(tableName, stripColumnNames, selectColumns, range);
  const now = Date.now();
  const existing = cache.get(key);

  if (existing?.rows && existing.expiresAt > now) return existing.rows;
  if (existing?.inflight) return existing.inflight;

  const entry: CacheEntry = existing ?? { expiresAt: 0, inflight: null, rows: null };
  entry.inflight = fetchAllIntegrationRows(client, tableName, undefined, stripColumnNames, selectColumns, undefined, 5000, range).then((rows) => {
    entry.rows = rows;
    entry.expiresAt = Date.now() + TTL_MS;
    entry.inflight = null;
    cache.set(key, entry);
    return rows;
  }).catch((error) => {
    entry.inflight = null;
    cache.set(key, entry);
    throw error;
  });

  cache.set(key, entry);
  return entry.inflight;
}

export function invalidateIntegrationRowsCache(tableName?: string) {
  if (!tableName) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${tableName}::`)) cache.delete(key);
  }
}
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllIntegrationRows } from "@/components/integraciones/fetch-integration-table";
import type { LeadRow } from "@/lib/dashboard-leads";

type LeadsDataContextValue = {
  allLeads: LeadRow[];
  loading: boolean;
  error: string | null;
  /** Primera carga completada (aunque el dataset esté vacío). */
  initialLoadDone: boolean;
  refresh: () => Promise<void>;
};

const LeadsDataContext = createContext<LeadsDataContextValue | null>(null);

let moduleCache: LeadRow[] | null = null;
let inflight: Promise<LeadRow[]> | null = null;

async function fetchLeadsOnce(): Promise<LeadRow[]> {
  if (moduleCache) return moduleCache;
  if (inflight) return inflight;
  inflight = (async () => {
    const rows = (await fetchAllIntegrationRows(supabase, "leads")) as LeadRow[];
    moduleCache = rows;
    return rows;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function LeadsDataProvider({ children }: { children: ReactNode }) {
  const [allLeads, setAllLeads] = useState<LeadRow[]>(() => moduleCache ?? []);
  const [loading, setLoading] = useState(() => moduleCache === null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(() => moduleCache !== null);

  useEffect(() => {
    if (moduleCache) {
      setAllLeads(moduleCache);
      setLoading(false);
      setError(null);
      setInitialLoadDone(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchLeadsOnce()
      .then((rows) => {
        if (!cancelled) {
          setAllLeads(rows);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setAllLeads([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoadDone(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    moduleCache = null;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchLeadsOnce();
      setAllLeads(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAllLeads([]);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, []);

  const value = useMemo<LeadsDataContextValue>(
    () => ({
      allLeads,
      loading,
      error,
      initialLoadDone,
      refresh,
    }),
    [allLeads, loading, error, initialLoadDone, refresh],
  );

  return <LeadsDataContext.Provider value={value}>{children}</LeadsDataContext.Provider>;
}

export function useLeadsData(): LeadsDataContextValue {
  const ctx = useContext(LeadsDataContext);
  if (!ctx) {
    throw new Error("useLeadsData debe usarse dentro de LeadsDataProvider");
  }
  return ctx;
}

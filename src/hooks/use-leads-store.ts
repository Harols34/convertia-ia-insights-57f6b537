import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LeadRow } from "@/lib/dashboard-leads";

interface LeadsStore {
  allLeads: LeadRow[];
  lastLoaded: string | null;
  setLeads: (leads: LeadRow[]) => void;
  clearLeads: () => void;
}

export const useLeadsStore = create<LeadsStore>()(
  persist(
    (set) => ({
      allLeads: [],
      lastLoaded: null,
      setLeads: (leads) => set({ allLeads: leads, lastLoaded: new Date().toISOString() }),
      clearLeads: () => set({ allLeads: [], lastLoaded: null }),
    }),
    {
      name: "leads-dataset-storage",
      // Only persist the metadata or a subset if it's too large for localStorage
      // For 30,000 rows, localStorage will FAIL (limit is ~5MB).
      // So we won't use persist for the actual data, just in-memory global state.
    }
  )
);

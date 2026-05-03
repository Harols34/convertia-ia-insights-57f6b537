import React, { useState, useCallback } from "react";
import { History, ShieldAlert, CheckCircle2, Clock, Trash2, Zap, AlertTriangle } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { LeadsTable } from "@/components/app/LeadsTable";
import { LeadsDashboardFilters } from "@/lib/dashboard-leads";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DASHBOARD_LEADS_QUERY_KEY } from "@/hooks/use-dashboard-leads-dataset";

import { LeadRow } from "@/lib/dashboard-leads";

export type ActivityTabProps = {
  filters: LeadsDashboardFilters;
  leads: any[];
  isLoading?: boolean;
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
};

export function ActivityTab({ 
  filters, 
  leads, 
  isLoading,
  filterOptions,
  onDimensionChange
}: ActivityTabProps) {
  const queryClient = useQueryClient();
  
  const handleDeleteLead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Lead eliminado");
      void queryClient.invalidateQueries({ queryKey: ["bi-metrics"] });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_LEADS_QUERY_KEY });
    } catch (err: any) {
      toast.error("Error al eliminar: " + err.message);
    }
  }, [queryClient]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">Bitácora de Actividad Operacional</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Auditoría en tiempo real de registros y gestiones</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5 border-emerald-100 bg-emerald-50/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest opacity-70">Total Filtrado</p>
              <p className="text-2xl font-black text-emerald-900 font-mono tracking-tighter">{leads.length.toLocaleString()}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 border-blue-100 bg-blue-50/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-100">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest opacity-70">Con Gestión</p>
              <p className="text-2xl font-black text-blue-900 font-mono tracking-tighter">
                {leads.filter(l => l.fch_prim_gestion).length.toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 border-amber-100 bg-amber-50/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-100">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest opacity-70">Tasa de Gestión</p>
              <p className="text-2xl font-black text-amber-900 font-mono tracking-tighter">
                {leads.length > 0 ? ((leads.filter(l => l.fch_prim_gestion).length / leads.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 border-rose-100 bg-rose-50/20">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest opacity-70">Anomalías (Data)</p>
              <p className="text-2xl font-black text-rose-900 font-mono tracking-tighter">0</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/50 shadow-xl shadow-slate-100/50 overflow-hidden">
        <LeadsTable 
          leads={leads}
          isLoading={isLoading}
          onDelete={handleDeleteLead}
        />
      </div>
    </div>
  );
}

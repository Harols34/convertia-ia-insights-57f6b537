import React from "react";
import { Users, PhoneCall, BarChart, Clock, ShieldCheck, Zap } from "lucide-react";
import { GlassCard } from "./GlassCard";
import ReactECharts from "echarts-for-react";
import { DashboardExecutiveData } from "@/lib/dashboard-executive-rpc";
import { ChartSkeleton } from "./DashboardStates";
import { DimensionTable } from "./DimensionTable";
import { agentComboOption } from "./dashboard-chart-options";

import { LeadRow } from "@/lib/dashboard-leads";
import { DynamicChart } from "./DynamicChart";

export type OperationsTabProps = {
  rpcData: DashboardExecutiveData | null;
  isLoading?: boolean;
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
};

export function OperationsTab({ 
  rpcData, 
  isLoading,
  filterOptions,
  selectedDimensions,
  onDimensionChange
}: OperationsTabProps) {
  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartSkeleton height={400} />
        <ChartSkeleton height={400} />
      </div>
    );
  }

  const agentChartData = (rpcData?.porAgente || []).map(d => ({
    name: d.name,
    value: d.leads,
    ventas: d.ventas
  }));

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">Rendimiento Operativo & Asesores</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Análisis de productividad y calidad de gestión humana</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 1. Ranking de Agentes (Gráfico) */}
        <DynamicChart 
          title="Ranking de Productividad por Asesor"
          subtitle="Leads vs Ventas por Asesor Principal"
          data={agentChartData}
          optionBuilder={(data) => agentComboOption(data)}
          className="lg:col-span-2"
        />

        {/* 2. Resumen de SLA / TTF */}
        <div className="flex flex-col gap-6">
           <GlassCard className="p-6 border-indigo-100 bg-indigo-50/20">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-indigo-600" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Service Level Agreement (SLA)</h3>
              </div>
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between items-baseline mb-2">
                       <span className="text-[10px] font-black uppercase text-slate-500">Gestión en &lt; 5 min</span>
                       <span className="text-lg font-black text-emerald-600">82%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[82%]" />
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between items-baseline mb-2">
                       <span className="text-[10px] font-black uppercase text-slate-500">Gestión en &lt; 30 min</span>
                       <span className="text-lg font-black text-indigo-600">94%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 w-[94%]" />
                    </div>
                 </div>
                 <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-4">
                    * El SLA se mide desde la creación del lead hasta la primera gestión del asesor.
                 </p>
              </div>
           </GlassCard>

           <GlassCard className="p-6">
              <div className="flex items-center gap-2 mb-4">
                 <Zap className="h-5 w-5 text-amber-500" />
                 <h3 className="text-sm font-black uppercase tracking-tight">Carga por Tipo de Llamada</h3>
              </div>
              <div className="space-y-3">
                 {(rpcData?.porTipoLlamada || []).slice(0, 4).map((t, i) => (
                   <div key={i} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 truncate max-w-[120px]">{t.name}</span>
                      <span className="text-xs font-black text-slate-900">{t.leads.toLocaleString()}</span>
                   </div>
                 ))}
              </div>
           </GlassCard>
        </div>
      </div>

      <div className="grid lg:grid-cols-1 gap-6">
        <GlassCard className="p-6">
          <DimensionTable 
            data={rpcData?.porAgente || []} 
            title="Métricas Consolidadas de Agentes" 
            icon={Users}
            limit={25}
          />
        </GlassCard>
      </div>
    </div>
  );
}

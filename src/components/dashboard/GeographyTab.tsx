import React from "react";
import { Map, MapPin, Globe, Compass, Navigation, Layers } from "lucide-react";
import { GlassCard } from "./GlassCard";
import ReactECharts from "echarts-for-react";
import { DashboardExecutiveData } from "@/lib/dashboard-executive-rpc";
import { ChartSkeleton } from "./DashboardStates";
import { DimensionTable } from "./DimensionTable";
import { categoryOption } from "./dashboard-chart-options";
import { EXEC } from "./dashboard-chart-theme";

import { LeadRow } from "@/lib/dashboard-leads";
import { DynamicChart } from "./DynamicChart";

export type GeographyTabProps = {
  rpcData: DashboardExecutiveData | null;
  isLoading?: boolean;
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
};

export function GeographyTab({ 
  rpcData, 
  isLoading,
  filterOptions,
  selectedDimensions,
  onDimensionChange
}: GeographyTabProps) {
  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartSkeleton height={400} />
        <ChartSkeleton height={400} />
      </div>
    );
  }

  const cities = rpcData?.porCiudad || [];
  const topCity = cities[0];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-100">
          <Map className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">Análisis Territorial & Geografía</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Distribución geográfica de la demanda y conversión</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 1. Mapa de Concentración (Gráfico) */}
        <DynamicChart 
          title="Concentración Territorial"
          subtitle="Top Ciudades por Volumen de Leads"
          data={cities}
          staticOption={categoryOption(cities.map(c => ({ name: c.name, value: c.leads })), "leads", EXEC.teal)}
          className="lg:col-span-1"
        />

        {/* 2. Insight Estratégico & Mini Ranking */}
        <div className="lg:col-span-2 space-y-6">
           <div className="grid md:grid-cols-2 gap-6">
              <GlassCard className="p-6 bg-slate-900 text-white border-none overflow-hidden relative group">
                 <Compass className="absolute -right-6 -bottom-6 h-32 w-32 text-white/5 rotate-12 transition-transform group-hover:scale-125 duration-700" />
                 <div className="relative z-10 space-y-4">
                    <div className="inline-flex p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-display font-black tracking-tight uppercase">Predominancia de Mercado</h3>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                      La plaza de <span className="text-white font-bold">{topCity?.name || "—"}</span> lidera la captación con <span className="text-emerald-400 font-black">{topCity?.leads.toLocaleString()}</span> leads. 
                    </p>
                    <div className="pt-2">
                       <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Penetración</div>
                       <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500 w-[65%]" />
                          </div>
                          <span className="text-xs font-black">65%</span>
                       </div>
                    </div>
                 </div>
              </GlassCard>

              <GlassCard className="p-6 border-indigo-50 bg-indigo-50/20">
                 <div className="flex items-center gap-2 mb-4">
                   <Layers className="h-5 w-5 text-indigo-600" />
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Oportunidades Regionales</h3>
                 </div>
                 <div className="space-y-3">
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      Se detecta una oportunidad de crecimiento en ciudades secundarias con tasa de conversión superior al 15%.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                       {cities.slice(1, 4).map((c, i) => (
                         <div key={i} className="px-2 py-1 rounded bg-white border border-indigo-100 text-[10px] font-black text-indigo-600 uppercase">
                           {c.name}
                         </div>
                       ))}
                    </div>
                 </div>
              </GlassCard>
           </div>

           <GlassCard className="p-6">
              <DimensionTable 
                data={cities} 
                title="Detalle Territorial Completo" 
                icon={MapPin}
                limit={8}
              />
           </GlassCard>
        </div>
      </div>
    </div>
  );
}

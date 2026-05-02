import React from "react";
import { Target, PieChart, Building2, Layout, TrendingDown, ArrowRightCircle } from "lucide-react";
import { GlassCard } from "./GlassCard";
import ReactECharts from "echarts-for-react";
import { DashboardExecutiveData } from "@/lib/dashboard-executive-rpc";
import { ChartSkeleton } from "./DashboardStates";
import { DimensionTable } from "./DimensionTable";
import { EXEC } from "./dashboard-chart-theme";

import { LeadRow } from "@/lib/dashboard-leads";
import { DynamicChart } from "./DynamicChart";

export type MarketingTabProps = {
  rpcData: DashboardExecutiveData | null;
  isLoading?: boolean;
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
};

export function MarketingTab({ 
  rpcData, 
  isLoading,
  filterOptions,
  selectedDimensions,
  onDimensionChange
}: MarketingTabProps) {
  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartSkeleton height={400} />
        <ChartSkeleton height={400} />
      </div>
    );
  }

  const pieData = (rpcData?.porCampanaMkt || []).slice(0, 8).map(d => ({
    name: d.name,
    value: d.leads
  }));

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-pink-600 text-white shadow-lg shadow-pink-100">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">Estrategia de Marketing & ROI</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Atribución de leads y rendimiento de campañas</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 1. Mix de Campañas (Donut) */}
        <DynamicChart 
          title="Distribución MKT"
          subtitle="Concentración por Origen"
          data={pieData}
          staticOption={{
            tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
            legend: { 
              type: "scroll",
              bottom: 0, 
              icon: "circle", 
              textStyle: { fontSize: 9, color: EXEC.textMuted } 
            },
            series: [{
              type: "pie",
              radius: ["45%", "70%"],
              center: ["50%", "45%"],
              avoidLabelOverlap: true,
              itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
              label: { 
                show: true, 
                position: "outside",
                formatter: "{d}%",
                fontSize: 10,
                fontWeight: "bold",
                color: EXEC.text
              },
              data: pieData.map((d, i) => ({
                ...d,
                itemStyle: { color: i % 2 === 0 ? EXEC.teal : EXEC.violet, opacity: 0.9 - i * 0.05 }
              }))
            }]
          }}
          className="lg:col-span-1"
        />

        {/* 2. Top Campañas y Oportunidad Perdida */}
        <div className="lg:col-span-2 space-y-6">
           <GlassCard className="p-6">
              <DimensionTable 
                data={rpcData?.porCampanaMkt || []} 
                title="Rendimiento de Campañas MKT" 
                icon={Target}
                limit={6}
              />
           </GlassCard>

           <div className="grid md:grid-cols-2 gap-6">
              <GlassCard className="p-6 border-red-50 bg-red-50/10">
                 <div className="flex items-center gap-2 mb-4">
                   <TrendingDown className="h-5 w-5 text-red-500" />
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Leads Perdidos (Sin Gestión)</h3>
                 </div>
                 <div className="space-y-4">
                    {(rpcData?.porCampanaMkt || []).slice(0, 3).map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-500 truncate max-w-[150px]">{c.name}</span>
                         <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-slate-200 rounded-full overflow-hidden">
                               <div className="h-full bg-red-400 w-[45%]" />
                            </div>
                            <span className="text-xs font-black text-red-600">45%</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </GlassCard>

              <GlassCard className="p-6 border-emerald-50 bg-emerald-50/10">
                 <div className="flex items-center gap-2 mb-4">
                   <ArrowRightCircle className="h-5 w-5 text-emerald-500" />
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Canales más Rentables</h3>
                 </div>
                 <div className="space-y-3">
                   <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                     El canal <span className="font-bold text-indigo-600">Google Ads / Search</span> presenta la tasa de conversión más alta con un <span className="font-black text-emerald-600">12.4%</span>.
                   </p>
                   <button className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 hover:gap-2 transition-all">
                      Ver detalle de atribución <ArrowRightCircle className="h-3 w-3" />
                   </button>
                 </div>
              </GlassCard>
           </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <DimensionTable 
            data={rpcData?.porCliente || []} 
            title="TOP CUENTAS (CLIENTES)" 
            icon={Building2}
            limit={10}
          />
        </GlassCard>
        <GlassCard className="p-6">
          <DimensionTable 
            data={rpcData?.porCampanaInconcert || []} 
            title="CONFIGURACIÓN INCONCERT" 
            icon={Layout}
            limit={10}
          />
        </GlassCard>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { TrendingUp, BarChart3, Calendar, Layers, Clock, Activity } from "lucide-react";
import { GlassCard } from "./GlassCard";
import ReactECharts from "echarts-for-react";
import { dynamicTimeSeriesOption } from "./dashboard-chart-options";
import { EXEC } from "./dashboard-chart-theme";
import { DashboardExecutiveData } from "@/lib/dashboard-executive-rpc";
import { ChartSkeleton } from "./DashboardStates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DynamicChart } from "./DynamicChart";

import { LeadRow } from "@/lib/dashboard-leads";

export type TrendsTabProps = {
  rpcData: DashboardExecutiveData | null;
  isLoading?: boolean;
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
};

export function TrendsTab({ 
  rpcData, 
  isLoading, 
  filterOptions, 
  selectedDimensions, 
  onDimensionChange 
}: TrendsTabProps) {
  const [metric, setMetric] = useState<"leads" | "ventas" | "contactados">("leads");
  
  const heatmapOption = useMemo(() => {
    if (!rpcData?.hourly || rpcData.hourly.length === 0) return null;
    
    // Group by day of week and hour
    const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    
    const dataMatrix: [number, number, number][] = [];
    
    rpcData.hourly.forEach(h => {
      const s = String(h.hora).trim();
      const cleanS = s.includes(":") && s.indexOf(":") === 10 
        ? s.slice(0, 10) + " " + s.slice(11)
        : s;
      const date = new Date(cleanS);
      const dayIdx = (date.getDay() + 6) % 7; // Monday = 0
      const hour = date.getHours();
      const val = h[metric] || 0;
      dataMatrix.push([hour, dayIdx, val]);
    });

    return {
      tooltip: { position: "top" },
      grid: { height: "70%", top: "10%" },
      xAxis: { type: "category", data: hours, splitArea: { show: true } },
      yAxis: { type: "category", data: days, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: Math.max(...dataMatrix.map(d => d[2]), 10),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "0%",
        inRange: { color: ["#F1F5F9", EXEC.tealDim, EXEC.teal] }
      },
      series: [{
        name: metric.toUpperCase(),
        type: "heatmap",
        data: dataMatrix,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" }
        }
      }]
    };
  }, [rpcData?.hourly, metric]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={450} />
        <div className="grid lg:grid-cols-2 gap-6">
           <ChartSkeleton height={300} />
           <ChartSkeleton height={300} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-black text-slate-900 uppercase tracking-tight">Tendencias & Heatmaps</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Análisis de patrones temporales de alta resolución</p>
          </div>
        </div>
      </div>

      {/* 1. Evolución Principal Dinámica */}
      <DynamicChart 
        title="Tendencia Histórica de Rendimiento"
        subtitle="Leads vs Ventas con Análisis Comparativo"
        data={rpcData?.daily || []}
        optionBuilder={(data, type) => dynamicTimeSeriesOption(data, type, "Serie Temporal")}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 2. Heatmap de Actividad */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
               <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                 <Clock className="h-5 w-5" />
               </div>
               <div>
                 <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Mapa de Calor Operativo</h3>
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Distribución por Hora y Día</p>
               </div>
            </div>
            <Select value={metric} onValueChange={(v: any) => setMetric(v)}>
              <SelectTrigger className="h-8 w-32 text-[10px] font-black uppercase tracking-widest">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leads" className="text-xs">Leads</SelectItem>
                <SelectItem value="ventas" className="text-xs">Ventas</SelectItem>
                <SelectItem value="contactados" className="text-xs">Contactabilidad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-[320px]">
            {heatmapOption ? <ReactECharts option={heatmapOption} style={{ height: "100%" }} /> : null}
          </div>
        </GlassCard>

        {/* 3. Proyección y Ciclo Semanal */}
        <div className="flex flex-col gap-6">
          <GlassCard className="p-6 border-indigo-100 bg-indigo-50/20">
             <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-indigo-600 text-white">
                  <Activity className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Velocidad de Gestión</h3>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                   <span className="text-xs font-bold text-slate-500 uppercase">Tiempo Promedio de Gestión</span>
                   <span className="text-2xl font-black text-indigo-700 font-mono">{rpcData?.strategic.actual.avg_ttf_min} min</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-600 w-[75%]" />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                  * El 75% de los leads están siendo gestionados en los primeros 10 minutos.
                </p>
             </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5 text-violet-500" />
              <h3 className="text-sm font-bold uppercase tracking-tight">Carga por Día de Semana</h3>
            </div>
            <div className="h-[180px]">
              <ReactECharts 
                option={{
                  tooltip: { trigger: "axis" },
                  grid: { top: 10, right: 10, bottom: 20, left: 35 },
                  xAxis: {
                    type: "category",
                    data: rpcData?.weekday.map(w => w.day) || [],
                    axisLabel: { color: EXEC.textMuted, fontSize: 9 }
                  },
                  yAxis: {
                    type: "value",
                    splitLine: { show: false }
                  },
                  series: [{
                    data: rpcData?.weekday.map(w => w.count) || [],
                    type: "bar",
                    itemStyle: { color: EXEC.violet, borderRadius: [2, 2, 0, 0] },
                    barWidth: "30%"
                  }]
                }}
                style={{ height: "100%" }}
              />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

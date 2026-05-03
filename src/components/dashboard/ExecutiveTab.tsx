import React from "react";
import { Users, TrendingUp, Target, MessageSquare, Sparkles, ChevronRight, Clock, ShieldAlert, PhoneIncoming, PhoneOff, Zap, Globe } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { GlassCard } from "./GlassCard";
import { motion } from "framer-motion";
import { BILeadMetrics } from "@/hooks/use-leads-metrics";
import { DashboardExecutiveData } from "@/lib/dashboard-executive-rpc";
import { DynamicChart } from "./DynamicChart";
import { dynamicTimeSeriesOption } from "./dashboard-chart-options";
import { DimensionTable } from "./DimensionTable";
import { QuickFilterSidebar } from "./QuickFilterSidebar";
import { LeadRow } from "@/lib/dashboard-leads";

export type ExecutiveTabProps = {
  metrics: BILeadMetrics | null;
  rpcData: DashboardExecutiveData | null;
  bullets: string[];
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
};

export function ExecutiveTab({ 
  metrics, 
  rpcData, 
  bullets, 
  filterOptions, 
  selectedDimensions,
  onDimensionChange 
}: ExecutiveTabProps) {
  if (!metrics || !rpcData) return null;

  const s = rpcData.strategic.actual || { leads: 0, ventas: 0, efectividad: 0, contactabilidad: 0, gestionados: 0, no_gestionados: 0, abandonos: 0, avg_ttf_min: 0 };
  const prev = rpcData.strategic.anterior || { leads: 0, ventas: 0 };

  const leadsDelta = prev.leads ? ((s.leads - prev.leads) / prev.leads) * 100 : 0;
  const ventasDelta = prev.ventas ? ((s.ventas - prev.ventas) / prev.ventas) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Scorecard de Alto Impacto */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Leads"
          value={s.leads}
          icon={Users}
          deltaPct={leadsDelta}
          tooltipInfo="Total de registros recibidos en el periodo seleccionado."
          variant="default"
          compact
        />
        <KpiCard
          title="Ventas"
          value={s.ventas}
          icon={TrendingUp}
          deltaPct={ventasDelta}
          tooltipInfo="Leads marcados exitosamente como cierre/venta."
          variant="success"
          compact
        />
        <KpiCard
          title="Efectividad"
          value={s.efectividad}
          format="percentage"
          icon={Target}
          tooltipInfo="Ratio de Ventas sobre Leads. Mide la calidad del cierre."
          variant="purple"
          compact
        />
        <KpiCard
          title="Contactabilidad"
          value={s.contactabilidad || (s.leads > 0 ? (s.gestionados / s.leads) * 100 : 0)}
          format="percentage"
          icon={PhoneIncoming}
          tooltipInfo="Porcentaje de leads con al menos un intento de contacto exitoso."
          variant="amber"
          compact
        />
        <KpiCard
          title="Gestionados"
          value={s.gestionados}
          icon={Zap}
          subtitle={`${((s.gestionados / (s.leads || 1)) * 100).toFixed(1)}%`}
          tooltipInfo="Leads que han recibido alguna gestión humana o de sistema."
          variant="indigo"
          compact
        />
        <KpiCard
          title="Avg. TTF"
          value={s.avg_ttf_min}
          format="decimal"
          icon={Clock}
          subtitle="minutos"
          tooltipInfo="Tiempo promedio de primera gestión (Time To First touch)."
          variant="default"
          compact
        />
      </div>

      <div className="grid lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Hallazgos e IA Insights */}
        <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-6">
          <GlassCard className="flex-1 border-primary/10 bg-primary/5 p-6 shadow-lg shadow-primary/5">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-primary/20 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-display font-black text-foreground uppercase tracking-tight">Hallazgos Estratégicos</h3>
            </div>
            <ul className="space-y-4">
              {bullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-3 text-xs text-slate-600 leading-relaxed font-semibold border-b border-slate-100 pb-2 last:border-0"
                >
                  <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {b}
                </motion.li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard className="p-6 border-red-100 bg-red-50/30">
            <div className="flex items-center gap-2 mb-4 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="font-black uppercase text-xs tracking-widest">Alertas Operativas</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Leads sin Gestión</span>
                <span className="text-red-600 font-black">{s.no_gestionados}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Abandonos (IVR/Colas)</span>
                <span className="text-red-600 font-black">{s.abandonos}</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Evolución Dinámica */}
        <div className="lg:col-span-2 xl:col-span-3">
          <DynamicChart 
            title="Evolución de Rendimiento Operativo"
            subtitle="Análisis Diario de Leads y Ventas"
            data={rpcData.daily}
            optionBuilder={(data, type) => dynamicTimeSeriesOption(data, type, "Tendencia Diaria")}
          />
        </div>
      </div>

      {/* Dimensional Analytics Row */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <GlassCard className="p-6 border-slate-200/40">
          <DimensionTable 
            data={rpcData.porAgente} 
            title="TOP ASESORES" 
            icon={Users}
            limit={5}
          />
        </GlassCard>
        <GlassCard className="p-6 border-slate-200/40">
          <DimensionTable 
            data={rpcData.porCampanaMkt} 
            title="TOP CAMPAÑAS" 
            icon={Target}
            limit={5}
          />
        </GlassCard>
        <GlassCard className="p-6 border-slate-200/40">
          <DimensionTable 
            data={rpcData.porCiudad} 
            title="GEOGRAFÍA (CIUDAD)" 
            icon={Globe}
            limit={5}
          />
        </GlassCard>
      </div>
    </div>
  );
}

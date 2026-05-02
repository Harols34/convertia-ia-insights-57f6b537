import React from "react";
import { Filter, Users, Globe, Target, Briefcase } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { DimensionFilter } from "./DimensionFilter";
import { LeadRow } from "@/lib/dashboard-leads";

interface QuickFilterSidebarProps {
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
}

export function QuickFilterSidebar({ 
  filterOptions, 
  selectedDimensions, 
  onDimensionChange 
}: QuickFilterSidebarProps) {
  return (
    <GlassCard className="p-4 flex flex-col gap-4 border-slate-200/40 bg-slate-50/20">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
        <Filter className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Filtros Rápidos</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Briefcase className="h-3 w-3" /> Clientes
          </label>
          <DimensionFilter 
            label="Cliente"
            options={filterOptions.cliente || []}
            selected={selectedDimensions.cliente || []}
            onChange={(vals) => onDimensionChange("cliente", vals)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Target className="h-3 w-3" /> Campañas
          </label>
          <DimensionFilter 
            label="Campaña"
            options={filterOptions.campana_mkt || []}
            selected={selectedDimensions.campana_mkt || []}
            onChange={(vals) => onDimensionChange("campana_mkt", vals)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Globe className="h-3 w-3" /> Ciudades
          </label>
          <DimensionFilter 
            label="Ciudad"
            options={filterOptions.ciudad || []}
            selected={selectedDimensions.ciudad || []}
            onChange={(vals) => onDimensionChange("ciudad", vals)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Users className="h-3 w-3" /> Asesores
          </label>
          <DimensionFilter 
            label="Asesor"
            options={filterOptions.agente_prim_gestion || []}
            selected={selectedDimensions.agente_prim_gestion || []}
            onChange={(vals) => onDimensionChange("agente_prim_gestion", vals)}
            className="w-full"
          />
        </div>
      </div>
    </GlassCard>
  );
}

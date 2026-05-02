import React from "react";
import { cn } from "@/lib/utils";
import { Filter, Users, Globe, Target, Briefcase, ChevronDown } from "lucide-react";
import { DimensionFilter } from "./DimensionFilter";
import { LeadRow } from "@/lib/dashboard-leads";
import { GlassCard } from "./GlassCard";

interface TabFilterBarProps {
  filterOptions: Partial<Record<keyof LeadRow, string[]>>;
  selectedDimensions: Partial<Record<keyof LeadRow, string[]>>;
  onDimensionChange: (col: keyof LeadRow, values: string[]) => void;
  className?: string;
  variant?: "card" | "inline";
}

export function TabFilterBar({ 
  filterOptions, 
  selectedDimensions, 
  onDimensionChange,
  className,
  variant = "card"
}: TabFilterBarProps) {
  const content = (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {variant === "card" && (
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200/60 hidden md:flex mr-2">
          <Filter className="h-3.5 w-3.5 text-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtrar Vista</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
         <DimensionFilter 
            label="Cliente"
            options={filterOptions.cliente || []}
            selected={selectedDimensions.cliente || []}
            onChange={(vals) => onDimensionChange("cliente", vals)}
            className={cn("h-8 min-w-[110px]", variant === "inline" && "min-w-[90px] h-7 text-[10px]")}
          />

         <DimensionFilter 
            label="Campaña"
            options={filterOptions.campana_mkt || []}
            selected={selectedDimensions.campana_mkt || []}
            onChange={(vals) => onDimensionChange("campana_mkt", vals)}
            className={cn("h-8 min-w-[110px]", variant === "inline" && "min-w-[90px] h-7 text-[10px]")}
          />

         <DimensionFilter 
            label="Ciudad"
            options={filterOptions.ciudad || []}
            selected={selectedDimensions.ciudad || []}
            onChange={(vals) => onDimensionChange("ciudad", vals)}
            className={cn("h-8 min-w-[110px]", variant === "inline" && "min-w-[90px] h-7 text-[10px]")}
          />

         <DimensionFilter 
            label="Asesor"
            options={filterOptions.agente_prim_gestion || []}
            selected={selectedDimensions.agente_prim_gestion || []}
            onChange={(vals) => onDimensionChange("agente_prim_gestion", vals)}
            className={cn("h-8 min-w-[110px]", variant === "inline" && "min-w-[90px] h-7 text-[10px]")}
          />
      </div>
    </div>
  );

  if (variant === "inline") return content;

  return (
    <GlassCard className="p-3 mb-6 border-slate-200/40 bg-white/40 backdrop-blur-md shadow-sm">
      {content}
    </GlassCard>
  );
}

import React from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ComparativePeriod } from "@/lib/comparative-utils";
import { History, CalendarClock } from "lucide-react";

export type ComparativePickerProps = {
  value: ComparativePeriod;
  onValueChange: (v: ComparativePeriod) => void;
  className?: string;
};

export function ComparativePicker({ value, onValueChange, className }: ComparativePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        <span className="text-[11px] font-bold uppercase tracking-wider">VS</span>
      </div>
      <Select value={value} onValueChange={(v) => onValueChange(v as ComparativePeriod)}>
        <SelectTrigger className="h-8 w-[160px] text-[11px] font-medium bg-white/50 backdrop-blur-sm border-slate-200/60 shadow-sm transition-all hover:border-primary/40">
          <SelectValue placeholder="Comparar con..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="periodo_previo_equivalente" className="text-[11px]">Periodo equivalente</SelectItem>
          <SelectItem value="ayer" className="text-[11px]">Día anterior</SelectItem>
          <SelectItem value="semana_anterior" className="text-[11px]">Semana anterior</SelectItem>
          <SelectItem value="mes_anterior" className="text-[11px]">Mes anterior</SelectItem>
          <SelectItem value="año_anterior" className="text-[11px]">Año anterior</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

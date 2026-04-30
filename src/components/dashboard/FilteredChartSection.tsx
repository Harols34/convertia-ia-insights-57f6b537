import React, { useMemo, useState } from "react";
import { GlassCard } from "./GlassCard";
import { 
  type LeadRow, 
  LEADS_FILTER_EMPTY_TOKEN,
  formatFilterChipValue,
  applyLeadsDashboardFilters,
  getNormalizedLeadValue
} from "@/lib/dashboard-leads";
import { statsByKey, statsByWeekday, type LeadVentasStats } from "@/lib/dashboard-leads-analytics";
import ReactECharts from "echarts-for-react";
import { EChartsOption } from "echarts";
import { 
  Filter, 
  RotateCcw, 
  Target, 
  Users, 
  TrendingUp,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilteredChartSectionProps {
  title: string;
  leads: LeadRow[];
  dimension: keyof LeadRow | "weekday";
  filterColumns: { key: keyof LeadRow; label: string; multi?: boolean }[];
  chartOptionBuilder: (data: any[], viz: any) => EChartsOption;
  defaultViz?: string;
  vizOptions?: { value: string; label: string }[];
}

export function FilteredChartSection({
  title,
  leads,
  dimension,
  filterColumns,
  chartOptionBuilder,
  defaultViz = "bar",
  vizOptions
}: FilteredChartSectionProps) {
  const [viz, setViz] = useState(defaultViz);
  const [localFilters, setLocalFilters] = useState<Record<string, string[]>>({});

  const filteredLeads = useMemo(() => {
    return leads.filter((row) => {
      for (const [col, vals] of Object.entries(localFilters)) {
        if (!vals?.length) continue;
        const normalized = getNormalizedLeadValue(row, col as keyof LeadRow);
        if (!vals.includes(normalized)) return false;
      }
      return true;
    });
  }, [leads, localFilters]);

  const stats = useMemo(() => {
    if (dimension === "weekday") return statsByWeekday(filteredLeads);
    return statsByKey(filteredLeads, dimension as keyof LeadRow);
  }, [filteredLeads, dimension]);

  const kpis = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const totalVentas = filteredLeads.filter(l => l.es_venta).length;
    const effectiveness = totalLeads > 0 ? (totalVentas / totalLeads) * 100 : 0;
    return { totalLeads, totalVentas, effectiveness };
  }, [filteredLeads]);

  const resetFilters = () => setLocalFilters({});

  const toggleFilterValue = (column: string, value: string) => {
    setLocalFilters(prev => {
      const current = prev[column] ?? [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [column]: next };
    });
  };

  const activeFilterCount = Object.values(localFilters).flat().length;

  return (
    <GlassCard noPad className="flex flex-col overflow-hidden shadow-lg border-slate-200/60 transition-all hover:shadow-xl">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
            <TrendingUp className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">
              {title}
            </h3>
            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <Users className="h-3 w-3" />
              {filteredLeads.length.toLocaleString()} leads filtrados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetFilters}
              className="h-8 px-3 text-[10px] text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 font-semibold"
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Reset ({activeFilterCount})
            </Button>
          )}
          
          <div className="flex items-center p-1 bg-slate-100/80 rounded-lg border border-slate-200/50">
            {filterColumns.map((col) => (
              <FilterDropdown 
                key={String(col.key)}
                label={col.label}
                leads={leads}
                column={col.key}
                selectedValues={localFilters[String(col.key)] ?? []}
                onToggle={(val) => toggleFilterValue(String(col.key), val)}
              />
            ))}
          </div>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <div className="flex items-center gap-1.5">
            <Select value={viz} onValueChange={setViz}>
              <SelectTrigger className="h-8 w-[110px] text-[10px] bg-white shadow-sm border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras</SelectItem>
                <SelectItem value="bar_h">Barras H</SelectItem>
                <SelectItem value="donut">Donut</SelectItem>
                <SelectItem value="radar">Radar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
        <div className="p-4 border-r border-slate-100 flex flex-col items-center justify-center transition-colors hover:bg-teal-50/10">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Volumen</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-xl font-display font-black text-slate-800 tracking-tight">{kpis.totalLeads.toLocaleString()}</span>
          </div>
        </div>
        <div className="p-4 border-r border-slate-100 flex flex-col items-center justify-center transition-colors hover:bg-violet-50/10">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Ventas</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500"></div>
            <span className="text-xl font-display font-black text-slate-800 tracking-tight">{kpis.totalVentas.toLocaleString()}</span>
          </div>
        </div>
        <div className="p-4 flex flex-col items-center justify-center transition-colors hover:bg-amber-50/10">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Conversión</span>
          <div className="flex items-center gap-2 text-amber-600">
            <Target className="h-4 w-4" />
            <span className="text-xl font-display font-black tracking-tight">{kpis.effectiveness.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 bg-white">
        {filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Filter className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">Sin datos para esta segmentación</p>
            <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs mt-4 rounded-full px-6">
              Restablecer filtros
            </Button>
          </div>
        ) : (
          <ReactECharts
            option={chartOptionBuilder(stats, viz as any)}
            style={{ height: 320, width: "100%" }}
            notMerge
            lazyUpdate
          />
        )}
      </div>
    </GlassCard>
  );
}

function FilterDropdown({ 
  label, 
  leads, 
  column, 
  selectedValues, 
  onToggle 
}: { 
  label: string; 
  leads: LeadRow[]; 
  column: keyof LeadRow; 
  selectedValues: string[];
  onToggle: (val: string) => void;
}) {
  const options = useMemo(() => {
    const s = new Set<string>();
    leads.forEach(row => {
      s.add(getNormalizedLeadValue(row, column));
    });
    return Array.from(s).sort((a, b) => {
      if (a === LEADS_FILTER_EMPTY_TOKEN) return 1;
      if (b === LEADS_FILTER_EMPTY_TOKEN) return -1;
      return a.localeCompare(b);
    });
  }, [leads, column]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-7 text-[10px] px-2 gap-1",
            selectedValues.length > 0 && "border-primary bg-primary/5 text-primary font-medium"
          )}
        >
          {label}
          {selectedValues.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] bg-primary text-primary-foreground border-none">
              {selectedValues.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandInput placeholder={`Buscar ${label.toLowerCase()}...`} className="h-8 text-xs" />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty className="py-2 text-[10px] text-center">No se encontraron resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => onToggle(option)}
                  className="text-xs py-1.5 flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox 
                    checked={selectedValues.includes(option)} 
                    className="h-3.5 w-3.5 border-muted-foreground/30"
                  />
                  <span className="flex-1 truncate">
                    {formatFilterChipValue(option)}
                  </span>
                  {selectedValues.includes(option) && <Check className="h-3 w-3 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

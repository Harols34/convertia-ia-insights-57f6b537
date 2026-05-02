import React, { useState, useMemo } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatFilterChipValue } from "@/lib/dashboard-leads";

export type DimensionFilterProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
};

export function DimensionFilter({ label, options, selected, onChange, className }: DimensionFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => formatFilterChipValue(o).toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (token: string, checked: boolean) => {
    const set = new Set(selected);
    if (checked) set.add(token);
    else set.delete(token);
    onChange([...set]);
  };

  const selectAllVisible = () => {
    const merged = new Set([...selected, ...filtered]);
    onChange([...merged]);
  };

  const clearColumn = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-9 justify-between gap-2 min-w-[140px] max-w-[240px] text-[11px] font-medium border-slate-200/60 bg-white/50 backdrop-blur-sm shadow-sm transition-all hover:border-primary/40",
            selected.length > 0 && "border-primary/50 bg-primary/5",
            className
          )}
        >
          <span className="truncate text-left flex items-center gap-1.5">
            <span className="text-muted-foreground/80 font-bold uppercase tracking-tight">{label}</span>
            {selected.length > 0 ? (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-primary/10 text-primary border-none">
                {selected.length}
              </Badge>
            ) : (
              <span className="text-slate-400 font-normal">: Todos</span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 shadow-2xl border-white/10 glass-bi" align="start">
        <div className="p-3 border-b border-white/10 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Buscar..."
              className="h-8 pl-8 text-xs bg-slate-50/50 border-none focus-visible:ring-primary/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              className="h-7 flex-1 text-[10px] font-bold uppercase tracking-wider" 
              onClick={selectAllVisible}
            >
              Seleccionar Visibles
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="h-7 flex-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" 
              onClick={clearColumn}
            >
              Limpiar
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[240px]">
          <div className="p-2 space-y-1">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-10 italic">Sin resultados</p>
            ) : (
              filtered.map((token) => {
                const checked = selected.includes(token);
                return (
                  <div
                    key={token}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100/80 cursor-pointer transition-colors group",
                      checked && "bg-primary/5"
                    )}
                    onClick={() => toggle(token, !checked)}
                  >
                    <div className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border border-primary/30 transition-all",
                      checked ? "bg-primary border-primary" : "bg-white"
                    )}>
                      {checked && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium leading-none truncate flex-1",
                      checked ? "text-primary font-bold" : "text-slate-600"
                    )}>
                      {formatFilterChipValue(token)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
        {options.length >= 400 && (
          <div className="px-3 py-2 border-t border-white/10 bg-slate-50/50">
            <p className="text-[9px] text-muted-foreground italic font-medium">
              Limitado a los primeros 400 valores.
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

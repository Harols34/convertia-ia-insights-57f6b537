import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Filter, Calendar, ChevronDown, X, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLeadsData } from "@/contexts/LeadsDataContext";
import { ExecutiveDashboardBody } from "@/components/dashboard/ExecutiveDashboardBody";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LEADS_DASHBOARD_FILTER_COLUMNS,
  applyLeadsDashboardFilters,
  defaultLeadsDashboardFilters,
  formatFilterChipValue,
  uniqueValuesForColumn,
  type LeadRow,
  type LeadsDashboardFilters,
} from "@/lib/dashboard-leads";

interface LeadStats {
  total: number;
  conGestion: number;
  conNegocio: number;
  ventas: number;
  tasaGestion: string;
  tasaNegocio: string;
  tasaConversion: string;
  porCliente: { name: string; value: number }[];
  porCampanaMkt: { name: string; value: number }[];
  porCiudad: { name: string; value: number }[];
  porResultNegocio: { name: string; value: number }[];
  porResultPrimGestion: { name: string; value: number }[];
}

function countBy(arr: LeadRow[], key: keyof LeadRow): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  arr.forEach((item) => {
    const val = item[key];
    const s = val == null || val === "" ? "" : String(val);
    if (s) map[s] = (map[s] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildStats(leads: LeadRow[]): LeadStats | null {
  if (!leads.length) return null;
  const total = leads.length;
  const conGestion = leads.filter((l) => l.result_prim_gestion && l.result_prim_gestion !== "").length;
  const conNegocio = leads.filter((l) => l.result_negocio && l.result_negocio !== "").length;
  const ventas = leads.filter((l) => l.es_venta).length;

  return {
    total,
    conGestion,
    conNegocio,
    ventas,
    tasaGestion: total > 0 ? ((conGestion / total) * 100).toFixed(1) : "0",
    tasaNegocio: total > 0 ? ((conNegocio / total) * 100).toFixed(1) : "0",
    tasaConversion: total > 0 ? ((ventas / total) * 100).toFixed(1) : "0",
    porCliente: countBy(leads, "cliente"),
    porCampanaMkt: countBy(leads, "campana_mkt"),
    porCiudad: countBy(leads, "ciudad"),
    porResultNegocio: countBy(leads, "result_negocio"),
    porResultPrimGestion: countBy(leads, "result_prim_gestion"),
  };
}

function DimensionMultiFilter({
  col,
  label,
  allLeads,
  selected,
  onChange,
}: {
  col: keyof LeadRow;
  label: string;
  allLeads: LeadRow[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const options = useMemo(() => uniqueValuesForColumn(allLeads, col), [allLeads, col]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => formatFilterChipValue(o).toLowerCase().includes(q));
  }, [options, search]);

  const summary =
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? formatFilterChipValue(selected[0])
        : `${selected.length} valores`;

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
        <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[160px] max-w-[220px] text-xs font-normal">
          <span className="truncate text-left">
            <span className="text-muted-foreground mr-1">{label}:</span>
            {summary}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border space-y-2">
          <Input
            placeholder="Buscar…"
            className="h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            <Button type="button" variant="secondary" size="sm" className="h-7 text-[10px]" onClick={selectAllVisible}>
              + visibles
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={clearColumn}>
              Limpiar
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[220px]">
          <div className="p-2 space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-1">Sin coincidencias</p>
            ) : (
              filtered.map((token) => {
                const id = `${String(col)}-${token}`;
                const checked = selected.includes(token);
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/60 cursor-pointer"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => toggle(token, c === true)}
                      className="mt-0.5"
                    />
                    <span className="text-[11px] leading-snug break-all">{formatFilterChipValue(token)}</span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>
        {options.length >= 400 && (
          <p className="text-[9px] text-muted-foreground px-2 py-1 border-t border-border">
            Mostrando hasta 400 valores distintos en esta columna.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function DashboardPage() {
  const { allLeads, loading, error: loadError, initialLoadDone } = useLeadsData();
  const [activity, setActivity] = useState<unknown[]>([]);
  const [filters, setFilters] = useState<LeadsDashboardFilters>(defaultLeadsDashboardFilters);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5);
      setActivity(logs || []);
    })();
  }, []);

  const filteredLeads = useMemo(() => applyLeadsDashboardFilters(allLeads, filters), [allLeads, filters]);
  const stats = useMemo(() => buildStats(filteredLeads), [filteredLeads]);

  const setDimension = useCallback((col: keyof LeadRow, values: string[]) => {
    setFilters((prev) => {
      const dimensions = { ...prev.dimensions };
      if (values.length === 0) delete dimensions[col];
      else dimensions[col] = values;
      return { ...prev, dimensions };
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.desde || filters.hasta) n += 1;
    if (filters.esVenta !== "all") n += 1;
    for (const vals of Object.values(filters.dimensions)) {
      if (vals?.length) n += 1;
    }
    return n;
  }, [filters]);

  const clearAllFilters = () => setFilters(defaultLeadsDashboardFilters());

  if (loadError && initialLoadDone && allLeads.length === 0) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive font-medium">No se pudieron cargar los datos del panel</p>
        <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card/50 p-4 md:p-6 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-violet-50 border border-teal-100 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Dashboard ejecutivo</h1>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">
              {!initialLoadDone && loading ? (
                <span className="text-muted-foreground/80">Preparando universo de trabajo…</span>
              ) : (
                <>
                  Universo <strong className="text-foreground">{allLeads.length.toLocaleString("es")}</strong> leads
                  (RLS).
                </>
              )}
              {filteredLeads.length !== allLeads.length && (
                <>
                  {" "}
                  Vista filtrada: <strong className="text-teal-700">{filteredLeads.length.toLocaleString("es")}</strong>.
                </>
              )}{" "}
              BI interactivo: alterna tipos de gráfico, comparativas y dimensiones descubiertas automáticamente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs gap-1 h-9" onClick={clearAllFilters}>
              <X className="h-3.5 w-3.5" />
              Quitar filtros ({activeFilterCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-9">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </Button>
        </div>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4 p-4 rounded-2xl border border-border bg-muted/40 shadow-sm"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Fecha creación desde</Label>
                <Input
                  type="date"
                  value={filters.desde || ""}
                  onChange={(e) => setFilters({ ...filters, desde: e.target.value || undefined })}
                  className="h-9 w-[150px] text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">hasta</Label>
                <Input
                  type="date"
                  value={filters.hasta || ""}
                  onChange={(e) => setFilters({ ...filters, hasta: e.target.value || undefined })}
                  className="h-9 w-[150px] text-xs"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">Es venta</Label>
              <Select
                value={filters.esVenta}
                onValueChange={(v) => setFilters({ ...filters, esVenta: v as LeadsDashboardFilters["esVenta"] })}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-2">
              Dimensiones (varios valores = OR dentro del campo; entre campos = AND)
            </p>
            <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pr-1">
              {LEADS_DASHBOARD_FILTER_COLUMNS.map(({ key, label }) => (
                <DimensionMultiFilter
                  key={String(key)}
                  col={key}
                  label={label}
                  allLeads={allLeads}
                  selected={filters.dimensions[key] ?? []}
                  onChange={(next) => setDimension(key, next)}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {stats && stats.total > 0 ? (
        <ExecutiveDashboardBody
          leads={filteredLeads}
          onCrossFilter={(payload) => {
            setFilters((prev) => ({
              ...prev,
              dimensions: { ...prev.dimensions, [payload.column]: [payload.token] },
            }));
          }}
          onFilterByDate={(isoDay) => {
            setFilters((prev) => ({ ...prev, desde: isoDay, hasta: isoDay }));
          }}
          onFilterByWeekRange={(desde, hasta) => {
            setFilters((prev) => ({ ...prev, desde, hasta }));
          }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-muted/20 p-12 text-center">
          <p className="text-muted-foreground text-sm">
            {!initialLoadDone && loading
              ? "Los gráficos aparecerán en cuanto terminemos de preparar el espacio de análisis."
              : allLeads.length === 0
                ? "No hay datos de leads disponibles aún"
                : "Ningún lead cumple los filtros actuales"}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border">
          <h2 className="font-display font-semibold text-foreground">Actividad reciente</h2>
        </div>
        <div className="divide-y divide-border">
          {activity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No hay actividad reciente registrada</div>
          ) : (
            activity.map((item: { id: string; action: string; module?: string; created_at: string }, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.module || "Sistema"}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("es")}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

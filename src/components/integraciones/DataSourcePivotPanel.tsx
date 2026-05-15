import React, { useCallback, useEffect, useMemo, useState, useTransition, Children } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Loader2, RefreshCw, GripVertical, BarChart3, Calculator, LayoutDashboard, ChevronDown, Palette, Search, LineChart, PieChart, Table, Target, Wand2, Trash2, TrendingUp, Layout, MousePointer2, Calendar, Type, Hash, Plus, Info, BarChart, AreaChart, PieChart as PieChartIcon, Activity, Grid, List, Filter as FilterIcon, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchAllIntegrationRows } from "./fetch-integration-table";
import { fetchCachedIntegrationRows } from "@/lib/integration-rows-cache";
import { PivotTableView } from "./PivotTableView";
import { buildPivotChartOption, firstCellValue, grandTotalMeasure, isCustomCardViz } from "@/lib/pivot-chart";
import {
  type AggFn,
  type CalcOp,
  type DateGranularity,
  type PivotFilter,
  type PivotMeasureSpec,
  type ShowAs,
  buildPivotGrid,
  showAsLabel,
  uniquePivotDimensionValues,
} from "@/lib/pivot-engine";
import { DATE_GRANULARITY_LABELS, isDateLikeType } from "@/lib/pivot-dates";
import type { PivotVizType, PivotWidgetPersistedConfig, WidgetAppearance, WidgetChrome } from "@/types/analytics-pivot";
import {
  boardWidgetChromeShowsHeader,
  coalesceWidgetChrome,
  parseSafeHexColor,
  sanitizeWidgetAppearance,
} from "@/lib/widget-appearance-utils";
import { PIVOT_VIZ_OPTIONS } from "@/types/analytics-pivot";
import { getVizBuilderProfile } from "@/lib/viz-builder-profile";
import { translatePivotConfigToRpc, buildGridFromAggregatedData } from "@/lib/pivot-rpc-bridge";

const DRAG_TYPE = "application/x-convertia-field";

type Zone = "filters" | "rows" | "cols" | "values";

interface ColMeta {
  column_name: string;
  data_type: string;
  udt_name: string;
}

function defaultAgg(meta: ColMeta[] | undefined, field: string): AggFn {
  const m = meta?.find((c) => c.column_name === field);
  if (!m) return "count";
  const t = `${m.data_type} ${m.udt_name}`.toLowerCase();
  if (
    t.includes("int") ||
    t.includes("numeric") ||
    t.includes("double") ||
    t.includes("real") ||
    t.includes("decimal") ||
    t.includes("float")
  ) {
    return "sum";
  }
  return "count";
}

const AGG_OPTIONS: { v: AggFn; l: string }[] = [
  { v: "sum", l: "Suma" },
  { v: "count", l: "Recuento" },
  { v: "avg", l: "Promedio" },
  { v: "max", l: "Máximo" },
  { v: "min", l: "Mínimo" },
  { v: "countDistinct", l: "Recuento único" },
];

const SHOW_AS_OPTIONS: ShowAs[] = [
  "none",
  "percentGrand",
  "percentCol",
  "percentRow",
  "percentParentRow",
  "percentParentCol",
  "percentParentGrand",
  "diffPrevRow",
  "diffPrevCol",
  "pctDiffPrevRow",
  "pctDiffPrevCol",
  "rankAscInRow",
  "rankDescInRow",
  "rankAscInCol",
  "rankDescInCol",
];

const CALC_OPS: { v: CalcOp; l: string }[] = [
  { v: "add", l: "Suma" },
  { v: "subtract", l: "Resta" },
  { v: "multiply", l: "Multiplicación" },
  { v: "divide", l: "División" },
  { v: "pctChange", l: "Variación % (A vs B)" },
];

function pruneAppearance(a: WidgetAppearance): WidgetAppearance | undefined {
  return sanitizeWidgetAppearance(a);
}

/** Siempre persiste `showHeader` para que el tablero no asuma “mostrar” por omisión. */
function pruneWidgetChrome(title: string, showHeader: boolean): WidgetChrome {
  const out: WidgetChrome = { showHeader };
  const t = title.trim();
  if (t) out.title = t;
  return out;
}

interface DataSourcePivotPanelProps {
  tableName: string;
  displayName: string;
  onClose: () => void;
  /** En páginas embebidas (p. ej. Analytics) oculta el botón cerrar */
  showCloseButton?: boolean;
  /** Si existe, muestra acción para guardar la vista actual en el tablero */
  onAddToBoard?: (config: PivotWidgetPersistedConfig) => void;
  /** Si existe junto con onUpdateBoardWidget, el botón principal actualiza ese widget */
  boardWidgetId?: string | null;
  onUpdateBoardWidget?: (widgetId: string, config: PivotWidgetPersistedConfig) => void;
  onCancelBoardEdit?: () => void;
  /** Deshabilita «Guardar cambios» mientras persiste en BD */
  boardSavePending?: boolean;
  /** Hidratar el constructor desde un guardado (p. ej. duplicar configuración) */
  initialConfig?: PivotWidgetPersistedConfig | null;
  /** Columnas a ocultar en datos (Integraciones); no sustituye seguridad en BD */
  hiddenDataColumns?: string[];
  /** sidebar: columna fija · sheet: panel en modal lateral ancho */
  layoutVariant?: "sidebar" | "sheet";
}

function DropZone({
  title,
  icon: Icon,
  zone,
  children,
  onDropField,
  className,
  description,
}: {
  title: string;
  icon?: any;
  zone: Zone;
  children: React.ReactNode;
  onDropField: (zone: Zone, field: string) => void;
  className?: string;
  description?: string;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        const f = e.dataTransfer.getData(DRAG_TYPE);
        if (f) onDropField(zone, f);
      }}
      className={cn(
        "rounded-lg border-2 border-dashed p-2.5 transition-all min-h-[60px] flex flex-col gap-2",
        isOver ? "border-primary bg-primary/5 shadow-inner scale-[1.01]" : "border-border bg-muted/5 hover:bg-muted/10",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        </div>
        {description && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="text-[10px] max-w-[200px]">{description}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {Children.count(children) === 0 ? (
          <div className="m-auto flex items-center gap-1 opacity-30 select-none">
            <Plus className="h-3 w-3" />
            <span className="text-[9px] font-medium italic">Soltar aquí</span>
          </div>
        ) : children}
      </div>
    </div>
  );
}

export function DataSourcePivotPanel({
  tableName,
  displayName,
  onClose,
  showCloseButton = true,
  onAddToBoard,
  boardWidgetId = null,
  onUpdateBoardWidget,
  onCancelBoardEdit,
  boardSavePending = false,
  initialConfig,
  hiddenDataColumns = [],
  layoutVariant = "sidebar",
}: DataSourcePivotPanelProps) {
  const [filterFields, setFilterFields] = useState<string[]>([]);
  const [rowFields, setRowFields] = useState<string[]>([]);
  const [colFields, setColFields] = useState<string[]>([]);
  const [measures, setMeasures] = useState<PivotMeasureSpec[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Carga automática al montar el componente si no hay datos
    if (rows.length === 0 && !loadingData) {
      loadFullData();
    }
  }, [tableName]); // Re-cargar si cambia la tabla

  const rowCount = rows.length;
  const [viz, setViz] = useState<PivotVizType>("table");
  const [chartMeasureId, setChartMeasureId] = useState<string>("");
  const [fieldDateGranularity, setFieldDateGranularity] = useState<Record<string, DateGranularity>>({});

  const [calcOpen, setCalcOpen] = useState(false);
  const [calcLabel, setCalcLabel] = useState("Medida calculada");
  const [calcOp, setCalcOp] = useState<CalcOp>("subtract");
  const [calcLeft, setCalcLeft] = useState("");
  const [calcRight, setCalcRight] = useState("");
  const [filterSelections, setFilterSelections] = useState<Record<string, string[]>>({});
  const [appearance, setAppearance] = useState<WidgetAppearance>({});
  const [wizardStep, setWizardStep] = useState<"pick_viz" | "configure">(() =>
    initialConfig || boardWidgetId ? "configure" : "pick_viz",
  );
  const [accentPaletteText, setAccentPaletteText] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [showWidgetHeader, setShowWidgetHeader] = useState(true);

  useEffect(() => {
    if (!initialConfig) return;
    setFilterFields([...(initialConfig.filterFields ?? [])]);
    setRowFields([...(initialConfig.rowFields ?? [])]);
    setColFields([...(initialConfig.colFields ?? [])]);
    setMeasures(JSON.parse(JSON.stringify(initialConfig.measures ?? [])) as PivotMeasureSpec[]);
    setViz(initialConfig.viz ?? "table");
    setChartMeasureId(initialConfig.chartMeasureId ?? "");
    setFilterSelections({ ...(initialConfig.filterSelections ?? {}) });
    setFieldDateGranularity({ ...(initialConfig.fieldDateGranularity ?? {}) });
    setAppearance({ ...(initialConfig.appearance ?? {}) });
    const ch = coalesceWidgetChrome(initialConfig.chrome);
    setAccentPaletteText((initialConfig.appearance?.accentPalette ?? []).join(", "));
    setWidgetTitle(ch?.title ?? "");
    setShowWidgetHeader(boardWidgetChromeShowsHeader(initialConfig.chrome));
    /* hiddenDataColumns vienen del padre por tabla, no del initialConfig */
  }, [initialConfig]);

  useEffect(() => {
    if (initialConfig || boardWidgetId) setWizardStep("configure");
  }, [initialConfig, boardWidgetId]);

  useEffect(() => {
    if (!initialConfig && !boardWidgetId) setWizardStep("pick_viz");
  }, [tableName, initialConfig, boardWidgetId]);

  const { data: colMeta, isLoading: colsLoading } = useQuery({
    queryKey: ["integration-columns", tableName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_integration_table_columns", { p_table_name: tableName });
      if (error) throw error;
      return data as ColMeta[];
    },
  });

  // Precarga automática al abrir o cambiar de tabla
  useEffect(() => {
    if (tableName) {
      loadFullData();
    }
  }, [tableName]);

  /** Metadatos de columnas visibles para el usuario final (excluye `hiddenDataColumns` de la fuente). */
  const visibleColMeta = useMemo(() => {
    if (!colMeta?.length) return [];
    const hide = new Set(hiddenDataColumns);
    return colMeta.filter((c) => !hide.has(c.column_name));
  }, [colMeta, hiddenDataColumns]);

  const dateFieldsMeta = useMemo(
    () => visibleColMeta.filter((c) => isDateLikeType(c.data_type, c.udt_name)).map((c) => c.column_name),
    [visibleColMeta],
  );

  const usedDateFields = useMemo(() => {
    const u = new Set([...rowFields, ...colFields, ...filterFields]);
    return dateFieldsMeta.filter((f) => u.has(f));
  }, [rowFields, colFields, filterFields, dateFieldsMeta]);

  const profile = useMemo(() => getVizBuilderProfile(viz), [viz]);

  const vizGroups = useMemo(() => {
    const m = new Map<string, (typeof PIVOT_VIZ_OPTIONS)[number][]>();
    for (const o of PIVOT_VIZ_OPTIONS) {
      if (!m.has(o.group)) m.set(o.group, []);
      m.get(o.group)!.push(o);
    }
    return [...m.entries()];
  }, []);

  const [gridData, setGridData] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const updatePreview = async () => {
      if (!measures.length) {
        setGridData([]);
        return;
      }
      setLoadingData(true);
      try {
        const config: PivotWidgetPersistedConfig = {
          version: 1,
          tableName,
          displayName,
          filterFields,
          rowFields,
          colFields,
          measures,
          filterSelections,
          fieldDateGranularity,
          viz,
          chartMeasureId: chartMeasureId || measures[0]?.id || "",
          appearance,
          chrome: { title: widgetTitle, showHeader: showWidgetHeader }
        };
        
        const bridge = translatePivotConfigToRpc(config);
        const { data, error } = await supabase.rpc("analytics_aggregate", {
          p_group_by: bridge.groupBy,
          p_measures: bridge.measures,
          p_filters: bridge.filters,
          p_date_granularity: bridge.dateGranularity,
          p_limit: bridge.limit
        });

        if (error) throw error;
        if (!cancelled) setGridData(data as any[]);
      } catch (e: any) {
        console.error("Preview error:", e);
        if (!cancelled) {
          toast.error(`Error al sincronizar: ${e.message || "Error desconocido"}`);
          setGridData([]);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    void updatePreview();
    return () => { cancelled = true; };
  }, [rowFields, colFields, measures, filterFields, filterSelections, fieldDateGranularity, viz, tableName]);

  const grid = useMemo(() => {
    if (!gridData.length || !measures.length) return null;
    return buildGridFromAggregatedData(gridData, {
      version: 1,
      tableName,
      displayName,
      filterFields,
      rowFields,
      colFields,
      measures,
      filterSelections,
      fieldDateGranularity,
      viz,
      chartMeasureId,
      appearance,
      chrome: {}
    });
  }, [gridData, rowFields, colFields, measures, filterFields, filterSelections, fieldDateGranularity, viz, chartMeasureId, appearance]);

  const toggleFilterValue = (field: string, value: string, checked: boolean) => {
    startTransition(() => {
      const all = uniquePivotDimensionValues(rows, field, dateFieldsMeta, fieldDateGranularity);
      setFilterSelections((prev) => {
        const base = new Set(prev[field] ?? all);
        if (checked) base.add(value);
        else base.delete(value);
        const arr = [...base].filter((v) => all.includes(v));
        if (arr.length === 0) return { ...prev, [field]: [] };
        if (arr.length === all.length) {
          const { [field]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [field]: arr };
      });
    });
  };

  const onDragStart = (e: React.DragEvent, field: string) => {
    e.dataTransfer.setData(DRAG_TYPE, field);
  };

  const onDropField = (zone: Zone, field: string) => {
    if (zone === "filters") {
      setFilterFields((f) => (f.includes(field) ? f : [...f, field]));
      return;
    }
    if (zone === "rows") {
      setRowFields((f) => (f.includes(field) ? f : [...f, field]));
      return;
    }
    if (zone === "cols") {
      setColFields((f) => (f.includes(field) ? f : [...f, field]));
      return;
    }
    if (zone === "values") {
      const id = crypto.randomUUID();
      const agg = defaultAgg(visibleColMeta, field);
      setMeasures((m) => [...m, { id, kind: "field", field, aggregation: agg, showAs: "none" }]);
    }
  };

  const removeFrom = (zone: Zone, idx: number) => {
    if (zone === "filters") setFilterFields((f) => f.filter((_, i) => i !== idx));
    if (zone === "rows") setRowFields((f) => f.filter((_, i) => i !== idx));
    if (zone === "cols") setColFields((f) => f.filter((_, i) => i !== idx));
    if (zone === "values") setMeasures((f) => f.filter((_, i) => i !== idx));
  };

  const updateMeasure = (id: string, patch: Partial<PivotMeasureSpec>) => {
    setMeasures((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addCalculated = () => {
    if (!calcLeft || !calcRight) {
      toast.error("Selecciona dos medidas base");
      return;
    }
    const id = crypto.randomUUID();
    setMeasures((m) => [
      ...m,
      {
        id,
        kind: "calculated",
        label: calcLabel.trim() || "Calculada",
        calculated: { op: calcOp, leftId: calcLeft, rightId: calcRight },
        showAs: "none",
      },
    ]);
    setCalcOpen(false);
  };

  const fieldMeasures = measures.filter((m) => m.kind === "field");

  useEffect(() => {
    if (measures.length === 0) {
      setChartMeasureId("");
      return;
    }
    if (!chartMeasureId || !measures.some((m) => m.id === chartMeasureId)) {
      setChartMeasureId(measures[0].id);
    }
  }, [measures, chartMeasureId]);

  const chartOption =
    grid && chartMeasureId && viz !== "table" && !isCustomCardViz(viz)
      ? buildPivotChartOption(
          viz,
          chartMeasureId,
          grid,
          pruneAppearance({
            ...appearance,
            accentPalette:
              accentPaletteText.trim().length > 0
                ? accentPaletteText
                    .split(/[,;\s]+/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                : appearance.accentPalette,
          }) ?? undefined,
        )
      : null;

  const buildPersistedConfig = (): PivotWidgetPersistedConfig | null => {
    if (!grid || !measures.length) return null;
    const mergedApp = pruneAppearance({
      ...appearance,
      accentPalette:
        accentPaletteText.trim().length > 0
          ? accentPaletteText
              .split(/[,;\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : appearance.accentPalette,
    });
    return {
      version: 1,
      tableName,
      displayName,
      filterFields: [...filterFields],
      rowFields: [...rowFields],
      colFields: [...colFields],
      filterSelections: { ...filterSelections },
      measures: JSON.parse(JSON.stringify(measures)) as PivotMeasureSpec[],
      viz,
      chartMeasureId,
      dateFields: usedDateFields,
      fieldDateGranularity: { ...fieldDateGranularity },
      hiddenDataColumns: hiddenDataColumns.length ? [...hiddenDataColumns] : undefined,
      appearance: mergedApp,
      chrome: pruneWidgetChrome(widgetTitle, showWidgetHeader),
    };
  };

  const handleAddToBoard = () => {
    const cfg = buildPersistedConfig();
    if (!cfg) {
      toast.error("Carga datos y define al menos una medida en Valores antes de añadir al tablero.");
      return;
    }
    onAddToBoard?.(cfg);
  };

  const handleUpdateBoardWidget = () => {
    const cfg = buildPersistedConfig();
    if (!cfg) {
      toast.error("Carga datos y define al menos una medida en Valores antes de guardar.");
      return;
    }
    if (!boardWidgetId || !onUpdateBoardWidget) return;
    onUpdateBoardWidget(boardWidgetId, cfg);
  };

  const loadFullData = async () => {
    if (loadingData) return;
    setLoadingData(true);
    try {
      const data = await fetchCachedIntegrationRows(supabase, tableName, hiddenDataColumns);
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos");
    } finally {
      setLoadingData(false);
    }
  };

  const isRecommended = (type: PivotVizType) => {
    const numRows = rowFields.length;
    const numCols = colFields.length;
    const numMeasures = measures.length;
    const hasDimensions = (numRows + numCols) > 0;

    if (type === "card" || type === "card_trend" || type === "gauge") {
      return !hasDimensions && numMeasures === 1;
    }
    if (type === "line" || type === "area" || type === "area_stacked") {
      const allFields = [...rowFields, ...colFields];
      const hasDate = allFields.some((f) => {
        const m = visibleColMeta.find((c) => c.column_name === f);
        return m && isDateLikeType(m.data_type, m.udt_name);
      });
      return hasDate && numMeasures >= 1;
    }
    if (type === "bar" || type === "bar_horizontal") {
      return (numRows + numCols) === 1 && numMeasures >= 1;
    }
    if (type === "pie" || type === "donut") {
      return (numRows + numCols) === 1 && numMeasures === 1;
    }
    if (type === "treemap" || type === "bar_stacked") {
      return (numRows + numCols) >= 2 && numMeasures >= 1;
    }
    if (type === "scatter" || type === "bubble") {
      return numMeasures >= 2;
    }
    return false;
  };

  return (
    <aside
      className={cn(
        "flex flex-col w-full bg-card overflow-hidden",
        layoutVariant === "sheet"
          ? "h-full max-w-none border-0 shadow-none rounded-none"
          : "h-[calc(100vh-6rem)] max-w-[480px] border-l border-border shadow-xl",
      )}
    >
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground leading-none mb-1">{displayName}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono border-muted-foreground/20 text-muted-foreground">
                {tableName}
              </Badge>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {loadingData ? "Sincronizando..." : `${rows.length.toLocaleString()} filas`}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 px-2 text-xs gap-1.5 hover:bg-muted" 
            onClick={() => loadFullData()} 
            disabled={loadingData}
          >
            {loadingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualizar
          </Button>
          {showCloseButton && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {boardWidgetId ? (
        <div className="px-3 py-2 border-b border-primary/20 bg-primary/5 text-[11px] text-muted-foreground shrink-0">
          Editando una vista del tablero. Ajusta campos, gráfico o medidas y pulsa <strong className="text-foreground">Guardar cambios</strong>.
        </div>
      ) : null}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {layoutVariant === "sheet" ? (
          <div className="grid grid-cols-[280px_1fr] h-full overflow-hidden">
            {/* Columna Izquierda: Campos y Configuración */}
            <div className="flex flex-col border-r border-border bg-muted/5 overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6 pb-20">
                  {/* Buscador de Campos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Campos</Label>
                      {wizardStep === "configure" && (
                         <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[9px] text-muted-foreground hover:text-destructive gap-1 px-1.5"
                          onClick={() => {
                            setRowFields([]);
                            setColFields([]);
                            setMeasures([]);
                            setFilterFields([]);
                            setFilterSelections({});
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          Limpiar
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        placeholder="Buscar campo..."
                        className="h-8 pl-8 text-xs bg-background border-border/60"
                        value={fieldSearch}
                        onChange={(e) => setFieldSearch(e.target.value)}
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>
                    <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1 select-none">
                      {visibleColMeta
                        .filter((c) => c.column_name.toLowerCase().includes(fieldSearch.toLowerCase()))
                        .map((c) => {
                          const isDate = isDateLikeType(c.data_type, c.udt_name);
                          return (
                            <div
                              key={c.column_name}
                              draggable
                              onDragStart={(e) => onDragStart(e, c.column_name)}
                              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-primary/10 hover:text-primary cursor-grab active:cursor-grabbing text-[11px] group transition-all border border-transparent bg-background/40"
                            >
                              <GripVertical className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/50" />
                              {isDate ? (
                                <Calendar className="h-3 w-3 text-blue-500/70" />
                              ) : c.data_type.includes("int") || c.data_type.includes("numeric") || c.data_type.includes("float") ? (
                                <Hash className="h-3 w-3 text-emerald-500/70" />
                              ) : (
                                <Type className="h-3 w-3 text-muted-foreground/70" />
                              )}
                              <span className="truncate flex-1 font-medium">{c.column_name}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="h-px bg-border/40 my-2" />

                  {/* Configuración del Tablero */}
                  {(onAddToBoard || boardWidgetId) && (
                    <div className="space-y-3">
                      <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Preferencias de Tablero</Label>
                      <div className="space-y-3 p-3 rounded-xl border border-border/60 bg-background/50">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Título en el board</Label>
                          <Input
                            className="h-8 text-xs bg-background"
                            placeholder={displayName}
                            value={widgetTitle}
                            onChange={(e) => setWidgetTitle(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[10px] text-muted-foreground">Encabezado visible</Label>
                          <Switch checked={showWidgetHeader} onCheckedChange={setShowWidgetHeader} className="scale-75" />
                        </div>
                      </div>
                    </div>
                  )}

                  <Collapsible className="rounded-xl border border-border/60 bg-background/50 overflow-hidden">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2 hover:bg-muted/50 transition-colors">
                      <span className="flex items-center gap-1.5">
                        <Palette className="h-3.5 w-3.5" />
                        Apariencia
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3 space-y-4 border-t border-border/40">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[9px]">Principal</Label>
                          <Input
                            type="color"
                            className="h-7 p-0.5 cursor-pointer border-none bg-transparent"
                            value={appearance.primaryColor ?? "#3b82f6"}
                            onChange={(e) => setAppearance((a) => ({ ...a, primaryColor: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px]">Fondo</Label>
                          <Input
                            type="color"
                            className="h-7 p-0.5 cursor-pointer border-none bg-transparent"
                            value={appearance.backgroundColor ?? "#ffffff"}
                            onChange={(e) => setAppearance((a) => ({ ...a, backgroundColor: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[10px]">Mostrar leyenda</Label>
                        <Switch
                          checked={appearance.showLegend !== false}
                          onCheckedChange={(c) => setAppearance((a) => ({ ...a, showLegend: c ? undefined : false }))}
                          className="scale-75"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </ScrollArea>
            </div>

            {/* Columna Derecha: Zonas y Visualización */}
            <div className="flex flex-col overflow-hidden bg-background">
              <ScrollArea className="flex-1">
                <div className="p-6 pb-24">
                  {wizardStep === "pick_viz" ? (
                    <div className="max-w-4xl mx-auto space-y-8">
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold tracking-tight">Elige tu visualización</h3>
                        <p className="text-sm text-muted-foreground font-display">Selecciona el tipo de gráfico para comenzar a configurar los datos.</p>
                      </div>
                      <div className="grid gap-8">
                        {vizGroups.map(([group, opts]) => {
                          const GroupIcon = 
                            group === "Indicadores" ? Target :
                            group === "Comparación" ? BarChart3 :
                            group === "Tiempo" ? LineChart :
                            group === "Composición" ? PieChart :
                            group === "Tablas" ? Table : Wand2;

                          return (
                            <div key={group} className="space-y-4">
                              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                                <GroupIcon className="h-4 w-4 text-primary/70" />
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/60">{group}</h4>
                              </div>
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {opts.map((o) => {
                                  const recommended = isRecommended(o.id);
                                  return (
                                    <button
                                      key={o.id}
                                      type="button"
                                      onClick={() => {
                                        setViz(o.id);
                                        setWizardStep("configure");
                                      }}
                                      className={cn(
                                        "text-left rounded-xl border border-border bg-card/40 hover:bg-primary/5 hover:border-primary/40 p-4 transition-all group relative overflow-hidden",
                                        viz === o.id && "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-md",
                                        recommended && "border-emerald-500/30 bg-emerald-500/[0.02]"
                                      )}
                                    >
                                      <div className="flex flex-col gap-1.5 relative z-10">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[13px] font-bold block truncate">{o.label}</span>
                                          {recommended && (
                                            <Badge variant="secondary" className="h-4 px-1.5 text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold uppercase">
                                              PRO
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-tight opacity-70">Haz clic para seleccionar</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-5xl mx-auto space-y-8">
                      <div className="flex items-center justify-between gap-4 bg-muted/30 p-2 rounded-xl border border-border/40">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs hover:bg-background shadow-sm" onClick={() => setWizardStep("pick_viz")}>
                            <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                            Cambiar visualización
                          </Button>
                          <div className="h-4 w-[1px] bg-border" />
                          <div className="flex items-center gap-2 px-2">
                            <Layout className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-bold">{PIVOT_VIZ_OPTIONS.find(v => v.id === viz)?.label}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        {/* Zonas de Configuración */}
                        <div className="space-y-6">
                          {profile.showFilters && (
                            <DropZone title="Filtros" icon={FilterIcon} zone="filters" onDropField={onDropField} description="Filtros aplicados a este widget">
                              {filterFields.map((f, i) => (
                                <Badge key={f} variant="outline" className="gap-1.5 pr-1 h-7 text-[11px] bg-background shadow-sm border-primary/20">
                                  {f}
                                  <button type="button" className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" onClick={() => removeFrom("filters", i)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </DropZone>
                          )}
                          
                          {filterFields.map((field) => (
                            <div key={field} className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opciones: {field}</p>
                              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                {uniquePivotDimensionValues(rows, field, dateFieldsMeta, fieldDateGranularity).map((v) => {
                                  const sel = filterSelections[field];
                                  const active = sel === undefined ? true : sel.includes(v);
                                  return (
                                    <label key={v} className="flex items-center gap-2.5 text-[11px] cursor-pointer hover:bg-background p-1.5 rounded-lg transition-colors group">
                                      <Checkbox
                                        className="h-4 w-4 rounded-md border-muted-foreground/30"
                                        checked={active}
                                        onCheckedChange={(c) => toggleFilterValue(field, v, c === true)}
                                      />
                                      <span className="truncate group-hover:text-primary transition-colors">{v || "(vacío)"}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {profile.showRows && (
                            <DropZone title="Ejes (Categorías)" icon={Layout} zone="rows" onDropField={onDropField} description="Eje principal del gráfico">
                              {rowFields.map((f, i) => (
                                <Badge key={`${f}-${i}`} variant="outline" className="gap-1.5 pr-1 h-7 text-[11px] bg-background shadow-sm border-primary/20">
                                  {f}
                                  <button type="button" className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" onClick={() => removeFrom("rows", i)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </DropZone>
                          )}

                          {profile.showCols && (
                            <DropZone title="Series (Leyenda)" icon={MousePointer2} zone="cols" onDropField={onDropField} description="Desglose adicional">
                              {colFields.map((f, i) => (
                                <Badge key={`${f}-${i}`} variant="outline" className="gap-1.5 pr-1 h-7 text-[11px] bg-background shadow-sm border-primary/20">
                                  {f}
                                  <button type="button" className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" onClick={() => removeFrom("cols", i)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </DropZone>
                          )}
                        </div>

                        <div className="space-y-6">
                          {profile.showValues && (
                            <DropZone title="Métricas (Valores)" icon={Calculator} zone="values" onDropField={onDropField} description="Datos numéricos agregados">
                              <div className="w-full flex justify-end mb-2">
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary hover:bg-primary/5 rounded-full font-bold" onClick={() => setCalcOpen(true)}>
                                  <Plus className="h-3.5 w-3.5 mr-1" />
                                  Nueva métrica
                                </Button>
                              </div>
                              <div className="grid gap-3 w-full">
                                {measures.map((m, i) => (
                                  <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-border/80 bg-background p-4 text-[11px] shadow-sm hover:border-primary/40 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                          <Hash className="h-3 w-3 text-emerald-600" />
                                        </div>
                                        <span className="font-bold text-foreground truncate">{m.kind === "field" ? m.field : m.label}</span>
                                      </div>
                                      <button type="button" className="p-1 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground" onClick={() => removeFrom("values", i)}>
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                      {m.kind === "field" && (
                                        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg">
                                          <span className="text-[9px] uppercase font-bold text-muted-foreground px-2">Cálculo</span>
                                          <Select value={m.aggregation} onValueChange={(v) => updateMeasure(m.id, { aggregation: v as AggFn })}>
                                            <SelectTrigger className="h-7 text-[10px] border-none shadow-none bg-transparent hover:bg-background/50">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {AGG_OPTIONS.map((o) => (
                                                <SelectItem key={o.v} value={o.v} className="text-xs">{o.l}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg">
                                        <span className="text-[9px] uppercase font-bold text-muted-foreground px-2">Mostrar</span>
                                        <Select value={m.showAs} onValueChange={(v) => updateMeasure(m.id, { showAs: v as ShowAs })}>
                                          <SelectTrigger className="h-7 text-[10px] border-none shadow-none bg-transparent hover:bg-background/50">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {SHOW_AS_OPTIONS.map((s) => (
                                              <SelectItem key={s} value={s} className="text-xs">{showAsLabel(s)}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </DropZone>
                          )}

                          {usedDateFields.length > 0 && profile.showDateGranularity && (
                            <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <p className="text-[11px] uppercase tracking-wider font-bold text-foreground/80">Segmentación de Fechas</p>
                              </div>
                              <div className="grid gap-2">
                                {usedDateFields.map((field) => (
                                  <div key={field} className="flex items-center justify-between gap-4 bg-background/60 p-3 rounded-xl border border-border/40">
                                    <Label className="text-[11px] font-mono truncate text-muted-foreground">{field}</Label>
                                    <Select
                                      value={fieldDateGranularity[field] ?? "raw"}
                                      onValueChange={(v) => setFieldDateGranularity((p) => ({ ...p, [field]: v as DateGranularity }))}
                                    >
                                      <SelectTrigger className="h-8 w-[140px] text-xs border-none shadow-none bg-muted/50 hover:bg-muted font-medium">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(Object.keys(DATE_GRANULARITY_LABELS) as DateGranularity[]).map((g) => (
                                          <SelectItem key={g} value={g} className="text-xs">{DATE_GRANULARITY_LABELS[g]}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preview / Chart */}
                      {grid && measures.length > 0 && (
                        <div className="space-y-4">
                           <div className="flex items-center gap-2 px-1">
                             <BarChart className="h-4 w-4 text-primary" />
                             <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Previsualización en tiempo real</h4>
                           </div>
                           <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm overflow-hidden min-h-[300px] flex flex-col items-center justify-center">
                              {viz === "table" ? (
                                <div className="w-full overflow-auto">
                                  <PivotTableView grid={grid} measures={measures} />
                                </div>
                              ) : isCustomCardViz(viz) && chartMeasureId ? (
                                <div className="flex flex-col items-center justify-center gap-4 text-center">
                                   {viz === "card" ? (
                                     <h2 className="text-5xl font-black tabular-nums tracking-tighter" style={{ color: appearance.primaryColor }}>
                                       {grandTotalMeasure(grid, chartMeasureId).toLocaleString("es")}
                                     </h2>
                                   ) : (
                                     <div className="h-40 w-40 rounded-full border-8 border-primary/20 flex items-center justify-center">
                                        <span className="text-3xl font-bold">{grandTotalMeasure(grid, chartMeasureId).toLocaleString("es")}</span>
                                     </div>
                                   )}
                                   <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{measures.find(m => m.id === chartMeasureId)?.label ?? "Métrica"}</p>
                                </div>
                              ) : chartOption ? (
                                <ReactECharts option={chartOption} style={{ height: 320, width: "100%" }} notMerge lazyUpdate />
                              ) : (
                                <p className="text-sm text-muted-foreground italic">Configura ejes y métricas para ver el gráfico</p>
                              )}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          /* Versión Sidebar (Compacta) */
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 pb-24">
               <p className="text-xs text-muted-foreground italic text-center p-8 bg-muted/20 rounded-xl border border-dashed border-border">
                 El constructor lateral es limitado. Pulsa <strong>Maximizar</strong> o abre desde el botón principal para ver el editor completo.
               </p>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer Fijo con Acciones Principales */}
      <div className="px-6 py-5 border-t border-border bg-background/80 backdrop-blur-md flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-2">
           {wizardStep === "configure" && (
             <Button variant="ghost" size="sm" className="h-10 gap-2 text-xs font-bold px-4 hover:bg-muted" onClick={() => setWizardStep("pick_viz")}>
               <ChevronDown className="h-4 w-4 rotate-90" />
               Atrás
             </Button>
           )}
        </div>
        <div className="flex items-center gap-3">
          {boardWidgetId && onCancelBoardEdit && (
            <Button variant="ghost" size="sm" className="h-10 px-5 text-xs font-bold text-muted-foreground hover:text-foreground" onClick={onCancelBoardEdit}>
              Cancelar
            </Button>
          )}
          {boardWidgetId && onUpdateBoardWidget ? (
            <Button
              size="sm"
              variant="default"
              className="h-10 px-8 gap-2 gradient-primary shadow-lg shadow-primary/20 font-black uppercase tracking-wider text-[10px]"
              onClick={handleUpdateBoardWidget}
              disabled={!rows.length || !measures.length || boardSavePending}
            >
              {boardSavePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              {boardSavePending ? "Guardar cambios" : "Guardar cambios"}
            </Button>
          ) : onAddToBoard && (
            <Button
              size="sm"
              variant="default"
              className="h-10 px-8 gap-2 gradient-primary shadow-lg shadow-primary/20 font-black uppercase tracking-wider text-[10px]"
              onClick={handleAddToBoard}
              disabled={!rows.length || !measures.length}
            >
              <Plus className="h-4 w-4" />
              Añadir al tablero
            </Button>
          )}
        </div>
      </div>

      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva medida calculada</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={calcLabel} onChange={(e) => setCalcLabel(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operación</Label>
              <Select value={calcOp} onValueChange={(v) => setCalcOp(v as CalcOp)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALC_OPS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Medida A</Label>
                <Select value={calcLeft} onValueChange={setCalcLeft}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Elegir" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldMeasures.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.field} ({m.aggregation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medida B</Label>
                <Select value={calcRight} onValueChange={setCalcRight}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Elegir" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldMeasures.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.field} ({m.aggregation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addCalculated}>Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

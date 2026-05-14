import { useCallback, useEffect, useMemo, useState } from "react";
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
import { X, Loader2, RefreshCw, GripVertical, BarChart3, Calculator, LayoutDashboard, ChevronDown, Palette } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchAllIntegrationRows } from "./fetch-integration-table";
import { getDefaultLeadsInitialRange } from "@/lib/integration-rows-cache";
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
  zone,
  children,
  onDropField,
  className,
}: {
  title: string;
  zone: Zone;
  children: React.ReactNode;
  onDropField: (zone: Zone, field: string) => void;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-muted/20 p-2 min-h-[72px] ${className ?? ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.getData(DRAG_TYPE);
        if (f) onDropField(zone, f);
      }}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [rowCount, setRowCount] = useState(0);
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
    setFilterFields([...initialConfig.filterFields]);
    setRowFields([...initialConfig.rowFields]);
    setColFields([...initialConfig.colFields]);
    setMeasures(JSON.parse(JSON.stringify(initialConfig.measures)) as PivotMeasureSpec[]);
    setViz(initialConfig.viz);
    setChartMeasureId(initialConfig.chartMeasureId);
    setFilterSelections({ ...initialConfig.filterSelections });
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

  const loadFullData = useCallback(async () => {
    setLoadingData(true);
    setRowCount(0);
    try {
      const initialRange = tableName === "leads" ? getDefaultLeadsInitialRange() : undefined;
      const data = await fetchAllIntegrationRows(supabase, tableName, (n) => setRowCount(n), hiddenDataColumns, undefined, undefined, 5000, initialRange);
      setRows(data);
      toast.success(`Datos cargados: ${data.length} filas${initialRange ? " · mes anterior + actual" : ""}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cargar";
      toast.error(msg);
      setRows([]);
    } finally {
      setLoadingData(false);
    }
  }, [tableName, hiddenDataColumns]);

  /** Al editar una vista guardada, cargar filas automáticamente (una vez por montaje). */
  useEffect(() => {
    if (!initialConfig || initialConfig.tableName !== tableName) return;
    void loadFullData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir edición (key por widget en el padre)
  }, []);

  const grid = useMemo(() => {
    if (!rows.length || !measures.length) return null;
    try {
      const filters: PivotFilter[] = [];
      for (const field of filterFields) {
        const all = uniquePivotDimensionValues(rows, field, dateFieldsMeta, fieldDateGranularity);
        const sel = filterSelections[field];
        if (sel === undefined) continue;
        if (sel.length === 0) {
          filters.push({ field, values: ["__sin_coincidencias__"] });
          continue;
        }
        if (sel.length >= all.length) continue;
        filters.push({ field, values: sel });
      }
      return buildPivotGrid(rows, {
        rowFields,
        colFields,
        filters,
        measures,
        dateFields: dateFieldsMeta,
        fieldDateGranularity,
      });
    } catch {
      return null;
    }
  }, [rows, rowFields, colFields, measures, filterFields, filterSelections, dateFieldsMeta, fieldDateGranularity]);

  const toggleFilterValue = (field: string, value: string, checked: boolean) => {
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

  const availableFields = visibleColMeta.map((c) => c.column_name);

  return (
    <aside
      className={cn(
        "flex flex-col w-full bg-card",
        layoutVariant === "sheet"
          ? "h-[min(85dvh,calc(100vh-5rem))] max-h-[85dvh] max-w-none border-0 shadow-none rounded-none"
          : "h-[calc(100vh-6rem)] max-w-[480px] border-l border-border shadow-xl",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Dashboard dinámico</p>
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-[10px] font-mono text-muted-foreground truncate">{tableName}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => loadFullData()} disabled={loadingData}>
            {loadingData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          {boardWidgetId && onCancelBoardEdit && (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={onCancelBoardEdit}>
              Cancelar
            </Button>
          )}
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

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {wizardStep === "pick_viz" ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Paso 1 · Tipo de visualización</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Elige primero el formato. Después verás solo los campos que aplican a ese tipo (estilo guiado, más simple que Power BI).
                </p>
              </div>
              <div className="space-y-4">
                {vizGroups.map(([group, opts]) => (
                  <div key={group}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {opts.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setViz(o.id);
                            setWizardStep("configure");
                          }}
                          className="text-left rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/40 px-3 py-2.5 transition-colors"
                        >
                          <span className="text-xs font-medium block">{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {wizardStep === "configure" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setWizardStep("pick_viz")}>
                  ← Cambiar tipo de visualización
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground rounded-md border border-border/80 bg-muted/20 px-2 py-1.5">
                {profile.descripcion}
              </p>

              {(onAddToBoard || boardWidgetId) && (
                <div className="rounded-lg border border-border p-2 space-y-2 bg-muted/10">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">En el tablero</p>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Título del widget</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder={displayName}
                      value={widgetTitle}
                      onChange={(e) => setWidgetTitle(e.target.value)}
                    />
                    <p className="text-[9px] text-muted-foreground">Si lo dejas vacío se usa el nombre de la vista.</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px]">Mostrar barra de título</Label>
                    <Switch checked={showWidgetHeader} onCheckedChange={setShowWidgetHeader} />
                  </div>
                  {!showWidgetHeader ? (
                    <p className="text-[9px] text-muted-foreground">
                      Queda una franja fina arriba para arrastrar el bloque en el tablero.
                    </p>
                  ) : null}
                </div>
              )}

              {colsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo columnas…
                </div>
              ) : (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Campos (arrastra a las zonas)</p>
                  <div className="flex flex-wrap gap-1">
                    {availableFields.map((f) => (
                      <Badge
                        key={f}
                        variant="secondary"
                        className="cursor-grab active:cursor-grabbing gap-1 font-mono text-[10px]"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, f)}
                      >
                        <GripVertical className="h-3 w-3 opacity-50" />
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="h-8" onClick={() => loadFullData()} disabled={loadingData}>
                  {loadingData ? `Cargando… ${rowCount}` : rows.length ? `Recargar (${rows.length} filas)` : "Cargar todos los datos"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1"
                  onClick={() => setCalcOpen(true)}
                  disabled={fieldMeasures.length < 2}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  Medida
                </Button>
                {boardWidgetId && onUpdateBoardWidget && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 gap-1"
                    onClick={handleUpdateBoardWidget}
                    disabled={!rows.length || !measures.length || boardSavePending}
                  >
                    {boardSavePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
                    {boardSavePending ? "Guardando…" : "Guardar cambios"}
                  </Button>
                )}
                {onAddToBoard && !boardWidgetId && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 gap-1"
                    onClick={handleAddToBoard}
                    disabled={!rows.length || !measures.length}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Añadir al tablero
                  </Button>
                )}
              </div>

              {profile.showFilters ? (
                <DropZone title="Filtros (opcional)" zone="filters" onDropField={onDropField}>
            {filterFields.map((f, i) => (
              <Badge key={f} variant="outline" className="gap-1 pr-1">
                {f}
                <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => removeFrom("filters", i)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
                </DropZone>
              ) : null}

              {profile.showFilters
                ? filterFields.map((field) => (
            <div key={field} className="rounded-md border border-border p-2 space-y-1.5">
              <p className="text-xs font-medium">Valores de filtro: {field}</p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {rows.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">Carga datos para elegir valores</p>
                ) : (
                  uniquePivotDimensionValues(rows, field, dateFieldsMeta, fieldDateGranularity).map((v) => {
                    const all = uniquePivotDimensionValues(rows, field, dateFieldsMeta, fieldDateGranularity);
                    const sel = filterSelections[field];
                    const active = sel === undefined ? true : sel.includes(v);
                    return (
                      <label key={v} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <Checkbox
                          checked={active}
                          onCheckedChange={(c) => toggleFilterValue(field, v, c === true)}
                        />
                        <span className="truncate">{v || "(vacío)"}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
                  ))
                : null}

              {profile.showCols ? (
                <DropZone title="Columnas (series / desglose)" zone="cols" onDropField={onDropField}>
            {colFields.map((f, i) => (
              <Badge key={`${f}-${i}`} variant="outline" className="gap-1 pr-1">
                {f}
                <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => removeFrom("cols", i)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
                </DropZone>
              ) : null}

              {profile.showRows ? (
                <DropZone title="Filas (categorías / eje)" zone="rows" onDropField={onDropField}>
            {rowFields.map((f, i) => (
              <Badge key={`${f}-${i}`} variant="outline" className="gap-1 pr-1">
                {f}
                <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => removeFrom("rows", i)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
                </DropZone>
              ) : null}

              {usedDateFields.length > 0 && profile.showDateGranularity ? (
            <div className="rounded-lg border border-border p-2 space-y-2 bg-muted/10">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fechas en filas / columnas / filtros</p>
              <p className="text-[10px] text-muted-foreground">
                Solo día (sin hora) o agrupa por día, mes, año, trimestre o semana ISO.
              </p>
              {usedDateFields.map((field) => (
                <div key={field} className="flex items-center gap-2">
                  <Label className="text-[10px] w-24 shrink-0 truncate font-mono">{field}</Label>
                  <Select
                    value={fieldDateGranularity[field] ?? "raw"}
                    onValueChange={(v) =>
                      setFieldDateGranularity((p) => ({ ...p, [field]: v as DateGranularity }))
                    }
                  >
                    <SelectTrigger className="h-7 text-[10px] flex-1 min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DATE_GRANULARITY_LABELS) as DateGranularity[]).map((g) => (
                        <SelectItem key={g} value={g} className="text-xs">
                          {DATE_GRANULARITY_LABELS[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
              ) : null}

              {profile.showValues ? (
                <DropZone title="Valores (medidas)" zone="values" onDropField={onDropField}>
            {measures.map((m, i) => (
              <div key={m.id} className="flex flex-col gap-1 rounded-md border bg-background p-1.5 text-[10px] min-w-[140px]">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate">
                    {m.kind === "field" ? m.field : m.label}
                  </span>
                  <button type="button" className="shrink-0 rounded p-0.5 hover:bg-muted" onClick={() => removeFrom("values", i)}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {m.kind === "field" && (
                  <Select value={m.aggregation} onValueChange={(v) => updateMeasure(m.id, { aggregation: v as AggFn })}>
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGG_OPTIONS.map((o) => (
                        <SelectItem key={o.v} value={o.v} className="text-xs">
                          {o.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={m.showAs} onValueChange={(v) => updateMeasure(m.id, { showAs: v as ShowAs })}>
                  <SelectTrigger className="h-7 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOW_AS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {showAsLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
                </DropZone>
              ) : null}

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <Select value={viz} onValueChange={(v) => setViz(v as PivotVizType)}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {PIVOT_VIZ_OPTIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {profile.showChartMeasurePicker && viz !== "table" && measures.length > 0 ? (
                  <Select value={chartMeasureId} onValueChange={setChartMeasureId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Medida en el gráfico" />
                    </SelectTrigger>
                    <SelectContent>
                      {measures.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.kind === "field" ? `${m.field} (${m.aggregation})` : m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              <Collapsible className="rounded-lg border border-border px-2 py-1.5">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-xs font-medium py-1">
                  <span className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    Apariencia del widget
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2 pb-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Color principal</Label>
                      <Input
                        type="color"
                        className="h-8 p-1 cursor-pointer"
                        value={appearance.primaryColor ?? "#3b82f6"}
                        onChange={(e) => setAppearance((a) => ({ ...a, primaryColor: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Color secundario</Label>
                      <Input
                        type="color"
                        className="h-8 p-1 cursor-pointer"
                        value={appearance.secondaryColor ?? "#e2e8f0"}
                        onChange={(e) => setAppearance((a) => ({ ...a, secondaryColor: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fondo del gráfico (hex opcional)</Label>
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder="#ffffff o vacío"
                      value={appearance.backgroundColor ?? ""}
                      onChange={(e) =>
                        setAppearance((a) => ({ ...a, backgroundColor: e.target.value.trim() || undefined }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Radio del contenedor (px)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-xs"
                      value={appearance.borderRadiusPx ?? ""}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setAppearance((a) => ({
                          ...a,
                          borderRadiusPx: Number.isFinite(n) ? n : undefined,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Paleta series (hex separados por coma)</Label>
                    <Input
                      className="h-8 text-xs font-mono"
                      placeholder="#2563eb, #10b981, #f59e0b"
                      value={accentPaletteText}
                      onChange={(e) => setAccentPaletteText(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px]">Mostrar leyenda</Label>
                    <Switch
                      checked={appearance.showLegend !== false}
                      onCheckedChange={(c) => setAppearance((a) => ({ ...a, showLegend: c ? undefined : false }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px]">Líneas de rejilla</Label>
                    <Switch
                      checked={appearance.showGridLines !== false}
                      onCheckedChange={(c) => setAppearance((a) => ({ ...a, showGridLines: c ? undefined : false }))}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {grid && measures.length > 0 ? (
                <div
                  className="border border-border rounded-lg overflow-hidden"
                  style={{
                    borderRadius: appearance.borderRadiusPx != null ? appearance.borderRadiusPx : undefined,
                    backgroundColor: parseSafeHexColor(appearance.backgroundColor),
                  }}
                >
                  {viz === "table" ? (
                    <ScrollArea className="max-h-[320px]">
                      <PivotTableView grid={grid} measures={measures} />
                    </ScrollArea>
                  ) : isCustomCardViz(viz) && chartMeasureId ? (
                    <div
                      className="flex flex-col items-center justify-center p-6 min-h-[220px] gap-2 bg-card"
                      style={{
                        backgroundColor: parseSafeHexColor(appearance.backgroundColor) ?? undefined,
                      }}
                    >
                      {viz === "card" ? (
                        <p
                          className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight"
                          style={{ color: appearance.primaryColor }}
                        >
                          {grandTotalMeasure(grid, chartMeasureId).toLocaleString("es", { maximumFractionDigits: 2 })}
                        </p>
                      ) : (
                        (() => {
                          const gtot = grandTotalMeasure(grid, chartMeasureId);
                          const first = firstCellValue(grid, chartMeasureId);
                          const pct = gtot > 0 ? Math.min(100, Math.round((first / gtot) * 100)) : 0;
                          const fill = appearance.primaryColor ?? undefined;
                          const base = appearance.secondaryColor ?? undefined;
                          return (
                            <div
                              className="relative flex h-36 w-36 items-center justify-center rounded-full"
                              style={{
                                background: `conic-gradient(${fill ?? "hsl(var(--primary))"} ${pct * 3.6}deg, ${base ?? "hsl(var(--muted))"} 0deg)`,
                              }}
                            >
                              <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-card text-center">
                                <span className="text-lg font-bold tabular-nums">{gtot.toLocaleString("es", { maximumFractionDigits: 1 })}</span>
                                <span className="text-[10px] text-muted-foreground">primera fila {pct}% del total</span>
                              </div>
                            </div>
                          );
                        })()
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {measures.find((m) => m.id === chartMeasureId)?.kind === "field"
                          ? measures.find((m) => m.id === chartMeasureId)?.field
                          : measures.find((m) => m.id === chartMeasureId)?.label}
                      </span>
                    </div>
                  ) : chartOption ? (
                    <ReactECharts option={chartOption} style={{ height: 280, width: "100%" }} notMerge lazyUpdate />
                  ) : (
                    <p className="p-4 text-xs text-muted-foreground">Sin datos para graficar</p>
                  )}
                </div>
              ) : null}

              {!measures.length && rows.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Arrastra al menos un campo a <strong>Valores</strong> para ver resultados.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </ScrollArea>

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

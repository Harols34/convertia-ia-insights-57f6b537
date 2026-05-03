import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { format, parseISO, endOfISOWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Target,
  Sparkles,
  Activity,
  ChevronRight,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LeadRow, LeadsDashboardFilters } from "@/lib/dashboard-leads";
import {
  DASHBOARD_DEFAULT_CHART_DAYS,
  DASHBOARD_DEFAULT_WEEK_BARS,
  filterTokenFromChartLabel,
} from "@/lib/dashboard-leads";
import {
  buildDailySeries,
  buildWeeklySeries,
  compareLast7VsPrevious7,
  compareThisWeekVsLastWeek,
  funnelStages,
  leadsByWeekday,
  discoverDimensions,
  agentEffectivenessRows,
  insightBullets,
  sparklineFromDaily,
  countByKey,
  comparisonLineAlignedToDailySpec,
  weeklyPreviousWeekLine,
  COMPARISON_MODE_META,
  COMPARISON_METRIC_META,
  type ComparisonMetric,
  type ComparativeSeriesSpec,
  type DailyComparisonOverlayMode,
  type DailyPoint,
  type DiscoveredDimension,
} from "@/lib/dashboard-leads-analytics";
import type { DashboardExecutiveData } from "@/lib/dashboard-executive-rpc";
import React from "react";
import { ComparativaControlsProvider } from "@/contexts/ComparativaControlsContext";
import { ComparativaDashboardSection } from "./ComparativaDashboardSection";
import { EXEC, type TimeViz, type CatViz } from "./dashboard-chart-theme";
import {
  dynamicTimeSeriesOption,
  weeklyBarsOption,
  categoryOption,
  funnelOption,
  gaugeConversionOption,
  statsByWeekdayOption,
  statsByCategoryOption,
  agentComboOption,
  sparklineOption,
} from "./dashboard-chart-options";
import { FilteredChartSection } from "./FilteredChartSection";
import { GlassCard } from "./GlassCard";
import { KpiCard } from "./KpiCard";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export type ExecutiveDashboardBodyProps = {
  leads: LeadRow[];
  /** Agregados vía RPC (rápido). Si está presente, se usan para KPIs y gráficos fijos. */
  rpcData?: DashboardExecutiveData | null;
  /** True mientras se descarga el dataset al cliente para la sección Comparativa. */
  isLeadsLoading?: boolean;
  /** Aún no se ha iniciado la descarga del dataset (carga perezosa bajo demanda). */
  comparativeDatasetIdle?: boolean;
  /** Inicia la descarga del universo de filas (columnas mínimas) para comparativas. */
  onRequestComparativeDataset?: () => void;
  /** Fila consecutivas leídas durante la descarga (feedback en UI). */
  comparativeRowsLoadedProgress?: number;
  /** Error al descargar el dataset para la comparativa. */
  comparativeDatasetErrorMessage?: string | null;
  /** Filtrado cruzado tipo Power BI: clic en categorías de gráficos. */
  onCrossFilter?: (payload: { column: keyof LeadRow; token: string }) => void;
  onFilterByDate?: (isoDay: string) => void;
  onFilterByWeekRange?: (desde: string, hasta: string) => void;
  /** Fechas del panel: usadas al anclar la comparativa a «filtros del panel». */
  filterDesde?: string;
  filterHasta?: string;
  /**
   * Vista inicial sin rango de fechas ni dimensiones: KPIs/rankings con histórico completo;
   * evolución diaria/semanal recortada visualmente a ~15 días.
   */
  isDefaultUnfilteredView?: boolean;
  /** totalLeads del bloque fijo (RPC) para avisar si el cliente y la ventana de la comparativa se contradicen. */
  kpiTotalLeadsFromRpc?: number;
  /** Opciones de dimensiones cargadas vía RPC (para popovers y explorador si no hay leads). */
  dimensionOptions?: Partial<Record<keyof LeadRow, string[]>>;
  /** Filtros completos del panel (usados en peticiones RPC del explorador). */
  filters?: LeadsDashboardFilters;
};

function DeltaText({ pct, label = "% vs periodo ant." }: { pct: number; label?: string }) {
  if (!Number.isFinite(pct)) {
    return <span className="text-[11px] text-muted-foreground tabular-nums">— {label}</span>;
  }
  const up = pct >= 0;
  return (
    <span className={cn("text-[11px] font-semibold tabular-nums", up ? "text-emerald-600" : "text-rose-600")}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% {label}
    </span>
  );
}


function MiniSpark({ values }: { values: number[] }) {
  const opt = useMemo(() => sparklineOption(values, EXEC.teal), [values]);
  if (values.length < 2) return <div className="h-10 w-full opacity-30" />;
  return <ReactECharts option={opt} style={{ height: 40, width: "100%" }} notMerge lazyUpdate />;
}

function comparisonMetricToSpec(m: ComparisonMetric): ComparativeSeriesSpec {
  if (m === "leads") return { kind: "leads" };
  if (m === "ventas") return { kind: "ventas" };
  return { kind: "efectividad" };
}

const ExecutiveDashboardBodyInner = React.memo(function ExecutiveDashboardBodyInner({
  leads,
  rpcData,
  isLeadsLoading = false,
  comparativeDatasetIdle = false,
  onRequestComparativeDataset,
  comparativeRowsLoadedProgress = 0,
  comparativeDatasetErrorMessage = null,
  onCrossFilter,
  onFilterByDate,
  onFilterByWeekRange,
  filterDesde,
  filterHasta,
  isDefaultUnfilteredView = false,
  kpiTotalLeadsFromRpc,
  dimensionOptions,
  filters,
}: ExecutiveDashboardBodyProps) {
  const comparativeSentinelRef = useRef<HTMLDivElement | null>(null);
  const comparativeRequestedRef = useRef(false);
  const triggerComparativeLoad = useCallback(() => {
    if (comparativeRequestedRef.current) return;
    if (!onRequestComparativeDataset) return;
    comparativeRequestedRef.current = true;
    onRequestComparativeDataset();
  }, [onRequestComparativeDataset]);

  useEffect(() => {
    if (!comparativeDatasetIdle || !onRequestComparativeDataset) return;
    const el = comparativeSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            triggerComparativeLoad();
            break;
          }
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0.02 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [comparativeDatasetIdle, onRequestComparativeDataset, triggerComparativeLoad]);
  const [timeVizDaily, setTimeVizDaily] = useState<TimeViz>("area");
  const [timeVizWeekly, setTimeVizWeekly] = useState<TimeViz>("combo");
  const [exploreIdx, setExploreIdx] = useState(0);
  const [exploreViz, setExploreViz] = useState<CatViz>("donut");

  const [gaugeMax, setGaugeMax] = useState<20 | 30 | 50 | 100>(100);
  const [dailyOverlay, setDailyOverlay] = useState<DailyComparisonOverlayMode>("off");
  /** Misma métrica para la serie principal (línea/área/barras) y para la línea de comparación. */
  const [dailyMetric, setDailyMetric] = useState<ComparisonMetric>("leads");
  const [weekCompare, setWeekCompare] = useState<"off" | "prev">("off");
  const [weekCompareField, setWeekCompareField] = useState<"leads" | "ventas">("leads");

  const [compSectionOpen, setCompSectionOpen] = useState(true);
  const [fixedSectionOpen, setFixedSectionOpen] = useState(true);

  const daily = useMemo((): DailyPoint[] => {
    if (rpcData?.daily?.length) {
      return rpcData.daily.map((d) => ({
        date: d.date,
        leads: d.leads,
        ventas: d.ventas,
        conGestion: 0,
        conNegocio: 0,
      }));
    }
    return buildDailySeries(leads, 120);
  }, [leads, rpcData]);

  /** Serie mostrada en evolución diaria/semanal: en vista sin filtros, solo los últimos N días (KPIs siguen globales). */
  const dailyForCharts = useMemo(() => {
    if (!isDefaultUnfilteredView) return daily;
    if (daily.length <= DASHBOARD_DEFAULT_CHART_DAYS) return daily;
    return daily.slice(-DASHBOARD_DEFAULT_CHART_DAYS);
  }, [daily, isDefaultUnfilteredView]);

  const weekly = useMemo(() => {
    if (rpcData?.weekly?.length) return rpcData.weekly;
    return buildWeeklySeries(leads, 20);
  }, [leads, rpcData]);

  const weeklyForCharts = useMemo(() => {
    if (!isDefaultUnfilteredView) return weekly;
    if (weekly.length <= DASHBOARD_DEFAULT_WEEK_BARS) return weekly;
    return weekly.slice(-DASHBOARD_DEFAULT_WEEK_BARS);
  }, [weekly, isDefaultUnfilteredView]);

  const analisisFijoFechasLinea = useMemo(() => {
    const fDesde = filterDesde?.trim();
    const fHasta = filterHasta?.trim();
    if (fDesde && fHasta) {
      return `Filtro del panel: desde ${fDesde} · hasta ${fHasta} (mismo criterio que pide el RPC al servidor para KPIs, embudo, evolución, etc.).`;
    }
    if (fDesde) return `Filtro del panel: desde ${fDesde} (hasta: sin fijar en el panel).`;
    if (fHasta) return `Filtro del panel: hasta ${fHasta} (desde: sin fijar en el panel).`;
    if (isDefaultUnfilteredView) {
      return `Sin rango de fechas en el panel: KPIs, embudo y rankings usan todo el histórico; la evolución diaria y semanal muestran solo los últimos ${DASHBOARD_DEFAULT_CHART_DAYS} días (o ~${DASHBOARD_DEFAULT_WEEK_BARS} semanas ISO) para lectura rápida.`;
    }
    return "Serie temporal alineada al corte actual (incluye filtros de dimensión u “es venta”).";
  }, [filterDesde, filterHasta, isDefaultUnfilteredView]);

  const evolucionRangoMuestras = useMemo(() => {
    if (dailyForCharts.length === 0) return null;
    const d0 = dailyForCharts[0]!.date;
    const d1 = dailyForCharts[dailyForCharts.length - 1]!.date;
    return {
      d0: format(parseISO(d0), "d MMM yyyy", { locale: es }),
      d1: format(parseISO(d1), "d MMM yyyy", { locale: es }),
    };
  }, [dailyForCharts]);

  const cmp7 = useMemo(() => {
    if (rpcData) return rpcData.cmp7;
    return compareLast7VsPrevious7(leads);
  }, [leads, rpcData]);

  const cmpW = useMemo(() => {
    if (rpcData) {
      return { total: rpcData.cmpWeek.total } as ReturnType<typeof compareThisWeekVsLastWeek>;
    }
    return compareThisWeekVsLastWeek(leads);
  }, [leads, rpcData]);

  const funnel = useMemo(() => {
    if (rpcData) return rpcData.funnel;
    return funnelStages(leads).map((s) => ({ name: s.name, value: s.value }));
  }, [leads, rpcData]);

  const weekday = useMemo(() => {
    if (rpcData) return rpcData.weekday;
    return leadsByWeekday(leads);
  }, [leads, rpcData]);

  const discovered = useMemo((): DiscoveredDimension[] => {
    if (rpcData) {
      return rpcData.discovered.map((d) => ({
        key: d.key,
        label: d.label,
        cardinality: d.top.length,
        top: d.top,
      }));
    }
    return discoverDimensions(leads);
  }, [leads, rpcData]);

  useEffect(() => {
    setExploreIdx((i) => (discovered.length === 0 ? 0 : Math.min(i, discovered.length - 1)));
  }, [discovered.length]);

  const agents = useMemo(() => {
    if (rpcData) return rpcData.agents;
    return agentEffectivenessRows(leads);
  }, [leads, rpcData]);

  const bullets = useMemo(() => {
    if (rpcData) return rpcData.bullets;
    return insightBullets(leads, cmp7);
  }, [rpcData, leads, cmp7]);

  const kpis = useMemo(() => {
    if (rpcData) return rpcData.kpis;
    const totalLeads = leads.length;
    const totalVentas = leads.filter((l) => l.es_venta).length;
    return {
      totalLeads,
      totalVentas,
      convPct: totalLeads ? (totalVentas / totalLeads) * 100 : 0,
      conGestion: leads.filter((l) => l.result_prim_gestion && l.result_prim_gestion !== "").length,
      conNegocio: leads.filter((l) => l.result_negocio && l.result_negocio !== "").length,
    };
  }, [leads, rpcData]);

  const tasaVenta = kpis.convPct;
  const sparkTotal = useMemo(
    () => sparklineFromDaily(dailyForCharts, "leads", DASHBOARD_DEFAULT_CHART_DAYS),
    [dailyForCharts],
  );
  const sparkVentas = useMemo(
    () => sparklineFromDaily(dailyForCharts, "ventas", DASHBOARD_DEFAULT_CHART_DAYS),
    [dailyForCharts],
  );

  const dailyChartOpts = useMemo(() => {
    const base = timeVizDaily === "combo" ? {} : { primaryMetric: dailyMetric };
    if (dailyOverlay === "off" || timeVizDaily === "combo") {
      return { ...base };
    }
    const data = comparisonLineAlignedToDailySpec(
      leads,
      dailyForCharts,
      comparisonMetricToSpec(dailyMetric),
      dailyOverlay,
    );
    return {
      ...base,
      overlayLine: {
        name: `${COMPARISON_MODE_META[dailyOverlay].comparisonLegend} (${COMPARISON_METRIC_META[dailyMetric].short})`,
        data,
        isPercent: dailyMetric === "efectividad",
      },
    };
  }, [dailyOverlay, dailyMetric, dailyForCharts, leads, timeVizDaily]);

  const optDaily = useMemo(
    () => timeSeriesOption(dailyForCharts, timeVizDaily, "Tendencia diaria", dailyChartOpts),
    [dailyForCharts, timeVizDaily, dailyChartOpts],
  );

  const weekCompareOpts = useMemo(() => {
    if (weekCompare === "off") return undefined;
    return {
      compareLine: {
        name: `Semana ISO anterior (${weekCompareField})`,
        data: weeklyPreviousWeekLine(weeklyForCharts, weekCompareField),
      },
    };
  }, [weekCompare, weeklyForCharts, weekCompareField]);

  const optWeekly = useMemo(
    () => weeklyBarsOption(weeklyForCharts, timeVizWeekly, weekCompareOpts),
    [weeklyForCharts, timeVizWeekly, weekCompareOpts],
  );

  const optFunnel = useMemo(() => funnelOption(funnel.map((f) => ({ name: f.name, value: f.value }))), [funnel]);
  const optGauge = useMemo(
    () => gaugeConversionOption(tasaVenta, "Conversión a venta", gaugeMax),
    [tasaVenta, gaugeMax],
  );
  const optAgent = useMemo(() => agentComboOption(agents), [agents]);

  const explore = discovered[exploreIdx];
  const optExplore = useMemo(() => {
    if (!explore) return null;
    const m = exploreViz === "radar" && explore.top.length < 3 ? "bar" : exploreViz;
    return categoryOption(explore.top, m, explore.label);
  }, [explore, exploreViz]);

  const evAgent = useMemo(() => {
    if (!onCrossFilter) return undefined;
    return {
      click: (params: { name?: string }) => {
        const n = params.name;
        if (n == null || n === "") return;
        onCrossFilter({ column: "agente_prim_gestion", token: filterTokenFromChartLabel(n) });
      },
    };
  }, [onCrossFilter]);

  const evExplore = useMemo(() => {
    if (!explore || !onCrossFilter) return undefined;
    return {
      click: (params: { name?: string }) => {
        const n = params.name;
        if (n == null || n === "") return;
        onCrossFilter({ column: explore.key as keyof LeadRow, token: filterTokenFromChartLabel(n) });
      },
    };
  }, [explore, onCrossFilter]);

  const evDailyDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = dailyForCharts.map((d) => d.date);
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, dailyForCharts]);

  const evWeekly = useMemo(() => {
    if (!onFilterByWeekRange) return undefined;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= weeklyForCharts.length) return;
        const start = parseISO(weeklyForCharts[i]!.weekStart);
        const end = endOfISOWeek(start);
        onFilterByWeekRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
      },
    };
  }, [onFilterByWeekRange, weeklyForCharts]);

  const hasCross = Boolean(onCrossFilter || onFilterByDate || onFilterByWeekRange);

  const chartKey = useCallback(
    (base: string) =>
      `${base}-${isDefaultUnfilteredView ? "def" : "cut"}-${gaugeMax}-${dailyOverlay}-${dailyMetric}-${weekCompare}`,
    [isDefaultUnfilteredView, gaugeMax, dailyOverlay, dailyMetric, weekCompare],
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <Collapsible open={compSectionOpen} onOpenChange={setCompSectionOpen} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/25 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-display font-bold text-foreground tracking-tight">Análisis comparativo</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              KPIs, comparativas temporales y explorador por dimensión (modo comparación y ventana globales ahí).
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-2 text-xs">
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform", compSectionOpen && "rotate-180")}
              />
              {compSectionOpen ? "Ocultar" : "Mostrar"}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          className={cn(
            "space-y-6 md:space-y-8 overflow-hidden",
            !compSectionOpen && "hidden",
          )}
        >
          {hasCross && (
            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              Clic en barras, anillos o líneas temporales aplica filtros al tablero (como en Power BI). Usa &quot;Quitar
              filtros&quot; arriba para limpiar.
            </p>
          )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total leads"
          value={kpis.totalLeads}
          icon={Users}
          deltaPct={cmp7.total.deltaPct}
          deltaLabel="vs semana previa"
          sparklineData={sparkTotal}
          variant="default"
        />
        <KpiCard
          title="Ventas Facturadas"
          value={kpis.totalVentas}
          icon={TrendingUp}
          deltaPct={cmp7.ventas.deltaPct}
          deltaLabel="vs semana previa"
          sparklineData={sparkVentas}
          variant="success"
        />
        <KpiCard
          title="Conversión"
          value={kpis.totalLeads ? (kpis.totalVentas / kpis.totalLeads) * 100 : 0}
          format="percentage"
          icon={Target}
          deltaPct={cmp7.tasaVenta?.deltaPct}
          deltaLabel="vs semana previa"
          variant="purple"
        />
        <div className="flex flex-col gap-4">
          <KpiCard
            title="Con 1ª gestión"
            value={kpis.conGestion}
            icon={MessageSquare}
            subtitle={`${kpis.totalLeads ? ((kpis.conGestion / kpis.totalLeads) * 100).toFixed(1) : "0.0"}% del total`}
            variant="amber"
            className="flex-1"
          />
        </div>
      </div>

      {bullets.length > 0 && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-3 text-teal-700">
            <Sparkles className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-foreground">Hallazgos accionables</h3>
          </div>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-2 text-[13px] text-muted-foreground leading-snug"
              >
                <ChevronRight className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                {b}
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      )}

      {leads.length > 0 || (rpcData && (rpcData.daily.length > 0 || rpcData.kpis.totalLeads > 0)) ? (
        <>
          <ErrorBoundary name="Análisis Comparativo">
            <ComparativaDashboardSection
              leads={leads}
              onFilterByDate={onFilterByDate}
              onFilterByWeekRange={onFilterByWeekRange}
              filterDesde={filterDesde}
              filterHasta={filterHasta}
              rpcData={rpcData}
              kpiTotalLeadsFromRpc={kpiTotalLeadsFromRpc}
              comparativeDatasetIdle={comparativeDatasetIdle}
              isLeadsLoading={isLeadsLoading}
              comparativeRowsLoadedProgress={comparativeRowsLoadedProgress}
              onRequestComparativeDataset={onRequestComparativeDataset}
              dimensionOptions={dimensionOptions}
              dashboardFilters={filters}
            />
          </ErrorBoundary>
          {leads.length === 0 && comparativeDatasetIdle && onRequestComparativeDataset && (
            <GlassCard>
              <div ref={comparativeSentinelRef} className="h-1 w-full" aria-hidden="true" />
              <div className="text-center py-4 px-4 space-y-2 max-w-xl mx-auto">
                <p className="text-xs text-muted-foreground">
                  Estás viendo la comparativa con <strong>agregados del servidor</strong> (rápido). Para cortes finos por
                  agente, resultado o cualquier dimensión personalizada necesitas descargar el universo de leads.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={triggerComparativeLoad}>
                  Cargar dataset para cortes finos
                </Button>
              </div>
            </GlassCard>
          )}

        </>
      ) : comparativeDatasetIdle && onRequestComparativeDataset ? (
        <GlassCard>
          <div ref={comparativeSentinelRef} className="h-1 w-full" aria-hidden="true" />
          <div className="text-center py-8 px-4 space-y-3 max-w-md mx-auto">
            <p className="text-sm text-muted-foreground">
              El análisis comparativo usa el universo de leads <strong>en el navegador</strong> (más lento con mucho
              volumen). Carga bajo demanda: solo al pulsar o al entrar en esta sección, sin bloquear el resto del
              tablero.
            </p>
            <Button type="button" className="mt-1" onClick={triggerComparativeLoad}>
              Cargar análisis comparativo
            </Button>
            <p className="text-[10px] text-muted-foreground">También se inicia al desplazarte hasta aquí.</p>
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            {comparativeDatasetErrorMessage ? (
              <>
                <span className="text-destructive font-medium block mb-1">Error al descargar datos de comparativa</span>
                {comparativeDatasetErrorMessage}
              </>
            ) : isLeadsLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
                <p className="text-sm text-muted-foreground animate-pulse">Sincronizando información…</p>
              </div>
            ) : (
              "No hay leads en el universo actual para comparativas avanzadas, o aún no hay datos disponibles."
            )}
          </p>
        </GlassCard>
      )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={fixedSectionOpen} onOpenChange={setFixedSectionOpen} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/25 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-display font-bold text-foreground tracking-tight">Análisis fijo</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Evolución, embudo, ciudades, agentes y explorador automático de dimensiones.
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-2 text-xs">
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform", fixedSectionOpen && "rotate-180")}
              />
              {fixedSectionOpen ? "Ocultar" : "Mostrar"}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent
          className={cn("pt-1 space-y-4 overflow-hidden", !fixedSectionOpen && "hidden")}
        >
      <section className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground tracking-tight">
            Exploración y distribución
          </h2>
          <p className="text-[11px] text-muted-foreground mt-2 max-w-3xl space-y-1.5">
            <span className="block text-[10px] text-muted-foreground/90">
              Eso no tiene por qué coincidir con el eje de <strong>Comparativa</strong> (mismo dashboard): allí se elige
              una ventana fija de N días (7–28) y un anclaje; aquí se sigue el filtro y la serie agregada del RPC.
            </span>
          </p>
        </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 shadow-xl border-slate-200/60 overflow-hidden" noPad>
          <Tabs defaultValue="daily" className="w-full flex flex-col h-full">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Evolución Operativa</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Leads & Ventas</p>
                </div>
              </div>
              <TabsList className="h-9 bg-slate-200/50 p-1">
                <TabsTrigger value="daily" className="text-xs px-4">Diario</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs px-4">Semanal</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="daily" className="mt-0 p-5 flex-1 space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
                <Select value={dailyMetric} onValueChange={(v) => setDailyMetric(v as ComparisonMetric)}>
                  <SelectTrigger className="h-8 w-[140px] text-[10px] bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Métrica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="ventas">Ventas</SelectItem>
                    <SelectItem value="efectividad">Efectividad %</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeVizDaily} onValueChange={(v) => setTimeVizDaily(v as TimeViz)}>
                  <SelectTrigger className="h-8 w-[160px] text-[10px] bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Gráfico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Línea Suave</SelectItem>
                    <SelectItem value="area">Área / Tendencia</SelectItem>
                    <SelectItem value="bar">Barras Simples</SelectItem>
                    <SelectItem value="combo">Combinado L/V</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dailyOverlay} onValueChange={(v) => setDailyOverlay(v as DailyComparisonOverlayMode)}>
                  <SelectTrigger className="h-8 w-[180px] text-[10px] bg-indigo-50 border-indigo-100 text-indigo-700">
                    <SelectValue placeholder="Comparar vs..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Sin contraste</SelectItem>
                    <SelectItem value="prev_calendar_day">vs día anterior</SelectItem>
                    <SelectItem value="same_weekday_prev_week">vs −7 días</SelectItem>
                    <SelectItem value="avg_weekday_historical">vs prom. histórico</SelectItem>
                    <SelectItem value="same_dom_prev_month">vs mes anterior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="h-[320px] w-full">
                <ReactECharts
                  key={chartKey("daily")}
                  option={optDaily}
                  style={{ height: "100%", width: "100%" }}
                  notMerge
                  lazyUpdate
                  onEvents={evDailyDay}
                />
              </div>
            </TabsContent>

            <TabsContent value="weekly" className="mt-0 p-5 flex-1 space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
                <Select value={timeVizWeekly} onValueChange={(v) => setTimeVizWeekly(v as TimeViz)}>
                  <SelectTrigger className="h-8 w-[160px] text-[10px] bg-slate-50 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Líneas</SelectItem>
                    <SelectItem value="area">Área</SelectItem>
                    <SelectItem value="bar">Barras</SelectItem>
                    <SelectItem value="combo">Combinado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={weekCompare} onValueChange={(v) => setWeekCompare(v as "off" | "prev")}>
                  <SelectTrigger className="h-8 w-[180px] text-[10px] bg-indigo-50 border-indigo-100 text-indigo-700">
                    <SelectValue placeholder="Contrastar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Serie única</SelectItem>
                    <SelectItem value="prev">+ Semana anterior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-[320px] w-full">
                <ReactECharts
                  key={chartKey("weekly")}
                  option={optWeekly}
                  style={{ height: "100%", width: "100%" }}
                  notMerge
                  lazyUpdate
                  onEvents={evWeekly}
                />
              </div>
            </TabsContent>
          </Tabs>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard noPad className="flex flex-col shadow-xl border-slate-200/60 transition-all hover:shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">Efectividad</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Conversión Total</p>
                </div>
              </div>
              <Select value={String(gaugeMax)} onValueChange={(v) => setGaugeMax(Number(v) as 20 | 30 | 50 | 100)}>
                <SelectTrigger className="h-8 w-[90px] text-[10px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="30">30%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-h-[220px] p-4 bg-white flex items-center justify-center">
              <ReactECharts
                key={chartKey("gauge")}
                option={optGauge}
                style={{ height: 210, width: "100%" }}
                notMerge
                lazyUpdate
              />
            </div>
          </GlassCard>

          <GlassCard noPad className="flex flex-col shadow-xl border-slate-200/60 transition-all hover:shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">Embudo</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Flujo de Conversión</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white">
              <div className="h-[230px] w-full">
                <ReactECharts option={optFunnel} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <FilteredChartSection
          title="Rendimiento por Día de la Semana"
          leads={leads}
          dimension="weekday"
          filterColumns={[
            { key: "cliente", label: "Cliente" },
            { key: "categoria_mkt", label: "Categoría" },
            { key: "tipo_llamada", label: "Tipo" },
          ]}
          chartOptionBuilder={(data) => statsByWeekdayOption(data)}
        />
        <FilteredChartSection
          title="Rendimiento por Campaña de Marketing"
          leads={leads}
          dimension="campana_mkt"
          filterColumns={[
            { key: "cliente", label: "Cliente" },
            { key: "categoria_mkt", label: "Categoría" },
            { key: "tipo_llamada", label: "Tipo" },
          ]}
          chartOptionBuilder={(data, viz) => statsByCategoryOption(data, viz)}
        />
      </div>

      <div className="grid lg:grid-cols-1 gap-4 md:gap-6">
        <FilteredChartSection
          title="Análisis Geográfico: Distribución por Ciudad"
          leads={leads}
          dimension="ciudad"
          filterColumns={[
            { key: "cliente", label: "Cliente" },
            { key: "ciudad", label: "Ciudad", multi: true },
            { key: "categoria_mkt", label: "Categoría" },
          ]}
          chartOptionBuilder={(data, viz) => statsByCategoryOption(data, viz)}
        />
      </div>

      <div className="grid lg:grid-cols-1 gap-4 md:gap-6">
        <FilteredChartSection
          title="Desempeño Operativo de Agentes"
          leads={leads}
          dimension="agente_prim_gestion"
          filterColumns={[
            { key: "cliente", label: "Cliente" },
            { key: "agente_prim_gestion", label: "Agente", multi: true },
            { key: "categoria_mkt", label: "Categoría" },
          ]}
          chartOptionBuilder={(data, viz) => {
            if (viz === "combo" || !viz) {
              return agentComboOption(data.map(d => ({ name: d.name, value: d.leads, ventas: d.ventas })));
            }
            return statsByCategoryOption(data, viz);
          }}
          defaultViz="combo"
          vizOptions={[
            { value: "combo", label: "Leads + Ventas" },
            { value: "bar", label: "Solo Leads" },
            { value: "donut", label: "Distribución" },
          ]}
        />
      </div>

      {discovered.length > 0 && (
        <GlassCard noPad className="shadow-lg border-slate-200/60 overflow-hidden">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">Explorador Estratégico de Dimensiones</h3>
                <p className="text-[10px] text-muted-foreground font-medium">Análisis automático según cardinalidad de datos</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={String(exploreIdx)} onValueChange={(v) => setExploreIdx(Number(v))}>
                <SelectTrigger className="h-8 min-w-[200px] text-[10px] bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {discovered.map((d, i) => (
                    <SelectItem key={d.key} value={String(i)} className="text-xs">
                      {d.label} ({d.cardinality})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={exploreViz} onValueChange={(v) => setExploreViz(v as CatViz)}>
                <SelectTrigger className="h-8 w-[140px] text-[10px] bg-white border-slate-200">
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
          <div className="p-6 bg-white">
            {optExplore && (
              <ReactECharts
                option={optExplore}
                style={{ height: 380, width: "100%" }}
                notMerge
                lazyUpdate
                onEvents={evExplore}
              />
            )}
          </div>
        </GlassCard>
      )}
      </section>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});

export function ExecutiveDashboardBody(props: ExecutiveDashboardBodyProps) {
  return (
    <ComparativaControlsProvider>
      <ExecutiveDashboardBodyInner {...props} />
    </ComparativaControlsProvider>
  );
}

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
  ChevronRight,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/lib/dashboard-leads";
import { filterTokenFromChartLabel } from "@/lib/dashboard-leads";
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
import { ComparativaControlsProvider } from "@/contexts/ComparativaControlsContext";
import { ComparativaDashboardSection } from "./ComparativaDashboardSection";
import { EXEC, type TimeViz, type CatViz } from "./dashboard-chart-theme";
import {
  timeSeriesOption,
  weeklyBarsOption,
  categoryOption,
  funnelOption,
  gaugeConversionOption,
  weekdayBarsOption,
  cityGeoStyleOption,
  agentComboOption,
  sparklineOption,
} from "./dashboard-chart-options";

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
  /** totalLeads del bloque fijo (RPC) para avisar si el cliente y la ventana de la comparativa se contradicen. */
  kpiTotalLeadsFromRpc?: number;
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

const GlassCard = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    noPad?: boolean;
  }
>(({ children, className, noPad }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_rgba(15,23,42,0.07)]",
        !noPad && "p-4 md:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
});
GlassCard.displayName = "GlassCard";

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

function crossFilterHandlers(
  onCrossFilter: ExecutiveDashboardBodyProps["onCrossFilter"],
  column: keyof LeadRow,
): { click: (params: { name?: string }) => void } | undefined {
  if (!onCrossFilter) return undefined;
  return {
    click: (params: { name?: string }) => {
      const n = params.name;
      if (n == null || n === "") return;
      onCrossFilter({ column, token: filterTokenFromChartLabel(n) });
    },
  };
}

function ExecutiveDashboardBodyInner({
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
  kpiTotalLeadsFromRpc,
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
  const [campViz, setCampViz] = useState<CatViz>("bar");
  const [cityViz, setCityViz] = useState<CatViz>("bar_h");
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

  const analisisFijoFechasLinea = useMemo(() => {
    const fDesde = filterDesde?.trim();
    const fHasta = filterHasta?.trim();
    if (fDesde && fHasta) {
      return `Filtro del panel: desde ${fDesde} · hasta ${fHasta} (mismo criterio que pide el RPC al servidor para KPIs, embudo, evolución, etc.).`;
    }
    if (fDesde) return `Filtro del panel: desde ${fDesde} (hasta: sin fijar en el panel).`;
    if (fHasta) return `Filtro del panel: hasta ${fHasta} (desde: sin fijar en el panel).`;
    return "Sin límite explícito desde/hasta en el panel: el backend usa su ventana por defecto; la serie se acota a los días con datos (hasta 120 puntos en el cliente).";
  }, [filterDesde, filterHasta]);

  const evolucionRangoMuestras = useMemo(() => {
    if (daily.length === 0) return null;
    const d0 = daily[0]!.date;
    const d1 = daily[daily.length - 1]!.date;
    return {
      d0: format(parseISO(d0), "d MMM yyyy", { locale: es }),
      d1: format(parseISO(d1), "d MMM yyyy", { locale: es }),
    };
  }, [daily]);

  const weekly = useMemo(() => {
    if (rpcData?.weekly?.length) return rpcData.weekly;
    return buildWeeklySeries(leads, 20);
  }, [leads, rpcData]);

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

  const porCampana = useMemo(() => {
    if (rpcData) return rpcData.porCampana;
    return countByKey(leads, "campana_mkt").slice(0, 12);
  }, [leads, rpcData]);

  const porCiudad = useMemo(() => {
    if (rpcData) return rpcData.porCiudad;
    return countByKey(leads, "ciudad");
  }, [leads, rpcData]);

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
  const sparkTotal = useMemo(() => sparklineFromDaily(daily, "leads", 14), [daily]);
  const sparkVentas = useMemo(() => sparklineFromDaily(daily, "ventas", 14), [daily]);

  const dailyChartOpts = useMemo(() => {
    const base = timeVizDaily === "combo" ? {} : { primaryMetric: dailyMetric };
    if (dailyOverlay === "off" || timeVizDaily === "combo") {
      return { ...base };
    }
    const data = comparisonLineAlignedToDailySpec(leads, daily, comparisonMetricToSpec(dailyMetric), dailyOverlay);
    return {
      ...base,
      overlayLine: {
        name: `${COMPARISON_MODE_META[dailyOverlay].comparisonLegend} (${COMPARISON_METRIC_META[dailyMetric].short})`,
        data,
        isPercent: dailyMetric === "efectividad",
      },
    };
  }, [dailyOverlay, dailyMetric, daily, leads, timeVizDaily]);

  const optDaily = useMemo(
    () => timeSeriesOption(daily, timeVizDaily, "Tendencia diaria", dailyChartOpts),
    [daily, timeVizDaily, dailyChartOpts],
  );

  const weekCompareOpts = useMemo(() => {
    if (weekCompare === "off") return undefined;
    return {
      compareLine: {
        name: `Semana ISO anterior (${weekCompareField})`,
        data: weeklyPreviousWeekLine(weekly, weekCompareField),
      },
    };
  }, [weekCompare, weekly, weekCompareField]);

  const optWeekly = useMemo(
    () => weeklyBarsOption(weekly, timeVizWeekly, weekCompareOpts),
    [weekly, timeVizWeekly, weekCompareOpts],
  );

  const optFunnel = useMemo(() => funnelOption(funnel.map((f) => ({ name: f.name, value: f.value }))), [funnel]);
  const optGauge = useMemo(
    () => gaugeConversionOption(tasaVenta, "Conversión a venta", gaugeMax),
    [tasaVenta, gaugeMax],
  );
  const optWeekday = useMemo(() => weekdayBarsOption(weekday), [weekday]);
  const optCity = useMemo(() => cityGeoStyleOption(porCiudad, "Distribución por ciudad"), [porCiudad]);
  const optCamp = useMemo(() => categoryOption(porCampana, campViz, "Campaña MKT"), [porCampana, campViz]);
  const optAgent = useMemo(() => agentComboOption(agents), [agents]);
  const optCityCategory = useMemo(
    () => categoryOption(porCiudad.slice(0, 12), cityViz, "Top ciudades"),
    [porCiudad, cityViz],
  );

  const explore = discovered[exploreIdx];
  const optExplore = useMemo(() => {
    if (!explore) return null;
    const m = exploreViz === "radar" && explore.top.length < 3 ? "bar" : exploreViz;
    return categoryOption(explore.top, m, explore.label);
  }, [explore, exploreViz]);

  const evCamp = useMemo(() => crossFilterHandlers(onCrossFilter, "campana_mkt"), [onCrossFilter]);
  const evCity = useMemo(() => crossFilterHandlers(onCrossFilter, "ciudad"), [onCrossFilter]);
  const evCityCat = useMemo(() => crossFilterHandlers(onCrossFilter, "ciudad"), [onCrossFilter]);
  const evAgent = useMemo(() => crossFilterHandlers(onCrossFilter, "agente_prim_gestion"), [onCrossFilter]);
  const evExplore = useMemo(
    () => (explore && onCrossFilter ? crossFilterHandlers(onCrossFilter, explore.key) : undefined),
    [explore, onCrossFilter],
  );

  const evDailyDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = daily.map((d) => d.date);
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, daily]);

  const evWeekly = useMemo(() => {
    if (!onFilterByWeekRange) return undefined;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= weekly.length) return;
        const start = parseISO(weekly[i]!.weekStart);
        const end = endOfISOWeek(start);
        onFilterByWeekRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
      },
    };
  }, [onFilterByWeekRange, weekly]);

  const hasCross = Boolean(onCrossFilter || onFilterByDate || onFilterByWeekRange);

  const chartKey = useCallback(
    (base: string) => `${base}-${gaugeMax}-${dailyOverlay}-${dailyMetric}-${weekCompare}`,
    [gaugeMax, dailyOverlay, dailyMetric, weekCompare],
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
        <GlassCard>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total leads</p>
              <p className="text-3xl font-display font-bold text-foreground mt-1 tabular-nums">
                {kpis.totalLeads.toLocaleString("es")}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <DeltaText pct={cmp7.total.deltaPct} label="(7d)" />
                <span className="text-[10px] text-muted-foreground">vs semana previa</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-teal-50 border border-teal-100">
              <Users className="h-5 w-5 text-teal-600" />
            </div>
          </div>
          <MiniSpark values={sparkTotal} />
        </GlassCard>
        <GlassCard>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ventas</p>
              <p className="text-3xl font-display font-bold text-foreground mt-1 tabular-nums">
                {kpis.totalVentas.toLocaleString("es")}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <DeltaText pct={cmp7.ventas.deltaPct} label="(7d)" />
                <span className="text-[10px] text-muted-foreground">vs semana previa</span>
              </div>
            </div>
            <div className="p-2 rounded-xl bg-violet-50 border border-violet-100">
              <TrendingUp className="h-5 w-5 text-violet-600" />
            </div>
          </div>
          <MiniSpark values={sparkVentas} />
        </GlassCard>
        <GlassCard>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Semana ISO</p>
              <p className="text-2xl font-display font-bold text-foreground mt-1 tabular-nums">
                {cmpW.total.current.toLocaleString("es")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">vs {cmpW.total.previous.toLocaleString("es")} ant.</p>
              <div className="mt-2">
                <DeltaText pct={cmpW.total.deltaPct} label="semana ISO" />
              </div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-100">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Con 1ª gestión</p>
              <p className="text-3xl font-display font-bold text-foreground mt-1 tabular-nums">
                {kpis.conGestion.toLocaleString("es")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {kpis.totalLeads ? ((kpis.conGestion / kpis.totalLeads) * 100).toFixed(1) : "0.0"}% del total
              </p>
            </div>
            <div className="p-2 rounded-xl bg-sky-50 border border-sky-100">
              <MessageSquare className="h-5 w-5 text-sky-600" />
            </div>
          </div>
        </GlassCard>
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

      {leads.length > 0 ? (
        <ComparativaDashboardSection
          leads={leads}
          onFilterByDate={onFilterByDate}
          onFilterByWeekRange={onFilterByWeekRange}
          filterDesde={filterDesde}
          filterHasta={filterHasta}
          rpcData={rpcData}
          kpiTotalLeadsFromRpc={kpiTotalLeadsFromRpc}
        />
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
              <>
                Descargando filas (solo columnas necesarias)…
                <span className="mt-2 block text-base font-display font-semibold text-foreground tabular-nums">
                  {comparativeRowsLoadedProgress.toLocaleString("es")} filas recibidas
                </span>
              </>
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
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Gráficos por categorías fijas (ciudad, campaña, embudo, etc.): cambia tipo de vista y usa el clic para
            filtrar. La comparación temporal detallada está en la sección <strong>Comparativa</strong>.
          </p>
          <p className="text-[11px] text-muted-foreground mt-2 max-w-3xl space-y-1.5">
            <span className="block">
              {analisisFijoFechasLinea}{" "}
              {evolucionRangoMuestras && (
                <>
                  Puntos de la <strong>evolución diaria</strong> en el gráfico: {evolucionRangoMuestras.d0} —{" "}
                  {evolucionRangoMuestras.d1}.
                </>
              )}
            </span>
            <span className="block text-[10px] text-muted-foreground/90">
              Eso no tiene por qué coincidir con el eje de <strong>Comparativa</strong> (mismo dashboard): allí se elige
              una ventana fija de N días (7–28) y un anclaje; aquí se sigue el filtro y la serie agregada del RPC.
            </span>
          </p>
        </div>

      <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
        <GlassCard className="lg:col-span-2" noPad>
          <Tabs defaultValue="daily" className="w-full">
            <div className="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Evolución rápida (leads / ventas)</h3>
              <TabsList className="h-9">
                <TabsTrigger value="daily" className="text-xs">
                  Diario
                </TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs">
                  Semanal
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="daily" className="mt-0 p-4 pt-3 space-y-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Select value={timeVizDaily} onValueChange={(v) => setTimeVizDaily(v as TimeViz)}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Tipo de gráfico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Líneas</SelectItem>
                    <SelectItem value="area">Área / tendencia</SelectItem>
                    <SelectItem value="bar">Barras</SelectItem>
                    <SelectItem value="combo">Combinado (barras + línea ventas)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dailyMetric} onValueChange={(v) => setDailyMetric(v as ComparisonMetric)}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Métrica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="ventas">Ventas</SelectItem>
                    <SelectItem value="efectividad">Efectividad % (día)</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={dailyOverlay}
                  onValueChange={(v) => setDailyOverlay(v as DailyComparisonOverlayMode)}
                >
                  <SelectTrigger className="h-8 w-[220px] text-xs">
                    <SelectValue placeholder="Comparar con" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Sin comparación</SelectItem>
                    <SelectItem value="prev_calendar_day">vs día anterior</SelectItem>
                    <SelectItem value="same_weekday_prev_week">vs −7 días (mismo weekday)</SelectItem>
                    <SelectItem value="avg_weekday_historical">vs promedio histórico por weekday</SelectItem>
                    <SelectItem value="same_dom_prev_month">vs mismo día mes anterior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {timeVizDaily === "combo" && (
                <p className="text-[10px] text-muted-foreground text-right">
                  Vista combinada: siempre muestra Leads (barras) y Ventas (línea). Cambia a línea, área o barras para
                  usar el selector de métrica en ambas series.
                </p>
              )}
              {timeVizDaily === "combo" && dailyOverlay !== "off" && (
                <p className="text-[10px] text-muted-foreground text-right">
                  La línea de comparación no está disponible en vista combinada.
                </p>
              )}
              <ReactECharts
                key={chartKey("daily")}
                option={optDaily}
                style={{ height: 320, width: "100%" }}
                notMerge
                lazyUpdate
                onEvents={evDailyDay}
              />
            </TabsContent>
            <TabsContent value="weekly" className="mt-0 p-4 pt-3 space-y-3">
              <div className="flex flex-wrap justify-end gap-2">
                <Select value={timeVizWeekly} onValueChange={(v) => setTimeVizWeekly(v as TimeViz)}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
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
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Comparar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Sin comparación extra</SelectItem>
                    <SelectItem value="prev">+ Semana ISO anterior</SelectItem>
                  </SelectContent>
                </Select>
                {weekCompare === "prev" && (
                  <Select
                    value={weekCompareField}
                    onValueChange={(v) => setWeekCompareField(v as "leads" | "ventas")}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">Métrica: leads</SelectItem>
                      <SelectItem value="ventas">Métrica: ventas</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <ReactECharts
                key={chartKey("weekly")}
                option={optWeekly}
                style={{ height: 320, width: "100%" }}
                notMerge
                lazyUpdate
                onEvents={evWeekly}
              />
            </TabsContent>
          </Tabs>
        </GlassCard>

        <GlassCard noPad className="flex flex-col">
          <div className="px-4 pt-4 border-b border-border pb-2 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" />
              Efectividad
            </h3>
            <p className="text-[10px] text-muted-foreground">Ventas / leads filtrados · escala del medidor</p>
            <Select value={String(gaugeMax)} onValueChange={(v) => setGaugeMax(Number(v) as 20 | 30 | 50 | 100)}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Escala máx." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">Máximo 20%</SelectItem>
                <SelectItem value="30">Máximo 30%</SelectItem>
                <SelectItem value="50">Máximo 50%</SelectItem>
                <SelectItem value="100">Máximo 100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-h-[280px] p-2">
            <ReactECharts
              key={chartKey("gauge")}
              option={optGauge}
              style={{ height: 260, width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard noPad>
        <div className="px-4 pt-4 border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-foreground">Embudo</h3>
          <p className="text-[10px] text-muted-foreground">Gestión → negocio → venta</p>
        </div>
        <div className="p-4">
          <ReactECharts option={optFunnel} style={{ height: 300, width: "100%" }} notMerge lazyUpdate />
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <GlassCard noPad>
          <div className="px-4 pt-4 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">Mapa / ranking ciudades</h3>
          </div>
          <div className="p-4">
            <ReactECharts
              option={optCity}
              style={{ height: 340, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evCity}
            />
          </div>
        </GlassCard>
        <GlassCard noPad>
          <div className="px-4 pt-4 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">Variación por día de semana</h3>
          </div>
          <div className="p-4">
            <ReactECharts option={optWeekday} style={{ height: 340, width: "100%" }} notMerge lazyUpdate />
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        <GlassCard noPad>
          <div className="px-4 pt-4 flex flex-wrap justify-between items-center gap-2 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">Campaña MKT</h3>
            <Select value={campViz} onValueChange={(v) => setCampViz(v as CatViz)}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras verticales</SelectItem>
                <SelectItem value="bar_h">Barras horizontales</SelectItem>
                <SelectItem value="donut">Radial / anillo</SelectItem>
                <SelectItem value="radar">Radar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4">
            <ReactECharts
              option={optCamp}
              style={{ height: 320, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evCamp}
            />
          </div>
        </GlassCard>
        <GlassCard noPad>
          <div className="px-4 pt-4 flex flex-wrap justify-between items-center gap-2 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">Ciudad — tipo de vista</h3>
            <Select value={cityViz} onValueChange={(v) => setCityViz(v as CatViz)}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras verticales</SelectItem>
                <SelectItem value="bar_h">Barras horizontales</SelectItem>
                <SelectItem value="donut">Donut</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4">
            <ReactECharts
              option={optCityCategory}
              style={{ height: 320, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evCityCat}
            />
          </div>
        </GlassCard>
      </div>

      <GlassCard noPad>
        <div className="px-4 pt-4 border-b border-border pb-2">
          <h3 className="text-sm font-semibold text-foreground">Agentes (1ª gestión): volumen + ventas</h3>
          <p className="text-[10px] text-muted-foreground">Combinado barras + línea</p>
        </div>
        <div className="p-4">
          <ReactECharts
            option={optAgent}
            style={{ height: 340, width: "100%" }}
            notMerge
            lazyUpdate
            onEvents={evAgent}
          />
        </div>
      </GlassCard>

      {discovered.length > 0 && (
        <GlassCard noPad>
          <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Explorador automático de dimensiones</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Generado según cardinalidad de columnas (2–40 valores)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={String(exploreIdx)} onValueChange={(v) => setExploreIdx(Number(v))}>
                <SelectTrigger className="h-8 min-w-[200px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {discovered.map((d, i) => (
                    <SelectItem key={d.key} value={String(i)}>
                      {d.label} ({d.cardinality})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={exploreViz} onValueChange={(v) => setExploreViz(v as CatViz)}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
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
          <div className="p-4">
            {optExplore && (
              <ReactECharts
                option={optExplore}
                style={{ height: 340, width: "100%" }}
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
}

export function ExecutiveDashboardBody(props: ExecutiveDashboardBodyProps) {
  return (
    <ComparativaControlsProvider>
      <ExecutiveDashboardBodyInner {...props} />
    </ComparativaControlsProvider>
  );
}

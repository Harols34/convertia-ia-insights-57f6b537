import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { GlassCard } from "./GlassCard";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, endOfISOWeek, endOfDay, startOfDay, subDays, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { 
  TrendingUp, 
  Users, 
  Target, 
  RotateCcw, 
  Filter, 
  Check, 
  Sparkles,
  BarChart3,
  ChevronDown,
  Calendar,
  MessageSquare,
  Search,
  Database,
  History,
  CalendarDays,
  LayoutDashboard,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparativaControls } from "@/contexts/ComparativaControlsContext";
import type { LeadRow, LeadsDashboardFilters } from "@/lib/dashboard-leads";
import {
  uniqueValuesForColumn,
  formatFilterChipValue,
  LEADS_FILTER_EMPTY_TOKEN,
  rowMatchesDimensionToken,
  getNormalizedLeadValue,
} from "@/lib/dashboard-leads";
import {
  buildComparisonSeriesSpec,
  buildComparisonFromRpcDaily,
  buildFullDailyTrendForSpec,
  buildWeeklySeriesForSpec,
  comparisonLineAlignedToDailySpec,
  weeklyPreviousPeriodValues,
  getLeadsCreationDateBounds,
  getComparisonWindowBounds,
  filterLeadsByCreationInRange,
  sumComparisonSeriesActual,
  leadDateBoundsOverlapComparisonWindow,
  todayAnchorUsedMaxDataFallback,
  COMPARISON_MODE_META,
  COMPARATIVE_DIMENSION_SUBJECTS,
  COMPARATIVE_BREAKDOWN_GROUPS,
  comparativeSpecTitle,
  type CompareWindowOptions,
  type ComparativaWindowAnchor,
  type ComparativeSeriesSpec,
  type ComparisonMode,
  type ComparisonMetric,
  type DailyComparisonOverlayMode,
} from "@/lib/dashboard-leads-analytics";
import { type DashboardExecutiveData, comparisonLineFromRpcDaily, type RpcOverlayMode, fetchExplorerTimeseries, buildRpcFilters } from "@/lib/dashboard-executive-rpc";
import {
  comparisonDualSeriesOption,
  weeklyScalarBarsOption,
  scalarTimeSeriesOption,
  type ComparisonViz,
} from "./dashboard-chart-options";

/**
 * Fase D2: delegar series diarias/ comparativas a un RPC timeseries (p. ej. `accessible_leads_timeseries`) reduciría
 * ancho de banda; el explorador y cortes finos por dimensión seguirían necesitando filas o endpoints dedicados.
 */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-slate-200 bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:bg-muted/30">{children}</div>
  );
}

type BaseKind = "leads" | "ventas" | "efectividad" | "dimension";

function specFromMetricParts(
  baseKind: BaseKind,
  dimSubject: (typeof COMPARATIVE_DIMENSION_SUBJECTS)[number],
  dimToken: string,
): ComparativeSeriesSpec {
  if (baseKind === "leads") return { kind: "leads" };
  if (baseKind === "ventas") return { kind: "ventas" };
  if (baseKind === "efectividad") return { kind: "efectividad" };
  return { kind: "match_column", column: dimSubject.column, token: dimToken };
}

function useDimTokenSync(
  baseKind: BaseKind,
  dimOptions: string[],
  dimToken: string,
  setDimToken: (t: string) => void,
) {
  useEffect(() => {
    if (baseKind !== "dimension") return;
    if (dimOptions.length === 0) return;
    if (!dimOptions.includes(dimToken)) setDimToken(dimOptions[0]!);
  }, [baseKind, dimOptions, dimToken, setDimToken]);
}

function MetricSelectors({
  leads,
  dimensionOptions,
  baseKind,
  setBaseKind,
  dimSubjectId,
  setDimSubjectId,
  dimToken,
  setDimToken,
  suffix,
}: {
  leads: LeadRow[];
  dimensionOptions?: Partial<Record<keyof LeadRow, string[]>>;
  baseKind: BaseKind;
  setBaseKind: (v: BaseKind) => void;
  dimSubjectId: string;
  setDimSubjectId: (v: string) => void;
  dimToken: string;
  setDimToken: (v: string) => void;
  /** Evita colisiones de id en DOM si hay varios bloques en la página. */
  suffix: string;
}) {
  const dimSubject = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === dimSubjectId)!;
  const dimOptions = useMemo(() => {
    if (leads.length > 0) return uniqueValuesForColumn(leads, dimSubject.column, 80);
    return dimensionOptions?.[dimSubject.column] ?? [];
  }, [leads, dimSubject.column, dimensionOptions]);
  useDimTokenSync(baseKind, dimOptions, dimToken, setDimToken);

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Qué analizar</p>
        <Select value={baseKind} onValueChange={(v) => setBaseKind(v as BaseKind)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leads">Leads captados</SelectItem>
            <SelectItem value="ventas">Ventas (día)</SelectItem>
            <SelectItem value="efectividad">Efectividad % (día)</SelectItem>
            <SelectItem value="dimension">Resultado / agente (conteo)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {baseKind === "dimension" && (
        <>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dimensión</p>
            <Select value={dimSubjectId} onValueChange={setDimSubjectId}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARATIVE_DIMENSION_SUBJECTS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Valor</p>
            <Select value={dimToken} onValueChange={setDimToken}>
              <SelectTrigger className="h-8 min-w-[180px] max-w-[240px] text-xs" id={`dim-val-${suffix}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {dimOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {formatFilterChipValue(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}



export type ComparativaDashboardSectionProps = {
  leads: LeadRow[];
  onFilterByDate?: (isoDay: string) => void;
  onFilterByWeekRange?: (desde: string, hasta: string) => void;
  /** Filtros de fecha del panel (anclaje «Alinear a filtros del panel»). */
  filterDesde?: string;
  filterHasta?: string;
  /** Timeseries del ejecutivo: opción «como análisis fijo» en la ventana alineada. */
  rpcData?: DashboardExecutiveData | null;
  kpiTotalLeadsFromRpc?: number;
  /** Aún no se ha iniciado la descarga del universo de filas (explorador por dimensión requiere leads en cliente). */
  isLeadsLoading?: boolean;
  comparativeRowsLoadedProgress?: number;
  comparativeDatasetIdle?: boolean;
  onRequestComparativeDataset?: () => void;
  dimensionOptions?: Partial<Record<keyof LeadRow, string[]>>;
  dashboardFilters?: LeadsDashboardFilters;
};

export function ComparativaDashboardSection({
  leads,
  onFilterByDate,
  onFilterByWeekRange,
  filterDesde,
  filterHasta,
  rpcData,
  kpiTotalLeadsFromRpc,
  comparativeDatasetIdle = false,
  isLeadsLoading = false,
  comparativeRowsLoadedProgress = 0,
  onRequestComparativeDataset,
  dimensionOptions,
  dashboardFilters,
}: ComparativaDashboardSectionProps) {
  const { compareMode, setCompareMode, compareDays, setCompareDays, windowAnchor, setWindowAnchor } =
    useComparativaControls();

  const filteredLeads = leads;

  const filterFchKey = useMemo(() => {
    const d = filterDesde?.trim() ?? "";
    const h = filterHasta?.trim() ?? "";
    return `${d}\u0000${h}`;
  }, [filterDesde, filterHasta]);
  const lastAutoAnchorFilterKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const hasPanelDates = Boolean((filterDesde?.trim() ?? "") || (filterHasta?.trim() ?? ""));
    if (!hasPanelDates) {
      lastAutoAnchorFilterKeyRef.current = null;
      return;
    }
    if (lastAutoAnchorFilterKeyRef.current === filterFchKey) return;
    lastAutoAnchorFilterKeyRef.current = filterFchKey;
    setWindowAnchor({ type: "dashboardDateFilters" });
  }, [filterFchKey, filterDesde, filterHasta, setWindowAnchor]);

  const [historicTab, setHistoricTab] = useState<"window" | "trend">("window");

  const [alBase, setAlBase] = useState<BaseKind>("leads");
  const [alDimId, setAlDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [alDimTok, setAlDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  /** Ventana alineada: por defecto usa los agregados del servidor (rpc) si están disponibles
   *  para que el bloque renderice de inmediato sin esperar la descarga del dataset. */
  const [alDataSource, setAlDataSource] = useState<"client" | "rpc">(() =>
    rpcData?.daily?.length ? "rpc" : "client",
  );
  const [dailyViz, setDailyViz] = useState<ComparisonViz>("area");

  useEffect(() => {
    if (alBase === "dimension") setAlDataSource("client");
  }, [alBase]);

  /** Si llegan los agregados del servidor más tarde y aún no hay leads, cambia a "rpc" para mostrar datos. */
  useEffect(() => {
    if (rpcData?.daily?.length && leads.length === 0 && alBase !== "dimension") {
      setAlDataSource("rpc");
    }
  }, [rpcData, leads.length, alBase]);

  const [trBase, setTrBase] = useState<BaseKind>("leads");
  const [trDimId, setTrDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [trDimTok, setTrDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [trendViz, setTrendViz] = useState<"line" | "area" | "bar">("line");
  const [trendOverlay, setTrendOverlay] = useState<DailyComparisonOverlayMode | "off">("off");

  const [wkBase, setWkBase] = useState<BaseKind>("leads");
  const [wkDimId, setWkDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [wkDimTok, setWkDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [weeklyViz, setWeeklyViz] = useState<"bar" | "line" | "area">("bar");
  const [weekCompare, setWeekCompare] = useState(true);

  const alDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === alDimId)!;
  const trDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === trDimId)!;
  const wkDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === wkDimId)!;

  const specAl = useMemo(
    () => specFromMetricParts(alBase, alDimSubj, alDimTok),
    [alBase, alDimSubj, alDimTok],
  );
  const specTr = useMemo(
    () => specFromMetricParts(trBase, trDimSubj, trDimTok),
    [trBase, trDimSubj, trDimTok],
  );
  const specWk = useMemo(
    () => specFromMetricParts(wkBase, wkDimSubj, wkDimTok),
    [wkBase, wkDimSubj, wkDimTok],
  );

  const titleAl = useMemo(() => comparativeSpecTitle(specAl, alDimSubj.label), [specAl, alDimSubj.label]);
  const titleTr = useMemo(() => comparativeSpecTitle(specTr, trDimSubj.label), [specTr, trDimSubj.label]);
  const titleWk = useMemo(() => comparativeSpecTitle(specWk, wkDimSubj.label), [specWk, wkDimSubj.label]);

  const compareWindowOptions = useMemo<CompareWindowOptions>(
    () => ({
      anchor: windowAnchor,
      filterDesde,
      filterHasta,
    }),
    [windowAnchor, filterDesde, filterHasta],
  );

  /** Misma ventana que el eje diario: la semana ISO ya no mezcla semanas fuera de ese rango. */
  const compareWindowBounds = useMemo(
    () => getComparisonWindowBounds(filteredLeads, compareDays, compareWindowOptions),
    [filteredLeads, compareDays, compareWindowOptions],
  );
  const leadsInCompareWindow = useMemo(
    () => filterLeadsByCreationInRange(filteredLeads, compareWindowBounds.start, compareWindowBounds.end),
    [filteredLeads, compareWindowBounds],
  );

  const dateBounds = useMemo(() => getLeadsCreationDateBounds(filteredLeads), [filteredLeads]);

  const yAl = specAl.kind === "efectividad";
  const yTr = specTr.kind === "efectividad";
  const yWk = specWk.kind === "efectividad";

  const comparisonAl = useMemo(() => {
    const metric: ComparisonMetric | null =
      specAl.kind === "leads"
        ? "leads"
        : specAl.kind === "ventas"
          ? "ventas"
          : specAl.kind === "efectividad"
            ? "efectividad"
            : null;
    const useRpcLine =
      alDataSource === "rpc" && Boolean(rpcData?.daily?.length) && metric != null && specAl.kind !== "match_column";
    if (useRpcLine && rpcData?.daily) {
      let daily = rpcData.daily;
      const hasPanelDates = Boolean((filterDesde?.trim() ?? "") || (filterHasta?.trim() ?? ""));
      if (!hasPanelDates) {
        let end = daily.length - 1;
        while (end >= 0 && daily[end].leads === 0 && daily[end].ventas === 0) end--;
        if (end >= 0) daily = daily.slice(0, end + 1);
      }
      return buildComparisonFromRpcDaily(daily, compareDays, metric, compareMode);
    }
    return buildComparisonSeriesSpec(filteredLeads, compareDays, compareMode, specAl, compareWindowOptions);
  }, [alDataSource, rpcData, filteredLeads, compareDays, compareMode, specAl, compareWindowOptions]);

  const sumActualInWindow = useMemo(
    () => sumComparisonSeriesActual(comparisonAl.points),
    [comparisonAl.points],
  );

  const windowOverlapsCorte = useMemo(
    () => leadDateBoundsOverlapComparisonWindow(filteredLeads, compareDays, compareWindowOptions),
    [filteredLeads, compareDays, compareWindowOptions],
  );
  const todayFallbackToMaxFch = useMemo(
    () => todayAnchorUsedMaxDataFallback(filteredLeads, compareDays, compareWindowOptions),
    [filteredLeads, compareDays, compareWindowOptions],
  );
  const kpiMismatchLeads =
    kpiTotalLeadsFromRpc != null &&
    kpiTotalLeadsFromRpc > 0 &&
    specAl.kind === "leads" &&
    alDataSource === "client" &&
    leads.length > 0 &&
    sumActualInWindow === 0;

  const hasNoValidFch = filteredLeads.length > 0 && dateBounds.max == null;
  const windowShowsAllZeros = filteredLeads.length > 0 && dateBounds.max != null && sumActualInWindow === 0;
  const windowAxisVsCorte = windowShowsAllZeros && !hasNoValidFch && !windowOverlapsCorte;

  /** Referencia: “últimos N días” hacia hoy (solo calendario, sin anclaje de la comparativa). */
  const rollingCalendarHint = useMemo(() => {
    const endD = new Date();
    const sM = startOfMonth(endD);
    const hoyE = endOfDay(endD);
    const naive = startOfDay(subDays(hoyE, compareDays - 1));
    const m0 = startOfDay(sM);
    const winStart = naive.getTime() < m0.getTime() ? m0 : naive;
    return `Sobre el calendario de este mes, los últimos ${compareDays} días hacia hoy (referencia, sin mirar anclaje) son: ${format(
      winStart,
      "d MMM",
      { locale: es },
    )} — ${format(hoyE, "d MMM yyyy", { locale: es })} (si aún no hay N días en el mes, se cuenta desde el día 1).`;
  }, [compareDays]);

  const comparisonTrWindow = useMemo(() => {
    const metric: ComparisonMetric | null =
      specTr.kind === "leads"
        ? "leads"
        : specTr.kind === "ventas"
          ? "ventas"
          : specTr.kind === "efectividad"
            ? "efectividad"
            : null;
    // Usa RPC si la fuente alineada está en RPC, o si simplemente no hay leads cargados
    // (modo inicial: el dataset comparativo se descarga de forma diferida).
    const useRpcLine =
      metric != null &&
      specTr.kind !== "match_column" &&
      Boolean(rpcData?.daily?.length) &&
      (alDataSource === "rpc" || leads.length === 0);
    if (useRpcLine && rpcData?.daily) {
      return buildComparisonFromRpcDaily(rpcData.daily, compareDays, metric, compareMode);
    }
    return buildComparisonSeriesSpec(filteredLeads, compareDays, compareMode, specTr, compareWindowOptions);
  }, [filteredLeads, compareDays, compareMode, specTr, compareWindowOptions, rpcData, alDataSource]);

  const optAligned = useMemo(
    () =>
      comparisonDualSeriesOption(comparisonAl.points, `Ventana diaria · ${titleAl}`, {
        subtitle: comparisonAl.meta.subtitle,
        actualName: "Serie actual",
        comparisonName: comparisonAl.meta.comparisonLegend,
        yPercent: yAl,
        viz: dailyViz,
      }),
    [comparisonAl, titleAl, yAl, dailyViz],
  );

  const optHistoricWindow = useMemo(
    () =>
      comparisonDualSeriesOption(comparisonTrWindow.points, `Ventana global (${compareDays}d) · ${titleTr}`, {
        subtitle: comparisonTrWindow.meta.subtitle,
        actualName: "Serie actual",
        comparisonName: comparisonTrWindow.meta.comparisonLegend,
        yPercent: yTr,
        viz: trendViz,
      }),
    [comparisonTrWindow, compareDays, titleTr, yTr, trendViz],
  );

  /** Tendencia ~90 días: si la fuente alineada usa RPC o no hay leads, deriva del agregado servidor. */
  const trendUsingRpc = useMemo(
    () =>
      Boolean(rpcData?.daily?.length) &&
      specTr.kind !== "match_column" &&
      (alDataSource === "rpc" || filteredLeads.length === 0),
    [rpcData, specTr.kind, alDataSource, filteredLeads.length],
  );
  const trend = useMemo(() => {
    if (trendUsingRpc && rpcData?.daily) {
      const key: "leads" | "ventas" = specTr.kind === "ventas" ? "ventas" : "leads";
      return rpcData.daily.map((d) => ({
        date: d.date,
        value: specTr.kind === "efectividad"
          ? (d.leads > 0 ? (d.ventas / d.leads) * 100 : 0)
          : d[key],
      }));
    }
    return buildFullDailyTrendForSpec(filteredLeads, 90, specTr, compareWindowOptions);
  }, [trendUsingRpc, rpcData, filteredLeads, specTr, compareWindowOptions]);
  const trendOverlayData = useMemo(() => {
    if (trendOverlay === "off" || trend.length === 0) return undefined;
    const metric: "leads" | "ventas" | "efectividad" | null =
      specTr.kind === "leads" ? "leads"
      : specTr.kind === "ventas" ? "ventas"
      : specTr.kind === "efectividad" ? "efectividad"
      : null;
    let data: number[];
    if (trendUsingRpc && rpcData?.daily && metric) {
      data = comparisonLineFromRpcDaily(rpcData.daily, trend, metric, trendOverlay as RpcOverlayMode);
    } else {
      data = comparisonLineAlignedToDailySpec(filteredLeads, trend, specTr, trendOverlay);
    }
    return {
      name: COMPARISON_MODE_META[trendOverlay].comparisonLegend,
      data,
    };
  }, [leads, trend, specTr, trendOverlay, trendUsingRpc, rpcData]);

  const optTrend = useMemo(
    () =>
      scalarTimeSeriesOption(
        trend.map((t) => ({ date: t.date, value: t.value })),
        `Histórico (~90 días) · ${titleTr}`,
        {
          viz: trendViz,
          yPercent: yTr,
          overlayLine: trendOverlayData,
        },
      ),
    [trend, titleTr, trendViz, yTr, trendOverlayData],
  );

  const weekly = useMemo(() => {
    const useRpc =
      Boolean(rpcData?.weekly?.length) &&
      specWk.kind !== "match_column" &&
      (alDataSource === "rpc" || leads.length === 0);
    if (useRpc && rpcData?.weekly) {
      const key: "leads" | "ventas" = specWk.kind === "ventas" ? "ventas" : "leads";
      return rpcData.weekly.map((w) => ({
        weekStart: w.weekStart,
        label: w.label,
        value: specWk.kind === "efectividad"
          ? (w.leads > 0 ? (w.ventas / w.leads) * 100 : 0)
          : w[key],
      }));
    }
    return buildWeeklySeriesForSpec(leadsInCompareWindow, 20, specWk);
  }, [leads.length, leadsInCompareWindow, specWk, rpcData, alDataSource]);
  const weekPrev = useMemo(
    () => (weekCompare ? weeklyPreviousPeriodValues(weekly) : []),
    [weekCompare, weekly],
  );

  const weeklyChartTitle = useMemo(
    () =>
      `Semanal ISO · ${titleWk} · ventana global ${compareDays}d · ${COMPARISON_MODE_META[compareMode].label}`,
    [titleWk, compareDays, compareMode],
  );

  const optWeekly = useMemo(
    () =>
      weeklyScalarBarsOption(
        weekly.map((w) => ({ label: w.label, value: w.value })),
        weeklyChartTitle,
        {
          compareLine: weekCompare
            ? { name: "Semana ISO anterior (misma métrica)", data: weekPrev }
            : undefined,
          yPercent: yWk,
          viz: weeklyViz,
        },
      ),
    [weekly, weeklyChartTitle, yWk, weekCompare, weekPrev, weeklyViz],
  );

  const evCompareDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = comparisonAl.dateKeys;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, comparisonAl.dateKeys]);

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

  const evTrendDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= trend.length) return;
        onFilterByDate(trend[i]!.date);
      },
    };
  }, [onFilterByDate, trend]);

  const evHistoricWindowDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = comparisonTrWindow.dateKeys;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, comparisonTrWindow.dateKeys]);



  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <BarChart3 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-display font-black tracking-tight text-slate-900 leading-none mb-2">
              Explorador Comparativo Estratégico
            </h2>
            <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-2xl">
              Análisis dinámico de tendencias y comparativas temporales con anclaje inteligente.
            </p>
          </div>
        </div>


      </div>

      <Card className="p-4 md:p-6 border-slate-200/60 bg-white/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-3">
          <Sparkles className="h-5 w-5 text-indigo-500/20" />
        </div>
        <div className="mb-6">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" />
            Configuración Global de Ventana
          </h3>
          <p className="text-[11px] text-muted-foreground font-medium mt-1">
            Define el periodo de contraste y el anclaje temporal para todos los análisis de esta sección.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Modo comparación</p>
            <Select value={compareMode} onValueChange={(v) => setCompareMode(v as ComparisonMode)}>
              <SelectTrigger className="h-9 min-w-[240px] max-w-[300px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COMPARISON_MODE_META) as ComparisonMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {COMPARISON_MODE_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Ventana (N días)</p>
            <Select
              value={String(compareDays)}
              onValueChange={(v) => setCompareDays(Number(v) as 7 | 14 | 21 | 28 | 31)}
            >
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="14">14 días</SelectItem>
                <SelectItem value="21">21 días</SelectItem>
                <SelectItem value="28">28 días</SelectItem>
                <SelectItem value="31">31 días (mes completo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 space-y-1">
          <span className="block">{rollingCalendarHint}</span>
        </p>
        {windowAnchor.type === "today" && todayFallbackToMaxFch && (
          <p className="text-[10px] text-amber-800 dark:text-amber-400 mt-2 leading-snug">
            El eje se ha anclado a la <strong>última fecha con datos</strong> de este corte (no a hoy) porque en los
            últimos {compareDays} días hacia hoy no hay <code className="text-[10px]">fch_creacion</code> en las filas
            descargadas. Para forzar un mes u otro rango, ajusta filtros o el anclaje.
          </p>
        )}
      </Card>

      {hasNoValidFch && leads.length > 0 && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Sin fechas de creación válidas</AlertTitle>
          <AlertDescription>
            Hay {leads.length} filas en el corte, pero no se pudo leer <code className="text-xs">fch_creacion</code> en
            ninguna. Revisa el formato de fecha en la base o el mapeo del cliente: la agregación diaria se descarta sin
            fecha.
          </AlertDescription>
        </Alert>
      )}

      {windowAxisVsCorte && dateBounds.min && dateBounds.max && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sin fechas de creación en el eje de la ventana</AlertTitle>
          <AlertDescription>
            En el rango de fechas de este eje (según anclaje y {compareDays} días) no entra ninguna{" "}
            <code className="text-xs">fch</code> con la métrica. El corte trae fch mín.{" "}
            <strong>{format(dateBounds.min, "d MMM yyyy", { locale: es })}</strong> — máx.{" "}
            <strong>{format(dateBounds.max, "d MMM yyyy", { locale: es })}</strong>. Revisa filtros de fechas, dimensiones
            o anclaje.
          </AlertDescription>
        </Alert>
      )}

      {kpiMismatchLeads && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Discrepancia con el análisis fijo (leads)</AlertTitle>
          <AlertDescription>
            En el servidor el filtro aún arroja <strong>leads</strong> (KPI), pero en la ventana de este gráfico (datos
            en cliente) la suma de la serie &quot;actual&quot; de leads es 0. Prueba otra anclaje o rango, o comprobar que
            el universo descargado cubre el mismo corte, o use la fuente <strong>como análisis fijo</strong> en «Ventana
            alineada».
          </AlertDescription>
        </Alert>
      )}

      {!windowAxisVsCorte && windowShowsAllZeros && !hasNoValidFch && !kpiMismatchLeads && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>La ventana de la gráfica no refleja datos para esta métrica</AlertTitle>
          <AlertDescription>
            {windowAnchor.type === "today" ? (
              <>
                Ningún lead del corte cae en la ventana calendario usada para el eje (con el anclaje y modo actuales) para
                la métrica elegida. Prueba anclar a <strong>última fch con datos</strong> o a los <strong>filtros del
                panel</strong>, o cambia dimensión/valor o modo de comparación.
              </>
            ) : (
              <>
                Con el anclaje y la métrica actuales, la suma de la serie en la ventana es 0. Revisa el valor de dimensión
                (si aplica), el modo de comparación o el rango de fechas en el panel.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard noPad className="flex flex-col shadow-lg border-slate-200/60 transition-all hover:shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-sm">
                <LayoutDashboard className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">Ventana Alineada</h3>
                <p className="text-[10px] text-muted-foreground font-medium">Contraste directo punto a punto</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dailyViz} onValueChange={(v) => setDailyViz(v as ComparisonViz)}>
                <SelectTrigger className="h-8 w-[90px] text-[10px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="line">Línea</SelectItem>
                  <SelectItem value="bar">Barra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-4 bg-white space-y-4">
            <MetricSelectors
              leads={filteredLeads}
              dimensionOptions={dimensionOptions}
              baseKind={alBase}
              setBaseKind={setAlBase}
              dimSubjectId={alDimId}
              setDimSubjectId={setAlDimId}
              dimToken={alDimTok}
              setDimToken={setAlDimTok}
              suffix="al"
            />
            <div className="h-[300px] w-full">
              <ReactECharts
                key={`al-${alDataSource}-${windowAnchor.type}-${compareMode}-${compareDays}-${dailyViz}-${titleAl}`}
                option={optAligned}
                style={{ height: "100%", width: "100%" }}
                notMerge
                lazyUpdate
                onEvents={evCompareDay}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard noPad className="flex flex-col shadow-lg border-slate-200/60 transition-all hover:shadow-xl overflow-hidden">
          <Tabs
            value={historicTab}
            onValueChange={(v) => setHistoricTab(v as "window" | "trend")}
            className="flex flex-col h-full"
          >
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center shadow-sm">
                  <Clock className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">Histórico Evolutivo</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Continuidad y tendencias largas</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TabsList className="h-8 bg-slate-200/50 p-1">
                  <TabsTrigger value="window" className="text-[10px] h-6">Ventana</TabsTrigger>
                  <TabsTrigger value="trend" className="text-[10px] h-6">~90 días</TabsTrigger>
                </TabsList>
                <Select value={trendViz} onValueChange={(v) => setTrendViz(v as typeof trendViz)}>
                  <SelectTrigger className="h-8 w-[90px] text-[10px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Línea</SelectItem>
                    <SelectItem value="area">Área</SelectItem>
                    <SelectItem value="bar">Barra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="p-4 bg-white flex-1 flex flex-col gap-4">
              <MetricSelectors
                leads={filteredLeads}
                baseKind={trBase}
                setBaseKind={setTrBase}
                dimSubjectId={trDimId}
                setDimSubjectId={setTrDimId}
                dimToken={trDimTok}
                setDimToken={setTrDimTok}
                suffix="tr"
              />
              
              <TabsContent value="window" className="mt-0 flex-1">
                <div className="h-[300px] w-full">
                  <ReactECharts
                    key={`tr-win-${windowAnchor.type}-${compareMode}-${compareDays}-${trendViz}-${titleTr}`}
                    option={optHistoricWindow}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    lazyUpdate
                    onEvents={evHistoricWindowDay}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="trend" className="mt-0 flex-1 space-y-3">
                <div className="flex justify-end">
                  <Select value={trendOverlay} onValueChange={(v) => setTrendOverlay(v as typeof trendOverlay)}>
                    <SelectTrigger className="h-7 w-[160px] text-[10px] bg-slate-50">
                      <SelectValue placeholder="Línea extra" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Sin línea extra</SelectItem>
                      <SelectItem value="prev_calendar_day">vs día anterior</SelectItem>
                      <SelectItem value="same_weekday_prev_week">vs −7 días</SelectItem>
                      <SelectItem value="avg_weekday_historical">vs prom. weekday</SelectItem>
                      <SelectItem value="same_dom_prev_month">vs mes ant.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-[270px] w-full">
                  <ReactECharts
                    key={`tr-trend-${windowAnchor.type}-${compareMode}-${compareDays}-${trendViz}-${trendOverlay}-${titleTr}`}
                    option={optTrend}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    lazyUpdate
                    onEvents={evTrendDay}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </GlassCard>
      </div>

      <GlassCard noPad className="shadow-lg border-slate-200/60 overflow-hidden transition-all hover:shadow-xl">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
              <CalendarDays className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-none mb-1">Semanas ISO: Bloques Calendario</h3>
              <p className="text-[10px] text-muted-foreground font-medium">Análisis por estacionalidad semanal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={weeklyViz} onValueChange={(v) => setWeeklyViz(v as typeof weeklyViz)}>
              <SelectTrigger className="h-8 w-[100px] text-[10px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barra</SelectItem>
                <SelectItem value="line">Línea</SelectItem>
                <SelectItem value="area">Área</SelectItem>
              </SelectContent>
            </Select>
            <Select value={weekCompare ? "yes" : "no"} onValueChange={(v) => setWeekCompare(v === "yes")}>
              <SelectTrigger className="h-8 w-[120px] text-[10px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">+ sem. anterior</SelectItem>
                <SelectItem value="no">Serie única</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-4 bg-white space-y-4">
          <MetricSelectors
            leads={filteredLeads}
            baseKind={wkBase}
            setBaseKind={setWkBase}
            dimSubjectId={wkDimId}
            setDimSubjectId={setWkDimId}
            dimToken={wkDimTok}
            setDimToken={setWkDimTok}
            suffix="wk"
          />
          <div className="h-[320px] w-full">
            <ReactECharts
              key={`wk-${weeklyViz}-${weekCompare}-${compareMode}-${compareDays}-${titleWk}`}
              option={optWeekly}
              style={{ height: "100%", width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evWeekly}
            />
          </div>
        </div>
      </GlassCard>


    </section>
  );
}

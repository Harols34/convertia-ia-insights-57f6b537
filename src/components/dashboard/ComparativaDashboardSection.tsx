import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { format, parseISO, endOfISOWeek, endOfDay, startOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useComparativaControls } from "@/contexts/ComparativaControlsContext";
import type { LeadRow } from "@/lib/dashboard-leads";
import {
  uniqueValuesForColumn,
  formatFilterChipValue,
  LEADS_FILTER_EMPTY_TOKEN,
  rowMatchesDimensionToken,
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
import { type DashboardExecutiveData, comparisonLineFromRpcDaily, type RpcOverlayMode } from "@/lib/dashboard-executive-rpc";
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
  baseKind,
  setBaseKind,
  dimSubjectId,
  setDimSubjectId,
  dimToken,
  setDimToken,
  suffix,
}: {
  leads: LeadRow[];
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
  const dimOptions = useMemo(
    () => uniqueValuesForColumn(leads, dimSubject.column, 80),
    [leads, dimSubject.column],
  );
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
};

const ANCHOR_SELECT_ITEMS: { value: ComparativaWindowAnchor["type"]; label: string }[] = [
  { value: "today", label: "Hasta hoy (si en los últimos N días no hay fch, el eje se ancla a la última fecha con datos en el corte)" },
  { value: "maxLeadDate", label: "Hasta la última fch con datos en el corte (históricos / ejes en el pasado)" },
  { value: "dashboardDateFilters", label: "Filtros de fecha del panel (recomendado si usas Desde / Hasta)" },
];

export function ComparativaDashboardSection({
  leads,
  onFilterByDate,
  onFilterByWeekRange,
  filterDesde,
  filterHasta,
  rpcData,
  kpiTotalLeadsFromRpc,
}: ComparativaDashboardSectionProps) {
  const { compareMode, setCompareMode, compareDays, setCompareDays, windowAnchor, setWindowAnchor } =
    useComparativaControls();

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
    () => getComparisonWindowBounds(leads, compareDays, compareWindowOptions),
    [leads, compareDays, compareWindowOptions],
  );
  const leadsInCompareWindow = useMemo(
    () => filterLeadsByCreationInRange(leads, compareWindowBounds.start, compareWindowBounds.end),
    [leads, compareWindowBounds],
  );

  const dateBounds = useMemo(() => getLeadsCreationDateBounds(leads), [leads]);

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
      return buildComparisonFromRpcDaily(rpcData.daily, compareDays, metric, compareMode);
    }
    return buildComparisonSeriesSpec(leads, compareDays, compareMode, specAl, compareWindowOptions);
  }, [alDataSource, rpcData, leads, compareDays, compareMode, specAl, compareWindowOptions]);

  const sumActualInWindow = useMemo(
    () => sumComparisonSeriesActual(comparisonAl.points),
    [comparisonAl.points],
  );

  const windowOverlapsCorte = useMemo(
    () => leadDateBoundsOverlapComparisonWindow(leads, compareDays, compareWindowOptions),
    [leads, compareDays, compareWindowOptions],
  );
  const todayFallbackToMaxFch = useMemo(
    () => todayAnchorUsedMaxDataFallback(leads, compareDays, compareWindowOptions),
    [leads, compareDays, compareWindowOptions],
  );
  const kpiMismatchLeads =
    kpiTotalLeadsFromRpc != null &&
    kpiTotalLeadsFromRpc > 0 &&
    specAl.kind === "leads" &&
    alDataSource === "client" &&
    leads.length > 0 &&
    sumActualInWindow === 0;

  const hasNoValidFch = leads.length > 0 && dateBounds.max == null;
  const windowShowsAllZeros = leads.length > 0 && dateBounds.max != null && sumActualInWindow === 0;
  const windowAxisVsCorte = windowShowsAllZeros && !hasNoValidFch && !windowOverlapsCorte;

  const anchorShortLabel = useMemo(() => {
    if (windowAnchor.type === "today") return "Hasta hoy";
    if (windowAnchor.type === "maxLeadDate") return "Hasta la última fch con datos (en el corte descargado)";
    return "Alineado a filtros de fecha del panel (Desde / Hasta)";
  }, [windowAnchor.type]);

  const resumenComparativa = useMemo(() => {
    if (leads.length === 0) return null;
    const eje =
      comparisonAl.dateKeys.length === 0
        ? "—"
        : `${format(parseISO(comparisonAl.dateKeys[0]!), "d MMM yyyy", { locale: es })} — ${format(
            parseISO(comparisonAl.dateKeys[comparisonAl.dateKeys.length - 1]!),
            "d MMM yyyy",
            { locale: es },
          )}`;
    const corteFch =
      dateBounds.min && dateBounds.max
        ? `${format(dateBounds.min, "d MMM yyyy", { locale: es })} — ${format(
            dateBounds.max,
            "d MMM yyyy",
            { locale: es },
          )}`
        : dateBounds.max
          ? format(dateBounds.max, "d MMM yyyy", { locale: es })
          : "—";
    const origen = alDataSource === "rpc" ? "Origen de la serie: agregado servidor (mismo criterio que análisis fijo)." : "Origen: filas en cliente (corte y ventana con la lógica de anclaje).";
    return `Anclaje: ${anchorShortLabel}. Eje: ${eje}. Registros en el corte: ${leads.length.toLocaleString("es")}. fch mín.–máx. (filas actuales): ${corteFch}. ${origen}`;
  }, [leads.length, comparisonAl.dateKeys, dateBounds.min, dateBounds.max, anchorShortLabel, alDataSource]);

  /** Referencia: mes calendario y “últimos N días” hacia hoy (solo calendario, sin anclaje de la comparativa). */
  const currentMonthContext = useMemo(() => {
    const endD = new Date();
    const sM = startOfMonth(endD);
    const eM = endOfMonth(endD);
    const hoyE = endOfDay(endD);
    const naive = startOfDay(subDays(hoyE, compareDays - 1));
    const m0 = startOfDay(sM);
    const winStart = naive.getTime() < m0.getTime() ? m0 : naive;
    const monthLabel = format(sM, "MMMM yyyy", { locale: es });
    return {
      monthLine: `Mes en curso (${monthLabel}): del ${format(sM, "d MMM", { locale: es })} al ${format(eM, "d MMM yyyy", { locale: es })}.`,
      rollingInMonth: `Sobre el calendario de este mes, los últimos ${compareDays} días hacia hoy (referencia, sin mirar anclaje) son: ${format(
        winStart,
        "d MMM",
        { locale: es },
      )} — ${format(hoyE, "d MMM yyyy", { locale: es })} (si aún no hay N días en el mes, se cuenta desde el día 1).`,
    };
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
    if (leads.length === 0 && rpcData?.daily?.length && metric != null && specTr.kind !== "match_column") {
      return buildComparisonFromRpcDaily(rpcData.daily, compareDays, metric, compareMode);
    }
    return buildComparisonSeriesSpec(leads, compareDays, compareMode, specTr, compareWindowOptions);
  }, [leads, compareDays, compareMode, specTr, compareWindowOptions, rpcData]);

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

  const trend = useMemo(() => {
    if (leads.length === 0 && rpcData?.daily?.length && specTr.kind !== "match_column") {
      const key: "leads" | "ventas" =
        specTr.kind === "ventas" ? "ventas" : "leads";
      return rpcData.daily.map((d) => ({
        date: d.date,
        value: specTr.kind === "efectividad"
          ? (d.leads > 0 ? (d.ventas / d.leads) * 100 : 0)
          : d[key],
      }));
    }
    return buildFullDailyTrendForSpec(leads, 90, specTr, compareWindowOptions);
  }, [leads, specTr, compareWindowOptions, rpcData]);
  const trendOverlayData = useMemo(() => {
    if (trendOverlay === "off" || trend.length === 0) return undefined;
    const data = comparisonLineAlignedToDailySpec(leads, trend, specTr, trendOverlay);
    return {
      name: COMPARISON_MODE_META[trendOverlay].comparisonLegend,
      data,
    };
  }, [leads, trend, specTr, trendOverlay]);

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
    if (leads.length === 0 && rpcData?.weekly?.length && specWk.kind !== "match_column") {
      const key: "leads" | "ventas" =
        specWk.kind === "ventas" ? "ventas" : "leads";
      return rpcData.weekly.map((w) => ({
        weekStart: w.weekStart,
        label: w.label,
        value: specWk.kind === "efectividad"
          ? (w.leads > 0 ? (w.ventas / w.leads) * 100 : 0)
          : w[key],
      }));
    }
    return buildWeeklySeriesForSpec(leadsInCompareWindow, 20, specWk);
  }, [leads.length, leadsInCompareWindow, specWk, rpcData]);
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

  /* —— Explorador dinámico (un gráfico; elige columna + busca valor + métrica propia) —— */
  const [exFilterCol, setExFilterCol] = useState<keyof LeadRow>(COMPARATIVE_BREAKDOWN_GROUPS[0]!.column);
  const exGroupMeta = useMemo(
    () => COMPARATIVE_BREAKDOWN_GROUPS.find((g) => g.column === exFilterCol) ?? COMPARATIVE_BREAKDOWN_GROUPS[0]!,
    [exFilterCol],
  );
  const [exSearch, setExSearch] = useState("");
  const [exFilterTok, setExFilterTok] = useState<string>(LEADS_FILTER_EMPTY_TOKEN);
  const [exBase, setExBase] = useState<BaseKind>("leads");
  const [exDimId, setExDimId] = useState(COMPARATIVE_DIMENSION_SUBJECTS[0]!.id);
  const [exDimTok, setExDimTok] = useState(LEADS_FILTER_EMPTY_TOKEN);
  const [exViz, setExViz] = useState<ComparisonViz>("area");

  const exFilterOptions = useMemo(() => uniqueValuesForColumn(leads, exFilterCol, 400), [leads, exFilterCol]);
  const exFilteredPicklist = useMemo(() => {
    const q = exSearch.trim().toLowerCase();
    const base = q
      ? exFilterOptions.filter((t) => formatFilterChipValue(t).toLowerCase().includes(q))
      : exFilterOptions;
    return base.slice(0, 100);
  }, [exFilterOptions, exSearch]);

  useEffect(() => {
    if (exFilterOptions.length === 0) return;
    if (!exFilterOptions.includes(exFilterTok)) setExFilterTok(exFilterOptions[0]!);
  }, [exFilterCol, exFilterOptions, exFilterTok]);

  const exDimSubj = COMPARATIVE_DIMENSION_SUBJECTS.find((d) => d.id === exDimId)!;
  const exDimOptions = useMemo(
    () => uniqueValuesForColumn(leads, exDimSubj.column, 80),
    [leads, exDimSubj.column],
  );
  const exInnerSpec = useMemo(
    () => specFromMetricParts(exBase, exDimSubj, exDimTok),
    [exBase, exDimSubj, exDimTok],
  );
  useDimTokenSync(exBase, exDimOptions, exDimTok, setExDimTok);

  const exSlice = useMemo(
    () => leads.filter((r) => rowMatchesDimensionToken(r, exFilterCol, exFilterTok)),
    [leads, exFilterCol, exFilterTok],
  );

  const exComparison = useMemo(
    () => buildComparisonSeriesSpec(exSlice, compareDays, compareMode, exInnerSpec, compareWindowOptions),
    [exSlice, compareDays, compareMode, exInnerSpec, compareWindowOptions],
  );

  const exTitle = useMemo(
    () =>
      `${exGroupMeta.label}: ${formatFilterChipValue(exFilterTok)} · ${comparativeSpecTitle(exInnerSpec, exDimSubj.label)}`,
    [exGroupMeta.label, exFilterTok, exInnerSpec, exDimSubj.label],
  );

  const exYpct = exInnerSpec.kind === "efectividad";
  const optExplorer = useMemo(
    () =>
      comparisonDualSeriesOption(exComparison.points, `Corte · ${exTitle}`, {
        subtitle: exComparison.meta.subtitle,
        actualName: "Serie actual",
        comparisonName: exComparison.meta.comparisonLegend,
        yPercent: exYpct,
        viz: exViz,
      }),
    [exComparison, exTitle, exYpct, exViz],
  );

  const evExplorerDay = useMemo(() => {
    if (!onFilterByDate) return undefined;
    const keys = exComparison.dateKeys;
    return {
      click: (params: { dataIndex?: number }) => {
        const i = params.dataIndex;
        if (typeof i !== "number" || i < 0 || i >= keys.length) return;
        onFilterByDate(keys[i]!);
      },
    };
  }, [onFilterByDate, exComparison.dateKeys]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground tracking-tight">Comparativa</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          <strong>Modo de comparación</strong> y <strong>ventana</strong> son globales para esta sección. Cada gráfico
          elige por separado qué métrica analizar y el tipo de visualización.
        </p>
      </div>

      <Card className="p-4 md:p-5">
        <p className="text-[11px] text-muted-foreground mb-3">
          Modo de comparación, duración (N días) y anclaje temporal de la ventana aplican a{" "}
          <strong>todos</strong> los gráficos de comparativa (ventana alineada, histórico «ventana global», longitud de
          tendencia y explorador). Semanas ISO agregan por calendario completo, independiente del anclaje.
        </p>
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
          <div className="space-y-1 max-w-md">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Anclaje de la ventana</p>
            <Select
              value={windowAnchor.type}
              onValueChange={(v) => setWindowAnchor({ type: v as ComparativaWindowAnchor["type"] })}
            >
              <SelectTrigger className="h-9 min-w-[280px] max-w-[min(100vw-2rem,420px)] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANCHOR_SELECT_ITEMS.map((it) => (
                  <SelectItem key={it.value} value={it.value} className="text-xs">
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {windowAnchor.type === "dashboardDateFilters" && !filterHasta?.trim() && !filterDesde?.trim() && (
              <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-1">
                Define al menos <strong>desde</strong> o <strong>hasta</strong> en el panel de filtros, o el fin de
                ventana seguirá siendo hoy.
              </p>
            )}
          </div>
        </div>
        {resumenComparativa && (
          <p className="text-[11px] text-foreground font-medium mt-3 border-t border-border/50 pt-3 leading-snug">
            {resumenComparativa}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2 space-y-1">
          <span className="block">Referencia calendario: {currentMonthContext.monthLine}</span>
          <span className="block">{currentMonthContext.rollingInMonth}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          En «Análisis fijo» el diario sigue <em>desde / hasta</em> del panel. Aquí la ventana mide {compareDays} días con
          el anclaje elegido. Cortes finos por dimensión requieren filas en cliente: la opción “como análisis fijo”
          aplica a leads / ventas / efectividad con la agregación del servidor.
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

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs font-semibold text-foreground">Ventana alineada</p>
            <div className="flex flex-wrap gap-3 items-end">
              {(alBase === "leads" || alBase === "ventas" || alBase === "efectividad") &&
                Boolean(rpcData?.daily?.length) && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fuente</p>
                    <Select
                      value={alDataSource}
                      onValueChange={(v) => setAlDataSource(v as "client" | "rpc")}
                    >
                      <SelectTrigger className="h-8 min-w-[200px] max-w-[min(100vw-2rem,320px)] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Universo en cliente</SelectItem>
                        <SelectItem value="rpc">Como análisis fijo (servidor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
                <Select value={dailyViz} onValueChange={(v) => setDailyViz(v as ComparisonViz)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="area">Área</SelectItem>
                    <SelectItem value="line">Líneas</SelectItem>
                    <SelectItem value="bar">Barras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {alDataSource === "rpc" && (alBase === "leads" || alBase === "ventas" || alBase === "efectividad") && (
            <p className="text-[10px] text-muted-foreground leading-snug">
              Serie alineada al timeseries del ejecutivo (últimos {compareDays} puntos del agregado diario). Explorador y
              cortes por dimensión siguen usando filas en cliente.
            </p>
          )}
          <MetricSelectors
            leads={leads}
            baseKind={alBase}
            setBaseKind={setAlBase}
            dimSubjectId={alDimId}
            setDimSubjectId={setAlDimId}
            dimToken={alDimTok}
            setDimToken={setAlDimTok}
            suffix="al"
          />
          <p className="text-[11px] text-muted-foreground">Clic en punto filtra por día</p>
          <ChartFrame>
            <ReactECharts
              key={`al-${alDataSource}-${windowAnchor.type}-${compareMode}-${compareDays}-${dailyViz}-${titleAl}`}
              option={optAligned}
              style={{ height: 300, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evCompareDay}
            />
          </ChartFrame>
        </Card>

        <Card className="p-4 space-y-3">
          <Tabs
            value={historicTab}
            onValueChange={(v) => setHistoricTab(v as "window" | "trend")}
            className="w-full space-y-3"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Histórico</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
                  <Select value={trendViz} onValueChange={(v) => setTrendViz(v as typeof trendViz)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Líneas</SelectItem>
                      <SelectItem value="area">Área</SelectItem>
                      <SelectItem value="bar">Barras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TabsList className="h-8">
                  <TabsTrigger value="window" className="text-xs px-2.5">
                    Ventana global
                  </TabsTrigger>
                  <TabsTrigger value="trend" className="text-xs px-2.5">
                    ~90 días
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            <MetricSelectors
              leads={leads}
              baseKind={trBase}
              setBaseKind={setTrBase}
              dimSubjectId={trDimId}
              setDimSubjectId={setTrDimId}
              dimToken={trDimTok}
              setDimToken={setTrDimTok}
              suffix="tr"
            />
            <TabsContent value="window" className="mt-0 space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Comparación dual con el <strong>modo</strong> y la <strong>ventana</strong> globales (igual que «Ventana
                alineada»), usando la métrica definida arriba en este bloque.
              </p>
              <ChartFrame>
                <ReactECharts
                  key={`tr-win-${windowAnchor.type}-${compareMode}-${compareDays}-${trendViz}-${titleTr}`}
                  option={optHistoricWindow}
                  style={{ height: 300, width: "100%" }}
                  notMerge
                  lazyUpdate
                  onEvents={evHistoricWindowDay}
                />
              </ChartFrame>
            </TabsContent>
            <TabsContent value="trend" className="mt-0 space-y-2">
              <div className="flex flex-wrap gap-2 items-end justify-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Línea extra</p>
                  <Select value={trendOverlay} onValueChange={(v) => setTrendOverlay(v as typeof trendOverlay)}>
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">Sin línea extra</SelectItem>
                      <SelectItem value="prev_calendar_day">vs día anterior</SelectItem>
                      <SelectItem value="same_weekday_prev_week">vs −7 días</SelectItem>
                      <SelectItem value="avg_weekday_historical">vs prom. weekday</SelectItem>
                      <SelectItem value="same_dom_prev_month">vs mismo día mes ant.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Serie larga sin acotar a la ventana global · Clic filtra por día</p>
              <ChartFrame>
                <ReactECharts
                  key={`tr-trend-${windowAnchor.type}-${compareMode}-${compareDays}-${trendViz}-${trendOverlay}-${titleTr}`}
                  option={optTrend}
                  style={{ height: 300, width: "100%" }}
                  notMerge
                  lazyUpdate
                  onEvents={evTrendDay}
                />
              </ChartFrame>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Semanas ISO</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
              <Select value={weeklyViz} onValueChange={(v) => setWeeklyViz(v as typeof weeklyViz)}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barras</SelectItem>
                  <SelectItem value="line">Líneas</SelectItem>
                  <SelectItem value="area">Área</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Comparar</p>
              <Select value={weekCompare ? "yes" : "no"} onValueChange={(v) => setWeekCompare(v === "yes")}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">+ semana ant.</SelectItem>
                  <SelectItem value="no">Solo serie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <MetricSelectors
          leads={leads}
          baseKind={wkBase}
          setBaseKind={setWkBase}
          dimSubjectId={wkDimId}
          setDimSubjectId={setWkDimId}
          dimToken={wkDimTok}
          setDimToken={setWkDimTok}
          suffix="wk"
        />
        <p className="text-[11px] text-muted-foreground">Clic filtra rango de semana</p>
        <ChartFrame>
          <ReactECharts
            key={`wk-${weeklyViz}-${weekCompare}-${compareMode}-${compareDays}-${titleWk}`}
            option={optWeekly}
            style={{ height: 320, width: "100%" }}
            notMerge
            lazyUpdate
            onEvents={evWeekly}
          />
        </ChartFrame>
      </Card>

      {leads.length > 0 && (
        <Card className="p-4 md:p-5 space-y-4">
          <div>
            <h3 className="text-base font-display font-semibold text-foreground">Explorador comparativo por dimensión</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
              Elige una columna (ciudad, campaña, canal, etc.), busca un valor y define qué métrica calcular dentro de ese
              corte. Usa la misma ventana y modo global de arriba.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Dimensión del corte</p>
              <Select
                value={String(exFilterCol)}
                onValueChange={(v) => setExFilterCol(v as keyof LeadRow)}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COMPARATIVE_BREAKDOWN_GROUPS.map((g) => (
                    <SelectItem key={g.id} value={String(g.column)}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[160px] flex-1 max-w-xs">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Buscar valor</p>
              <Input
                className="h-8 text-xs"
                placeholder="Filtrar lista…"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 min-w-[200px] max-w-[280px]">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Valor</p>
              <Select value={exFilterTok} onValueChange={setExFilterTok}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {exFilteredPicklist.length === 0 ? (
                    <SelectItem value="__none__" disabled className="text-muted-foreground">
                      Sin coincidencias
                    </SelectItem>
                  ) : (
                    exFilteredPicklist.map((t) => (
                      <SelectItem key={t} value={t}>
                        {formatFilterChipValue(t)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vista</p>
              <Select value={exViz} onValueChange={(v) => setExViz(v as ComparisonViz)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="line">Líneas</SelectItem>
                  <SelectItem value="bar">Barras</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <MetricSelectors
            leads={leads}
            baseKind={exBase}
            setBaseKind={setExBase}
            dimSubjectId={exDimId}
            setDimSubjectId={setExDimId}
            dimToken={exDimTok}
            setDimToken={setExDimTok}
            suffix="ex"
          />
          <p className="text-[11px] text-muted-foreground">
            Registros en este corte: {exSlice.length.toLocaleString("es")} · Clic en punto filtra por día
          </p>
          <ChartFrame>
            <ReactECharts
              key={`ex-${windowAnchor.type}-${exFilterCol}-${exFilterTok}-${exViz}-${compareMode}-${compareDays}-${exTitle}`}
              option={optExplorer}
              style={{ height: 320, width: "100%" }}
              notMerge
              lazyUpdate
              onEvents={evExplorerDay}
            />
          </ChartFrame>
        </Card>
      )}
    </section>
  );
}
